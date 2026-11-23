"""hitomi.la gallery browser/downloader.

Completely different site shape from site2/wfwf (no board CMS, no episodes —
one gallery = one work, a flat list of page images). See
docs/claude_plan/hitomi-viewer.md for how each piece here was reverse-engineered:

- Listing (``fetch_list``): the site's own ``index-korean.html`` ships with an
  empty ``<div class="gallery-content">`` and fills it client-side. We
  reproduce that: a ``.nozomi`` file holds the full gallery-id list as 4-byte
  big-endian ints (fetched a page at a time via HTTP ``Range``), and each id's
  card markup (title/series/type/tags/date/thumbnail) comes from
  ``galleryblock/{id}.html``.
- Detail (``fetch_gallery``): ``galleries/{id}.js`` is a ``var galleryinfo =
  {...}`` JSON literal with the page hashes and a ``related`` id list.
- Real image URLs (``image_url``): the hash alone isn't a URL — the site's own
  ``gg.js`` computes a CDN subdomain/path from it, and rotates the mapping
  occasionally to slow down scraping. Ported here as ``GG_CASE_VALUES``/``GG_B``;
  if images start 404ing, re-fetch ``gg.js`` and regenerate these two constants
  (see the doc above for the exact one-off script used to derive them).

Reaching hitomi.la at all also requires the user's own network to not be
blocking it (SNI-based blocking observed from South Korea, unrelated to the
site itself) — this module just makes plain ``requests`` calls and assumes
that's already handled outside the app (e.g. a DPI-circumvention tool such as
GoodbyeDPI running while the hitomi tab is in use).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import struct
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Callable, List, Optional

import requests
from bs4 import BeautifulSoup

from . import crawler

DEFAULT_TIMEOUT = 10
DOMAIN = "gold-usergeneratedcontent.net"
LTN = f"https://ltn.{DOMAIN}"
GALLERIES_PER_PAGE = 20  # 4 rows x hitomi-grid's 5 columns per page
LIST_FETCH_WORKERS = 16  # concurrent fetches per list page (2 requests/item: card + group/characters)

HEADERS = {
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36"
    ),
}
REFERER_HEADERS = {**HEADERS, "Referer": "https://hitomi.la/"}

# Shared session so the many requests a single list page needs reuse one keep-alive
# connection per host instead of paying a fresh TLS handshake each time.
_session = requests.Session()

LogFn = Callable[[str], None]


def _noop_log(_msg: str) -> None:
    return None


@dataclass
class Artist:
    name: str
    slug: str  # from the site's own /artist/{slug}-all.html link — empty if unparseable


@dataclass
class GalleryListItem:
    id: int
    title: str
    series: str
    type: str
    tags: str
    date: str
    thumbnail_url: str
    artists: List[Artist] = field(default_factory=list)
    language: str = ""
    # Group/Characters aren't in the compact galleryblock card at all — filled in
    # separately from the full gallery JSON (see _fetch_block/_fetch_list_extra).
    group: str = ""
    characters: str = ""
    # Also from that same full-JSON fetch (len(files)) — no extra request needed.
    page_count: int = 0


@dataclass
class GalleryFile:
    name: str
    hash: str
    width: int
    height: int


@dataclass
class GalleryDetail:
    id: int
    title: str
    type: str
    tags: str
    artists: List[Artist]
    date: str
    files: List[GalleryFile] = field(default_factory=list)
    related: List[GalleryListItem] = field(default_factory=list)


# --- gg.js: hash -> CDN subdomain/path, ported from the site's own JS ------
#
# The site rotates the exact mapping occasionally to fight scrapers, so this is
# fetched and parsed lazily (and cached in-process) rather than hardcoded.

_gg_cache: dict = {"case_values": None, "b": None, "default_o": None, "fetched_at": 0.0}
_GG_CACHE_TTL = 60  # seconds


def _refresh_gg() -> None:
    resp = _session.get(f"{LTN}/gg.js", headers=HEADERS, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    text = resp.text
    case_values = {int(n) for n in re.findall(r"case (\d+):", text)}
    b_match = re.search(r"b:\s*'([^']+)'", text)
    # The site swaps which side (default vs. listed cases) means 0 vs. 1 every so
    # often as an anti-scraping obfuscation — parsing `var o = N;` here instead of
    # hardcoding a direction lets image_url() compute the real value either way
    # (see its docstring).
    default_o_match = re.search(r"var o\s*=\s*(\d+)", text)
    if not case_values or not b_match or not default_o_match:
        raise ValueError("gg.js 형식이 바뀐 것으로 보입니다 — 파싱 실패")
    _gg_cache["case_values"] = case_values
    _gg_cache["b"] = b_match.group(1)
    _gg_cache["default_o"] = int(default_o_match.group(1))
    _gg_cache["fetched_at"] = time.time()


def _gg() -> tuple[set, str, int]:
    if _gg_cache["case_values"] is None or time.time() - _gg_cache["fetched_at"] > _GG_CACHE_TTL:
        _refresh_gg()
    return _gg_cache["case_values"], _gg_cache["b"], _gg_cache["default_o"]


def refresh_gg() -> None:
    """Force a re-fetch of gg.js, bypassing the TTL cache.

    Used as a one-shot retry hook when an image request 502s. Originally added
    on the theory that most 502s were the network bypass (GoodbyeDPI) not being
    active — turned out the bigger cause (as of 2026-09-25) was ``image_url``
    hardcoding a w1/w2 direction that the site's periodic ``gg.js`` obfuscation
    swaps invalidated within hours (see its docstring for the now-dynamic fix).
    This retry still earns its keep for genuine ``case_values``/``b``/``default_o``
    rotation, and doesn't hurt otherwise.
    """
    _refresh_gg()


def image_url(hash_: str, ext: str = "webp") -> str:
    """Full-resolution image URL for a page hash (gg.js's ``m()``/``url_from_hash``, ported).

    ``gg.m(g)`` returns an ``o`` of 0 or 1: ``default_o`` for hashes whose ``g``
    is NOT one of the switch's listed ``case N:`` values, ``1 - default_o`` for
    ones that are. The site periodically swaps which side (default vs. listed)
    means 0 vs. 1 as an anti-scraping obfuscation — a hardcoded "in case_values
    -> w1" direction broke within hours of being fixed the previous time (see
    docs/claude_plan/hitomi-viewer.md, "34번 분석") because that swap flips which
    literal subdomain digit is correct even though the underlying rule doesn't
    change. Computing the real ``o`` from ``default_o`` and using
    ``subdomain digit = o + 1`` verified stable across both observed encodings
    (8/8, then 15/15 real hashes), so this direction should hold even after the
    site swaps the encoding again.
    """
    case_values, gg_b, default_o = _gg()
    last3 = hash_[-3:]
    g = int(last3[2] + last3[0:2], 16)
    o = default_o if g not in case_values else 1 - default_o
    subdomain = f"w{o + 1}"
    return f"https://{subdomain}.{DOMAIN}/{gg_b}{g}/{hash_}.{ext}"


# --- listing ----------------------------------------------------------------


def _parse_list_block(gallery_id: int, html: str) -> GalleryListItem:
    soup = BeautifulSoup(html, "html.parser")
    title_el = soup.select_one("h1.lillie a")
    thumb_el = soup.select_one("img[data-src]")

    rows: dict[str, str] = {}
    for tr in soup.select("table.dj-desc tr"):
        tds = tr.find_all("td")
        if len(tds) == 2:
            label = tds[0].get_text(strip=True)
            sep = " / " if label == "Tags" else ", "
            rows[label] = sep.join(tds[1].stripped_strings)

    artists = [
        Artist(name=a.get_text(strip=True), slug=_artist_slug(a.get("href", "")))
        for a in soup.select(".artist-list a")
    ]

    date_el = soup.select_one(".dj-date")
    thumbnail_url = ""
    if thumb_el is not None:
        src = thumb_el.get("data-src", "")
        thumbnail_url = f"https:{src}" if src.startswith("//") else src
        # Most cards give a protocol-relative URL on our working mirror domain, but
        # some give a full https://xxx.hitomi.la/... URL instead — and hitomi.la
        # itself doesn't even resolve on networks that block it (confirmed: a plain
        # DNS lookup fails), guaranteeing a 502 from the proxy no matter what gg.js
        # or the network bypass are doing. Rewrite it to the domain we know works.
        thumbnail_url = thumbnail_url.replace("hitomi.la", DOMAIN)

    return GalleryListItem(
        id=gallery_id,
        title=title_el.get_text(strip=True) if title_el else "",
        series=rows.get("Series", ""),
        type=rows.get("Type", ""),
        tags=rows.get("Tags", ""),
        date=date_el.get_text(strip=True) if date_el else "",
        thumbnail_url=thumbnail_url,
        artists=artists,
        language=rows.get("Language", ""),
    )


def _fetch_block(gallery_id: int) -> Optional[GalleryListItem]:
    resp = _session.get(f"{LTN}/galleryblock/{gallery_id}.html", headers=REFERER_HEADERS, timeout=DEFAULT_TIMEOUT)
    if resp.status_code != 200:
        return None
    resp.encoding = "utf-8"
    item = _parse_list_block(gallery_id, resp.text)
    extra = _fetch_list_extra(gallery_id)
    item.group = extra.get("group", "")
    item.characters = extra.get("characters", "")
    item.page_count = extra.get("page_count", 0)
    return item


def _matches_any_tag(tags: str, needles: List[str]) -> bool:
    tags_lower = (tags or "").lower()
    return any(needle.lower() in tags_lower for needle in needles if needle)


def _fetch_nozomi_raw(nozomi_path: str, start: int, count: int) -> tuple[List[int], Optional[int]]:
    """Raw gallery ids ``[start, start+count)`` from a ``.nozomi`` index, plus the
    index's total id count if the server reports it (via ``Content-Range``)."""
    start_byte = start * 4
    end_byte = start_byte + count * 4 - 1
    resp = _session.get(
        f"{LTN}/{nozomi_path}.nozomi",
        headers={**HEADERS, "Range": f"bytes={start_byte}-{end_byte}"},
        timeout=DEFAULT_TIMEOUT,
    )
    resp.raise_for_status()
    got = len(resp.content) // 4
    ids = list(struct.unpack(f">{got}i", resp.content[: got * 4])) if got else []

    total = None
    content_range = resp.headers.get("Content-Range", "")  # "bytes start-end/total"
    if "/" in content_range:
        total = int(content_range.rsplit("/", 1)[-1]) // 4
    return ids, total


