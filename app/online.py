"""Read-only live browsing of the target site — no downloads, no filesystem writes.

Backs the "온라인 보기" tab, which lets the user search/browse/read manga straight from
the source site without saving anything locally. Kept deliberately separate from the
download job pipeline (`crawler.crawl_toon` / `app/jobs.py`): nothing in this module
creates a job, writes a file, or touches `downloads/`. It does reuse `crawler.py`'s
site-parsing primitives (`get_episode_list`, `get_image_list`, `headers_for`) since
those are pure fetch-and-parse functions with no side effects — sharing them is just
reuse of a stateless HTTP/HTML utility, not a merge of the two features.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

from . import crawler


@dataclass
class OnlineEpisode:
    wr_id: str
    title: str
    date: str


def list_episodes(site_url: str, toon_id: int, page: int) -> List[OnlineEpisode]:
    """One listing page's episodes, in the site's own on-page order (newest first).

    Unlike `crawler.crawl_toon`, this does not reverse or renumber episodes — the
    online tab is for browsing the site as it presents itself, not producing a
    sequentially-numbered downloaded set.
    """
    site_url = site_url.rstrip("/")
    headers = crawler.headers_for(site_url)
    episodes = crawler.get_episode_list(site_url, toon_id, page, headers)
    return [OnlineEpisode(wr_id=e.wr_id, title=e.title, date=e.date) for e in episodes]


def list_episode_images(site_url: str, toon_id: int, wr_id: str) -> List[str]:
    """Image URLs for one episode, straight from the source site (no local copy)."""
    site_url = site_url.rstrip("/")
    headers = crawler.headers_for(site_url)
    return crawler.get_image_list(site_url, toon_id, wr_id, headers)
