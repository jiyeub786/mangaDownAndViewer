"""보유 작품 DB — 이미 가진 hitomi 작품을 갤러리 ID·작가명으로 기록/조회한다.

- 초기 DB: ``python -m app.owned "<폴더>"`` 로 폴더를 1회 스캔해 생성 (이미 있으면 거부)
- 이후: hitomi 다운로드 성공 시 ``add()``로 APPEND — 폴더는 다시 읽지 않음
- 저장: ``downloads/_owned.json`` (원자적 저장)
"""

from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
from typing import Dict, List, Optional

DOWNLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "downloads")
DB_PATH = os.path.join(DOWNLOAD_ROOT, "_owned.json")

_LOCK = threading.Lock()
_cache: Optional[List[dict]] = None  # 메모리 사본 — add()/seed_from()이 갱신
_index_cache: list = [None, -1, set(), {}]  # [items 객체, 건수, ids, counts] — 항목은 추가만 되므로 건수로 변경 감지

_ARTIST_RE = re.compile(r"^\s*\[([^\]]*)\]\s*")
_ID_RE = re.compile(r"\((\d{5,8})\)\s*$")


def norm_artist(name: str) -> str:
    return name.strip().lower()


def parse_name(name: str) -> Optional[dict]:
    """`[작가1, 작가2] 작품명 (ID).zip` → {id, artists, title}. 작가·ID 둘 다 없으면 None."""
    stem = re.sub(r"\.zip$", "", name, flags=re.IGNORECASE)
    artists: List[str] = []
    m = _ARTIST_RE.match(stem)
    if m:
        artists = [a.strip() for a in m.group(1).split(",") if a.strip()]
        stem = stem[m.end():]
    gallery_id = None
    m = _ID_RE.search(stem)
    if m:
        gallery_id = int(m.group(1))
        stem = stem[: m.start()]
    if not artists and gallery_id is None:
        return None
    return {"id": gallery_id, "artists": artists, "title": stem.strip()}


def _now() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def _load_locked() -> List[dict]:
    global _cache
    if _cache is None:
        try:
            with open(DB_PATH, "r", encoding="utf-8") as f:
                _cache = json.load(f).get("items", [])
        except (OSError, ValueError):
            _cache = []
    return _cache


def _save_locked(items: List[dict]) -> None:
    os.makedirs(DOWNLOAD_ROOT, exist_ok=True)
    tmp = DB_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"items": items}, f, ensure_ascii=False)
    os.replace(tmp, DB_PATH)


def db_exists() -> bool:
    return os.path.exists(DB_PATH)


def seed_from(root: str) -> int:
    """폴더를 재귀 스캔해 초기 DB 생성. 이미 DB가 있으면 거부(덮어쓰기 방지)."""
    global _cache
    with _LOCK:
        if db_exists():
            raise FileExistsError(f"이미 DB가 있습니다: {DB_PATH}")
        if not os.path.isdir(root):
            raise FileNotFoundError(f"폴더를 찾을 수 없습니다: {root}")
        items: List[dict] = []
        seen_ids = set()
        seen_keys = set()
        stamp = _now()
        for dirpath, dirnames, filenames in os.walk(root):
            keep = []
            for d in dirnames:
                entry = parse_name(d)
                if entry:  # 폴더형 작품 — 내부 이미지는 읽을 필요 없음
                    _append_seed(items, entry, seen_ids, seen_keys, stamp)
                else:
                    keep.append(d)
            dirnames[:] = keep
            for fn in filenames:
                if fn.lower().endswith(".zip"):
                    entry = parse_name(fn)
                    if entry:
                        _append_seed(items, entry, seen_ids, seen_keys, stamp)
        _save_locked(items)
        _cache = items
        return len(items)


def _append_seed(items: List[dict], entry: dict, seen_ids: set, seen_keys: set, stamp: str) -> None:
    if entry["id"] is not None:
        if entry["id"] in seen_ids:
            return
        seen_ids.add(entry["id"])
    else:
        key = (tuple(norm_artist(a) for a in entry["artists"]), entry["title"])
        if key in seen_keys:
            return
        seen_keys.add(key)
    items.append({**entry, "source": "seed", "added_at": stamp})


def add(gallery_id: int, artists: List[str], title: str) -> bool:
    """다운로드 성공 작품을 APPEND. 같은 ID가 이미 있으면 추가 안 함."""
    with _LOCK:
        items = _load_locked()
        if any(it.get("id") == gallery_id for it in items):
            return False
        items.append(
            {"id": gallery_id, "artists": list(artists), "title": title, "source": "download", "added_at": _now()}
        )
        _save_locked(items)
        return True


def snapshot() -> List[dict]:
    with _LOCK:
        return list(_load_locked())


def index() -> tuple[set, Dict[str, int]]:
    """(보유 ID 집합, 정규화한 작가명 → 보유 작품 수). 목록 카드마다 호출되므로 메모이즈."""
    with _LOCK:
        items = _load_locked()
        if _index_cache[0] is not items or _index_cache[1] != len(items):
            ids = set()
            counts: Dict[str, int] = {}
            for it in items:
                if it.get("id") is not None:
                    ids.add(it["id"])
                for a in {norm_artist(x) for x in it.get("artists", [])}:
                    counts[a] = counts.get(a, 0) + 1
            _index_cache[:] = [items, len(items), ids, counts]
        return _index_cache[2], _index_cache[3]


def grouped() -> List[dict]:
    """작가별 작품 목록 (작가명 오름차순). 작가 없는 항목은 `N/A`."""
    groups: Dict[str, dict] = {}
    for it in snapshot():
        for a in it.get("artists") or ["N/A"]:
            g = groups.setdefault(norm_artist(a), {"artist": a, "works": []})
            g["works"].append({"id": it.get("id"), "title": it.get("title", ""), "source": it.get("source", "")})
    return sorted(groups.values(), key=lambda g: g["artist"].lower())


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print('사용법: python -m app.owned "<스캔할 폴더>"')
        sys.exit(2)
    try:
        n = seed_from(sys.argv[1])
    except (FileExistsError, FileNotFoundError) as exc:
        print(exc)
        sys.exit(1)
    all_items = snapshot()
    print(f"DB 생성 완료: {n}건 (ID 없음 {sum(1 for i in all_items if i['id'] is None)}건) → {DB_PATH}")