# A tag-exclusion filter can reject most of a batch, so filling one page of results
# may need scanning several raw batches — capped so a very restrictive filter can't
# turn one request into an unbounded crawl. Hitting the cap just means "다음 페이지"
# may need clicking again to keep scanning rather than the page always coming back full.
MAX_SCAN_BATCHES = 5


def _fetch_nozomi_page(
    nozomi_path: str, offset: int, exclude_tags: Optional[List[str]] = None
) -> tuple[List[GalleryListItem], int, bool]:
    """Up to ``GALLERIES_PER_PAGE`` items starting at raw index ``offset``, newest-first.

    ``nozomi_path`` is the site's own path scheme minus the extension — e.g.
    ``"index-korean"`` (the main Korean listing) or ``"artist/{slug}-korean"``
    (one artist's Korean-language works, see ``fetch_artist_list``) — ported
    from ``galleryblock.js``'s ``fetch_nozomi`` URL construction.

    ``exclude_tags`` drops any item whose tag string contains one of these
    substrings (case-insensitive — e.g. ``["♂", "loli"]``).

    Pagination is by raw offset rather than page number specifically so
    ``exclude_tags`` can drop items without breaking the mapping from "page N" to
    a byte range — the caller gets back ``next_offset`` to ask for the next page
    with, rather than incrementing a page number itself. Returns
    ``(items, next_offset, has_more)``.
    """
    items: List[GalleryListItem] = []
    cursor = offset
    total: Optional[int] = None

    for _ in range(MAX_SCAN_BATCHES):
        ids, batch_total = _fetch_nozomi_raw(nozomi_path, cursor, GALLERIES_PER_PAGE)
        if batch_total is not None:
            total = batch_total
        if not ids:
            break

        # Each id needs its own request (galleryblock/{id}.html) — fetching them
        # sequentially made a page take ~10s, so fan them out instead.
        with ThreadPoolExecutor(max_workers=LIST_FETCH_WORKERS) as pool:
            batch_items = list(pool.map(_fetch_block, ids))

        for item in batch_items:
            cursor += 1
            if item is None:
                continue
            if exclude_tags and _matches_any_tag(item.tags, exclude_tags):
                continue
            items.append(item)
            if len(items) >= GALLERIES_PER_PAGE:
                break

        if len(items) >= GALLERIES_PER_PAGE or len(ids) < GALLERIES_PER_PAGE:
            break  # page full, or reached the end of the index

    has_more = total is None or cursor < total
    return items[:GALLERIES_PER_PAGE], cursor, has_more


