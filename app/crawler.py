"""Site-2 (11툰) manga board crawler/downloader, plus a wfwf-family (늑대닷컴) one.

The site2/11툰 functions are refactored from the original standalone script
(``cwraling_download_manga_img_site2.py``). Target a specific Korean manga-board CMS
layout: ``/bbs/board.php?bo_table=toons`` listing pages, with a per-post
``var img_list = [...]`` JS array holding image URLs.

The ``_wfwf`` functions target a different, unrelated site family (늑대닷컴, currently
mirrored at wfwf488.com) with its own URL scheme and markup — see
docs/claude_plan/wfwf488-multi-site-support.md for how that one was reverse-engineered.
``source``/``list_prefix`` values used elsewhere (``jobs.py``, ``online.py``,
``main.py``) stay as the internal keys ``"site2"``/``"wfwf"`` — only prose and UI
labels use the real names.

Every function here is synchronous/blocking (``requests`` + ``BeautifulSoup``) and is
meant to be run inside a worker thread by the job manager, not on the asyncio loop.
"""
from __future__ import annotations

import os
import re
import time
import zipfile
from dataclasses import dataclass, field
from typing import Callable, List, Optional
from urllib.parse import quote, urlparse

import requests
from bs4 import BeautifulSoup

DEFAULT_TIMEOUT = 10
MAX_DOWNLOAD_RETRIES = 5
MIN_VALID_FILE_SIZE = 4096  # bytes; smaller than this is treated as a broken/placeholder image

LogFn = Callable[[str], None]


def _noop_log(_msg: str) -> None:
    return None


@dataclass
class Episode:
    title: str
    wr_id: str
    date: str = ""


@dataclass
class CrawlResult:
    episodes_processed: int = 0
    images_downloaded: int = 0
    images_failed: int = 0
    episode_folders: List[str] = field(default_factory=list)


@dataclass
class SearchResult:
    id: int
    title: str
    tags: str
    description: str
    list_prefix: str = ""  # wfwf only: "list" or "cl" — which URL family this title lives under


def headers_for(site_url: str) -> dict:
    netloc = urlparse(site_url).netloc
    return {
        "Referer": netloc,
        "user-agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36"
        ),
    }


def _extract_wr_id(onclick_attr: str) -> str:
    pos_s = onclick_attr.find("wr_id=")
    pos_e = onclick_attr.find("&stx")
    return re.sub(r"[^0-9]", "", onclick_attr[pos_s:pos_e])


