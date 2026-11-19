"""onejav 탭 — 사이트를 직접 조회하지 않는다.

onejav.com은 Cloudflare 봇 차단으로 서버(requests) 요청을 전부 403으로 막는다.
그래서 사용자가 자기 브라우저에서 Onejav 페이지를 연 채 "수집" 북마크
(static/app.js의 onejavCollector)를 누르면 그 페이지의 작품 카드를 읽어 보내
주고(ingest), 여기서는 그걸 JSON 파일 하나에 쌓아 두고 조회만 한다.
"""

import json
import os
import threading
from datetime import datetime

from pydantic import BaseModel


class OnejavItem(BaseModel):
    code: str
    date: str = ""  # YYYY-MM-DD
    size: str = ""
    description: str = ""
    actresses: list[str] = []
    tags: list[str] = []
    image_url: str = ""
    torrent_url: str = ""
    page_url: str = ""


_LOCK = threading.Lock()


def kind_of(code: str) -> str:
    # 사이트 자체 필터(?jav=1 / ?amateur=1)와 같은 기준 — FC2만 amateur.
    # (Amateur 태그는 SIRO·300MIUM 같은 MGS 계열에도 붙지만 사이트는 그걸 JAV로 분류한다.)
    # 조회할 때마다 계산하므로 기준을 바꿔도 다시 수집할 필요가 없다.
    return "amateur" if code.startswith("FC2") else "jav"


def _load(store_path: str) -> dict:
    if not os.path.exists(store_path):
        return {}
    with open(store_path, encoding="utf-8") as f:
        return json.load(f)


def _http_url(url: str) -> str:
    # 프런트가 이 값을 그대로 href/src에 넣으므로 http(s) 주소만 통과시킨다.
    return url if url.startswith(("http://", "https://")) else ""


def ingest(store_path: str, items: list[OnejavItem]) -> dict:
    now = datetime.now().isoformat(timespec="seconds")
    added = 0
    with _LOCK:
        store = _load(store_path)
        for item in items:
            code = item.code.strip().upper()
            if not code:
                continue
            if code not in store:
                added += 1
            data = item.model_dump()
            data["code"] = code
            for key in ("image_url", "torrent_url", "page_url"):
                data[key] = _http_url(data[key])
            data["collected_at"] = now
            store[code] = data
        os.makedirs(os.path.dirname(store_path), exist_ok=True)
        tmp_path = store_path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(store, f, ensure_ascii=False)
        os.replace(tmp_path, store_path)
    return {"received": len(items), "added": added, "total": len(store)}


def query(
    store_path: str,
    date: str = "",
    q: str = "",
    kinds: list[str] | None = None,
    tags: list[str] | None = None,
    tag_mode: str = "all",
    exclude_tags: list[str] | None = None,
    has_actress: bool = False,
    all_dates: bool = False,
    sort: str = "",
    date_from: str = "",
    date_to: str = "",
) -> dict:
    with _LOCK:
        store = _load(store_path)
    items = list(store.values())
    for item in items:
        item["kind"] = kind_of(item["code"])

    # 날짜·태그 목록은 조건과 무관하게 수집된 전체 기준(화면의 선택지용).
    date_counts: dict[str, int] = {}
    tag_counts: dict[str, int] = {}
    for item in items:
        date_counts[item["date"]] = date_counts.get(item["date"], 0) + 1
        for tag in item["tags"]:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    dates = [{"date": d, "count": date_counts[d]} for d in sorted(date_counts, reverse=True)]
    tag_list = [{"tag": t, "count": c} for t, c in sorted(tag_counts.items(), key=lambda kv: (-kv[1], kv[0]))]

    q = q.strip().lower()
    ranged = bool(date_from or date_to)
    if ranged:
        # 날짜 범위(양끝 포함, YYYY-MM-DD 문자열 비교) — 단일 날짜 선택·전체 날짜 설정보다 우선.
        date = ""
        items = [
            i
            for i in items
            if i["date"]
            and (not date_from or i["date"] >= date_from)
            and (not date_to or i["date"] <= date_to)
        ]
        if q:
            items = [
                i
                for i in items
                if q in i["code"].lower()
                or any(q in a.lower() for a in i["actresses"])
                or any(q in t.lower() for t in i["tags"])
            ]
    elif q:
        # 검색은 날짜와 무관하게 수집된 전체에서 찾는다.
        date = ""
        items = [
            i
            for i in items
            if q in i["code"].lower()
            or any(q in a.lower() for a in i["actresses"])
            or any(q in t.lower() for t in i["tags"])
        ]
    elif all_dates:
        date = ""
    else:
        if not date and dates:
            date = dates[0]["date"]
        items = [i for i in items if i["date"] == date]

    if kinds is not None:
        items = [i for i in items if i["kind"] in kinds]
    if tags:
        wanted = set(tags)
        if tag_mode == "any":
            items = [i for i in items if wanted & set(i["tags"])]
        else:
            items = [i for i in items if wanted <= set(i["tags"])]
    if exclude_tags:
        unwanted = set(exclude_tags)
        items = [i for i in items if not unwanted & set(i["tags"])]
    if has_actress:
        items = [i for i in items if i["actresses"]]

    items.sort(key=lambda i: i["code"])
    if sort == "actress":
        # 첫 번째 배우명 오름차순, 배우명이 없는 작품은 맨 뒤 (같은 배우 안에서는 품번순).
        items.sort(key=lambda i: (not i["actresses"], i["actresses"][0].casefold() if i["actresses"] else ""))
    elif sort != "code":
        items.sort(key=lambda i: i["date"], reverse=True)
    return {"date": date, "dates": dates, "tags": tag_list, "total": len(store), "items": items}