def fetch_list(offset: int = 0, exclude_tags: Optional[List[str]] = None) -> tuple[List[GalleryListItem], int, bool]:
    """One listing page — mirrors index-korean.html. Returns (items, next_offset, has_more)."""
    return _fetch_nozomi_page("index-korean", offset, exclude_tags)


def fetch_artist_list(
    slug: str, offset: int = 0, exclude_tags: Optional[List[str]] = None
) -> tuple[List[GalleryListItem], int, bool]:
    """One artist's Korean-language works — mirrors artist/{slug}-korean.html."""
    return _fetch_nozomi_page(f"artist/{slug}-korean", offset, exclude_tags)


# --- title search -------------------------------------------------------
#
# hitomi.la's own search box (search.html) doesn't hit a REST endpoint — it
# looks up each word in a binary B-tree index (searchlib.js/search.js), the
# same Range-request style already used above for .nozomi, generalized to a
# tree. Ported here for the "galleries" field only (whole-title/tag text
# search) — the site's own `language:`/`female:`/`male:` filter syntax goes
# through a different (.nozomi-based) path we don't need, since we filter to
# Korean ourselves via the card language field we already parse.

SEARCH_NODE_SIZE = 464  # bytes; matches gg.js-style constants, verified against a live fetch
SEARCH_TREE_B = 16  # branching factor -> B+1 child-node addresses per node
_SEARCH_INDEX_CACHE_TTL = 300  # seconds; index versions rotate far less often than gg.js