def get_episode_list(site_url: str, toon_id: int, page_no: int, headers: dict) -> List[Episode]:
    """Fetch one listing page and return its episodes (site's on-page order)."""
    list_url = f"{site_url}/bbs/board.php?bo_table=toons&is={toon_id}&page={page_no}"
    resp = requests.get(list_url, headers=headers, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    episodes: List[Episode] = []
    for elem in soup.select("button.episode.is-series"):
        title_el = elem.select_one("div.episode-title.ellipsis")
        onclick = elem.get("onclick", "")
        if title_el is None or not onclick:
            continue
        date_el = elem.select_one("div.free-date")
        # `free-date` also holds a trailing "(N)" comment-count in a nested <font>;
        # take just its first direct text node, which is the "YY.MM.DD" post date.
        date_text = next(iter(date_el.stripped_strings), "") if date_el is not None else ""
        episodes.append(Episode(title=title_el.text.strip(), wr_id=_extract_wr_id(onclick), date=date_text))
    return episodes


def get_image_list(site_url: str, toon_id: int, wr_id: str, headers: dict) -> List[str]:
    """Fetch one episode's detail page and pull the ``img_list`` JS array out of it."""
    time.sleep(0.2)  # be gentle with the source site
    detail_url = f"{site_url}/bbs/board.php?bo_table=toons&stx=GTO&is={toon_id}&wr_id={wr_id}"
    resp = requests.get(detail_url, headers=headers, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    scripts_blob = str(soup.select("script"))

    for line in scripts_blob.splitlines():
        if "var img_list = [" in line:
            return (
                line.replace("    var img_list = [", "")
                .replace("]", "")
                .replace('"', "")
                .replace(";", "")
                .replace("//www", "https://www")
                .split(",")
            )
    return []


def search_titles(site_url: str, query: str, headers: dict) -> List[SearchResult]:
    """Search the site's own title-search box (``toons`` board results only).

    Hits the site's own autocomplete endpoint (``/bbs/ajax.search.php``), which is
    what the site's search box itself calls as you type. Its response mixes results
    from two boards: entries within the ``counts`` boundary belong to
    ``bo_table=toons`` (what this app supports); anything past that boundary belongs
    to a different board (``cartoonson``) that this crawler doesn't handle, so those
    are silently dropped rather than returned as broken results.
    """
    search_url = f"{site_url}/bbs/ajax.search.php"
    resp = requests.get(search_url, params={"search_key": query}, headers=headers, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") != "success":
        return []

    counts = data.get("counts", 0)
    results: List[SearchResult] = []
    for i, item in enumerate(data.get("list", [])):
        if i >= counts:
            break
        wr_id = item.get("wr_id")
        if not wr_id:
            continue
        results.append(
            SearchResult(
                id=int(wr_id),
                title=(item.get("wr_subject") or "").strip(),
                tags=(item.get("ca_name") or "").strip(),
                description=(item.get("wr_content") or "").strip(),
            )
        )
    return results


WFWF_LIST_PATH = {"list": "list", "cl": "cl"}
WFWF_DETAIL_PATH = {"list": "view", "cl": "cv"}


def search_titles_wfwf(site_url: str, query: str, headers: dict) -> List[SearchResult]:
    """Search wfwf-style sites via their plain HTML search page (``/sh?q=``).

    Unlike site2's JSON autocomplete endpoint, this returns a full results page.
    Each result card (``a.t-card``) links to either ``/list?toon=`` or ``/cl?toon=``
    depending on which of the site's two non-interchangeable content families
    (roughly general vs. adult) the title belongs to — that prefix is captured in
    ``SearchResult.list_prefix`` since nothing else reveals it (see docs/claude_plan/
    wfwf488-multi-site-support.md for how this was discovered).

    The query string has to be percent-encoded as ``euc-kr`` by hand — ``requests``'
    default ``params=`` encodes non-ASCII as UTF-8, which this site's ``euc-kr``
    search endpoint silently mangles into garbage input (and 0 results) instead of
    rejecting outright, so the failure is easy to miss.
    """
    encoded_query = quote(query.encode("euc-kr", errors="ignore"))
    resp = requests.get(f"{site_url}/sh?q={encoded_query}", headers=headers, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    results: List[SearchResult] = []
    for a in soup.select("a.t-card"):
        m = re.match(r"^/(list|cl)\?toon=(\d+)", a.get("href", ""))
        if not m:
            continue
        list_prefix, toon_id = m.group(1), m.group(2)
        title_el = a.select_one(".t-title")
        genre_el = a.select_one(".t-genre")
        ep_el = a.select_one(".t-ep")
        results.append(
            SearchResult(
                id=int(toon_id),
                title=(title_el.text.strip() if title_el else ""),
                tags=(genre_el.text.strip() if genre_el else ""),
                description=(ep_el.text.strip() if ep_el else ""),
                list_prefix=list_prefix,
            )
        )
    return results


def get_episode_list_wfwf(
    site_url: str, toon_id: int, list_prefix: str, page_no: int, headers: dict, sort: str = "n"
) -> List[Episode]:
    """Fetch one wfwf listing page (``sort``: ``n``=newest-first, ``o``=oldest-first).

    ``list_prefix`` must match whatever ``search_titles_wfwf`` returned for this
    title (``"list"`` or ``"cl"``) — the wrong one returns a "no such webtoon" page.
    """
    list_url = f"{site_url}/{WFWF_LIST_PATH[list_prefix]}"
    resp = requests.get(list_url, params={"toon": toon_id, "s": sort, "pg": page_no}, headers=headers, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    episodes: List[Episode] = []
    for a in soup.select("a.ep-item"):
        num = a.get("data-num")
        if not num:
            continue
        title_el = a.select_one(".ep-title")
        date_el = a.select_one(".ep-date")
        episodes.append(
            Episode(
                title=(title_el.text.strip() if title_el else ""),
                wr_id=num,
                date=(date_el.text.strip() if date_el else ""),
            )
        )
    return episodes


def get_image_list_wfwf(site_url: str, toon_id: int, list_prefix: str, num: str, headers: dict) -> List[str]:
    """Fetch one wfwf episode's page images (``wfwf``'s counterpart to ``get_image_list``).

    Real page images sit in ``div#vimg-area img[data-src]`` — ``src`` is always a
    placeholder sprite (lazy-load), and ad markup in the same container isn't an
    ``<img>`` so the selector skips it without extra filtering.
    """
    time.sleep(0.2)  # be gentle with the source site
    detail_url = f"{site_url}/{WFWF_DETAIL_PATH[list_prefix]}"
    resp = requests.get(detail_url, params={"toon": toon_id, "num": num}, headers=headers, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    return [img["data-src"] for img in soup.select("div#vimg-area img[data-src]")]


def crawl_toon_wfwf(
    site_url: str,
    toon_id: int,
    list_prefix: str,
    title: str,
    download_root: str,
    start_page: int,
    end_page: int,
    separate_folders: bool,
    log: LogFn = _noop_log,
    should_stop: Optional[Callable[[], bool]] = None,
) -> CrawlResult:
    """wfwf counterpart to ``crawl_toon``.

    Unlike site2 (which has no server-side sort, so ``crawl_toon`` walks pages
    backwards and reverses each page to get oldest-first), wfwf's listing endpoint
    takes a ``sort`` param directly (``s=o``) — pages ``start_page..end_page`` are
    walked forward and already come back oldest-first, page after page.
    """
    headers = headers_for(site_url)
    base_dir = os.path.join(download_root, sanitize_folder_name(title))
    os.makedirs(base_dir, exist_ok=True)

    result = CrawlResult()
    episode_num = 0

    for page_no in range(start_page, end_page + 1):
        if should_stop and should_stop():
            log("사용자 요청으로 중단되었습니다.")
            break

        log(f"페이지 {page_no} 목록을 가져오는 중...")
        episodes = get_episode_list_wfwf(site_url, toon_id, list_prefix, page_no, headers, sort="o")
        if not episodes:
            log(f"페이지 {page_no}: 회차 없음")
            continue

        for ep in episodes:
            if should_stop and should_stop():
                log("사용자 요청으로 중단되었습니다.")
                break

            episode_num += 1
            folder_name = sanitize_folder_name(ep.title)

            if separate_folders:
                episode_dir = os.path.join(base_dir, f"{episode_num:02d}_{folder_name}")
                os.makedirs(episode_dir, exist_ok=True)
                file_prefix = f"{episode_num:02d}_{folder_name}"
            else:
                episode_dir = base_dir
                file_prefix = f"{episode_num:03d}"

            result.episode_folders.append(episode_dir)

            log(f"[{episode_num}] {ep.title} - 이미지 목록 조회 중...")
            image_urls = get_image_list_wfwf(site_url, toon_id, list_prefix, ep.wr_id, headers)
            log(f"[{episode_num}] {ep.title} - 이미지 {len(image_urls)}개 발견")

            for i, img_url in enumerate(image_urls):
                if not img_url.strip():
                    continue
                file_name = f"{file_prefix}_{i + 1:03d}"
                ok = download_image(episode_dir, file_name, img_url, headers, log=log)
                if ok:
                    result.images_downloaded += 1
                else:
                    result.images_failed += 1

            result.episodes_processed += 1

    return result


def download_image(save_path: str, file_name: str, url: str, headers: dict, log: LogFn = _noop_log) -> bool:
    """Download one image to ``{save_path}{file_name}.jpg``. Returns True on success."""
    file_path = os.path.join(save_path, f"{file_name}.jpg")
    if os.path.exists(file_path) and os.path.getsize(file_path) > MIN_VALID_FILE_SIZE:
        return True  # already downloaded

    for attempt in range(1, MAX_DOWNLOAD_RETRIES + 1):
        try:
            resp = requests.get(url.strip(), headers=headers, timeout=5)
            resp.raise_for_status()
            with open(file_path, "wb") as f:
                f.write(resp.content)
            return True
        except Exception as exc:  # noqa: BLE001 - network calls can fail in many ways
            log(f"  다운로드 실패 ({attempt}/{MAX_DOWNLOAD_RETRIES}): {file_name} - {exc}")
            time.sleep(0.5)
    return False


def sanitize_folder_name(name: str) -> str:
    for ch in '?:*"<>|':
        name = name.replace(ch, "")
    return name.strip()


def crawl_toon(
    site_url: str,
    toon_id: int,
    title: str,
    download_root: str,
    start_page: int,
    end_page: int,
    separate_folders: bool,
    log: LogFn = _noop_log,
    should_stop: Optional[Callable[[], bool]] = None,
) -> CrawlResult:
    """Crawl pages ``start_page..end_page`` (inclusive) for ``toon_id`` and download all images.

    Pages are walked from ``end_page`` down to ``start_page`` and each page's episode list is
    reversed before downloading, matching the source site's "oldest first" numbering used by
    the original script.
    """
    headers = headers_for(site_url)
    base_dir = os.path.join(download_root, sanitize_folder_name(title))
    os.makedirs(base_dir, exist_ok=True)

    result = CrawlResult()
    episode_num = 0

    pages = list(range(end_page, start_page - 1, -1))
    for page_no in pages:
        if should_stop and should_stop():
            log("사용자 요청으로 중단되었습니다.")
            break

        log(f"페이지 {page_no} 목록을 가져오는 중...")
        episodes = get_episode_list(site_url, toon_id, page_no, headers)
        if not episodes:
            log(f"페이지 {page_no}: 회차 없음")
            continue

        for ep in reversed(episodes):
            if should_stop and should_stop():
                log("사용자 요청으로 중단되었습니다.")
                break

            episode_num += 1
            folder_name = sanitize_folder_name(ep.title)

            if separate_folders:
                episode_dir = os.path.join(base_dir, f"{episode_num:02d}_{folder_name}")
                os.makedirs(episode_dir, exist_ok=True)
                file_prefix = f"{episode_num:02d}_{folder_name}"
            else:
                episode_dir = base_dir
                file_prefix = f"{episode_num:03d}"

            result.episode_folders.append(episode_dir)

            log(f"[{episode_num}] {ep.title} - 이미지 목록 조회 중...")
            image_urls = get_image_list(site_url, toon_id, ep.wr_id, headers)
            log(f"[{episode_num}] {ep.title} - 이미지 {len(image_urls)}개 발견")

            for i, img_url in enumerate(image_urls):
                if not img_url.strip():
                    continue
                file_name = f"{file_prefix}_{i + 1:03d}"
                ok = download_image(episode_dir, file_name, img_url, headers, log=log)
                if ok:
                    result.images_downloaded += 1
                else:
                    result.images_failed += 1

            result.episodes_processed += 1

    return result


def zip_directory(source_dir: str, zip_path: str, log: LogFn = _noop_log) -> str:
    """Zip ``source_dir`` (recursively) into ``zip_path`` using stdlib zipfile."""
    log(f"압축 생성 중: {zip_path}")
    os.makedirs(os.path.dirname(zip_path), exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _dirs, files in os.walk(source_dir):
            for fname in files:
                full_path = os.path.join(root, fname)
                arcname = os.path.relpath(full_path, start=os.path.dirname(source_dir))
                zf.write(full_path, arcname)
    log("압축 완료")
    return zip_path