_search_version_cache: dict = {"value": None, "fetched_at": 0.0}


def _galleries_index_version() -> str:
    if (
        _search_version_cache["value"] is None
        or time.time() - _search_version_cache["fetched_at"] > _SEARCH_INDEX_CACHE_TTL
    ):
        resp = _session.get(
            f"{LTN}/galleriesindex/version", headers=HEADERS, params={"_": int(time.time())}, timeout=DEFAULT_TIMEOUT
        )
        resp.raise_for_status()
        _search_version_cache["value"] = resp.text.strip()
        _search_version_cache["fetched_at"] = time.time()
    return _search_version_cache["value"]


def _hash_term(term: str) -> bytes:
    return hashlib.sha256(term.encode("utf-8")).digest()[:4]


def _decode_search_node(data: bytes) -> dict:
    pos = 0
    (num_keys,) = struct.unpack_from(">i", data, pos); pos += 4
    keys = []
    for _ in range(num_keys):
        (key_size,) = struct.unpack_from(">i", data, pos); pos += 4
        keys.append(data[pos:pos + key_size]); pos += key_size
    (num_datas,) = struct.unpack_from(">i", data, pos); pos += 4
    datas = []
    for _ in range(num_datas):
        (data_offset,) = struct.unpack_from(">Q", data, pos); pos += 8
        (data_length,) = struct.unpack_from(">i", data, pos); pos += 4
        datas.append((data_offset, data_length))
    subs = []
    for _ in range(SEARCH_TREE_B + 1):
        (addr,) = struct.unpack_from(">Q", data, pos); pos += 8
        subs.append(addr)
    return {"keys": keys, "datas": datas, "subs": subs}


def _get_search_node(version: str, address: int) -> dict:
    url = f"{LTN}/galleriesindex/galleries.{version}.index"
    resp = _session.get(
        url, headers={**HEADERS, "Range": f"bytes={address}-{address + SEARCH_NODE_SIZE - 1}"}, timeout=DEFAULT_TIMEOUT
    )
    resp.raise_for_status()
    return _decode_search_node(resp.content)


def _search_b_tree(version: str, key: bytes, address: int = 0) -> Optional[tuple[int, int]]:
    node = _get_search_node(version, address)
    keys = node["keys"]
    i = 0
    while i < len(keys) and key > keys[i]:
        i += 1
    if i < len(keys) and key == keys[i]:
        return node["datas"][i]
    child_addr = node["subs"][i]
    if child_addr == 0:
        return None
    return _search_b_tree(version, key, child_addr)


def _galleryids_for_word(word: str) -> set:
    version = _galleries_index_version()
    result = _search_b_tree(version, _hash_term(word))
    if result is None:
        return set()
    data_offset, data_length = result
    url = f"{LTN}/galleriesindex/galleries.{version}.data"
    resp = _session.get(
        url, headers={**HEADERS, "Range": f"bytes={data_offset}-{data_offset + data_length - 1}"}, timeout=DEFAULT_TIMEOUT
    )
    resp.raise_for_status()
    n = data_length // 4
    return set(struct.unpack(f">{n}i", resp.content[: n * 4]))


def _hydrate_search_page(
    ids: List[int], offset: int, exclude_tags: Optional[List[str]] = None
) -> tuple[List[GalleryListItem], int, bool]:
    """Same batch-scan-with-a-cap shape as ``_fetch_nozomi_page``, but over an
    already-known (in-memory) id list instead of a ``.nozomi`` byte range — search
    results aren't Korean-only or tag-filtered by the site itself, so that
    narrowing happens here, the same way ``exclude_tags`` already does."""
    items: List[GalleryListItem] = []
    cursor = offset
    total = len(ids)

    for _ in range(MAX_SCAN_BATCHES):
        batch_ids = ids[cursor:cursor + GALLERIES_PER_PAGE]
        if not batch_ids:
            break
        with ThreadPoolExecutor(max_workers=LIST_FETCH_WORKERS) as pool:
            batch_items = list(pool.map(_fetch_block, batch_ids))

        for item in batch_items:
            cursor += 1
            if item is None:
                continue
            if item.language != "한국어":
                continue
            if exclude_tags and _matches_any_tag(item.tags, exclude_tags):
                continue
            items.append(item)
            if len(items) >= GALLERIES_PER_PAGE:
                break

        if len(items) >= GALLERIES_PER_PAGE or cursor >= total:
            break

    has_more = cursor < total
    return items[:GALLERIES_PER_PAGE], cursor, has_more


def search_list(
    query: str, offset: int = 0, exclude_tags: Optional[List[str]] = None
) -> tuple[List[GalleryListItem], int, bool]:
    """Title/tag text search — multiple words are AND'd (set intersection, computed
    here rather than ported from the site since only single-word lookups were
    confirmed from its client script), results restricted to Korean-language works
    (this app's Korean-only design) and sorted newest-id-first for a stable order.
    """
    words = [w.lower() for w in query.strip().split() if w.strip()]
    if not words:
        return [], offset, False

    matched: Optional[set] = None
    for word in words:
        word_ids = _galleryids_for_word(word)
        matched = word_ids if matched is None else (matched & word_ids)
        if not matched:
            break

    sorted_ids = sorted(matched or set(), reverse=True)
    return _hydrate_search_page(sorted_ids, offset, exclude_tags)


# --- detail -------------------------------------------------------------


def _tag_names(entries) -> str:
    return ", ".join(e.get("tag", "") for e in entries if e.get("tag"))


def _artist_slug(url: str) -> str:
    """"/artist/anago-all.html" -> "anago" (empty if the site's link shape changes)."""
    m = re.match(r"^/artist/(.+)-all\.html$", url or "")
    return m.group(1) if m else ""


def _fetch_gallery_json(gallery_id: int) -> dict:
    resp = _session.get(f"{LTN}/galleries/{gallery_id}.js", headers=HEADERS, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    text = resp.text.strip()
    prefix = "var galleryinfo = "
    if not text.startswith(prefix):
        raise ValueError("galleries/{id}.js 형식이 바뀐 것으로 보입니다")
    return json.loads(text[len(prefix):].rstrip(";"))


def _fetch_list_extra(gallery_id: int) -> dict:
    """Group/Characters/page count for one gallery — only in the full JSON, not the
    compact card. ``files`` is already in this same response, so ``page_count``
    costs no extra request beyond what group/characters already need."""
    try:
        data = _fetch_gallery_json(gallery_id)
    except (requests.RequestException, ValueError):
        return {}
    return {
        "group": ", ".join(g.get("group", "") for g in (data.get("groups") or []) if g.get("group")),
        "characters": ", ".join(c.get("character", "") for c in (data.get("characters") or []) if c.get("character")),
        "page_count": len(data.get("files") or []),
    }


def fetch_gallery(gallery_id: int) -> GalleryDetail:
    data = _fetch_gallery_json(gallery_id)

    files = [
        GalleryFile(name=f.get("name", ""), hash=f["hash"], width=f.get("width", 0), height=f.get("height", 0))
        for f in data.get("files", [])
    ]
    related_ids = data.get("related", [])[:6]
    with ThreadPoolExecutor(max_workers=LIST_FETCH_WORKERS) as pool:
        related = [item for item in pool.map(_fetch_block, related_ids) if item is not None]

    artists = [
        Artist(name=a.get("artist", ""), slug=_artist_slug(a.get("url", "")))
        for a in (data.get("artists") or [])
    ]

    return GalleryDetail(
        id=gallery_id,
        title=data.get("title", ""),
        type=data.get("type", ""),
        tags=_tag_names(data.get("tags", [])),
        artists=artists,
        date=data.get("date", ""),
        files=files,
        related=related,
    )


# --- download -------------------------------------------------------------


def crawl_gallery(
    gallery_id: int,
    title: str,
    download_root: str,
    log: LogFn = _noop_log,
    should_stop: Optional[Callable[[], bool]] = None,
) -> "crawler.CrawlResult":
    """Download one gallery's full-resolution images into ``{download_root}/{title}/``.

    Uses the same flat naming convention as ``crawler.crawl_toon``'s
    non-separate-folders mode (``{episode:03d}_{page:03d}``, single "episode"
    since hitomi has no episode concept) so the existing viewer
    (``app/library.py``) picks it up with no changes.
    """
    detail = fetch_gallery(gallery_id)
    base_dir = os.path.join(download_root, crawler.sanitize_folder_name(title))
    os.makedirs(base_dir, exist_ok=True)

    result = crawler.CrawlResult(episode_folders=[base_dir], artists=[a.name for a in detail.artists])
    log(f"{detail.title} - 이미지 {len(detail.files)}개 다운로드 시작")

    downloaded = 0
    failed = 0
    for i, f in enumerate(detail.files):
        if should_stop and should_stop():
            log("사용자 요청으로 중단되었습니다.")
            break
        file_name = f"001_{i + 1:03d}"
        url = image_url(f.hash)
        ok = crawler.download_image(base_dir, file_name, url, REFERER_HEADERS, ext="webp", log=log)
        if not ok:
            # gg.js's hash->subdomain mapping can rotate mid-download (60s TTL) —
            # crawler.download_image retries the same (now-stale) URL 5 times, which
            # can never succeed once that happens. Refresh once and recompute the URL
            # before giving up on this page.
            refresh_gg()
            url = image_url(f.hash)
            ok = crawler.download_image(base_dir, file_name, url, REFERER_HEADERS, ext="webp", log=log)
        if ok:
            downloaded += 1
        else:
            failed += 1

    result.images_downloaded = downloaded
    result.images_failed = failed
    if downloaded > 0 and failed > 0:
        result.partial_episode_count = 1
    result.episodes_processed = 1
    return result
