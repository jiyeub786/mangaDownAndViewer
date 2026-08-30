"""Read-only scanner over the downloads/ directory for the in-browser viewer.

Two on-disk layouts have to be supported, matching the two modes ``crawler.crawl_toon``
can produce:

- **폴더형** (``separate_folders=True``): ``downloads/{title}/{episode_folder}/*.jpg``
  Each subdirectory of a title is one episode.
- **평면형** (``separate_folders=False``): ``downloads/{title}/*.jpg``, filenames like
  ``001_001.jpg``, ``001_002.jpg``, ``002_001.jpg`` (episode number is baked into the
  filename prefix instead of a folder). We regroup those by that numeric prefix so the
  viewer still shows one "episode" per chapter instead of one giant image wall.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import List, Optional
from urllib.parse import quote

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
FLAT_PREFIX_RE = re.compile(r"^(\d+)_(\d+)$")


def _natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


class InvalidPath(Exception):
    pass


def _safe_join(base: str, *parts: str) -> str:
    """Join parts onto base and guarantee the result stays inside base (no ``..`` escapes)."""
    target = os.path.normpath(os.path.join(base, *parts))
    base_real = os.path.realpath(base)
    target_real = os.path.realpath(target)
    if target_real != base_real and not target_real.startswith(base_real + os.sep):
        raise InvalidPath(f"경로를 벗어난 접근입니다: {parts}")
    return target


def _list_image_files(dir_path: str) -> List[str]:
    if not os.path.isdir(dir_path):
        return []
    files = [f for f in os.listdir(dir_path) if os.path.splitext(f)[1].lower() in IMAGE_EXTS]
    files.sort(key=_natural_key)
    return files


def _file_url(download_root: str, *parts: str) -> str:
    real_parts = [p for p in parts if p]
    return "/files/" + "/".join(quote(p) for p in real_parts)


@dataclass
class EpisodeInfo:
    id: str
    name: str
    image_count: int
    cover_url: Optional[str] = None


@dataclass
class TitleInfo:
    title: str
    episode_count: int
    image_count: int
    cover_url: Optional[str] = None
    updated_at: float = 0.0


def list_titles(download_root: str) -> List[TitleInfo]:
    if not os.path.isdir(download_root):
        return []

    names = [
        n for n in os.listdir(download_root)
        if n != "_zips" and os.path.isdir(os.path.join(download_root, n))
    ]
    names.sort(key=_natural_key)

    result = []
    for name in names:
        episodes = _episodes_for_title(download_root, name)
        image_count = sum(ep.image_count for ep in episodes)
        cover = episodes[0].cover_url if episodes else None
        try:
            updated_at = os.path.getmtime(os.path.join(download_root, name))
        except OSError:
            updated_at = 0.0
        result.append(
            TitleInfo(
                title=name,
                episode_count=len(episodes),
                image_count=image_count,
                cover_url=cover,
                updated_at=updated_at,
            )
        )
    return result


def _episodes_for_title(download_root: str, title: str) -> List[EpisodeInfo]:
    """Build the episode list for one title, handling both on-disk layouts."""
    title_dir = _safe_join(download_root, title)
    if not os.path.isdir(title_dir):
        return []

    subdirs = sorted(
        (n for n in os.listdir(title_dir) if os.path.isdir(os.path.join(title_dir, n))),
        key=_natural_key,
    )

    if subdirs:
        episodes = []
        for sub in subdirs:
            images = _list_image_files(os.path.join(title_dir, sub))
            if not images:
                continue
            cover = _file_url(download_root, title, sub, images[0])
            episodes.append(EpisodeInfo(id=sub, name=sub, image_count=len(images), cover_url=cover))
        return episodes

    # flat layout: regroup loose files by their numeric filename prefix
    flat_images = _list_image_files(title_dir)
    groups: dict[str, list[str]] = {}
    fallback: list[str] = []
    for fname in flat_images:
        stem = os.path.splitext(fname)[0]
        m = FLAT_PREFIX_RE.match(stem)
        if m:
            groups.setdefault(m.group(1), []).append(fname)
        else:
            fallback.append(fname)

    episodes = []
    for group_id in sorted(groups.keys(), key=_natural_key):
        images = sorted(groups[group_id], key=_natural_key)
        cover = _file_url(download_root, title, images[0])
        episodes.append(EpisodeInfo(id=group_id, name=f"{group_id}화", image_count=len(images), cover_url=cover))

    if fallback:
        cover = _file_url(download_root, title, fallback[0])
        episodes.append(EpisodeInfo(id="_all_", name="전체", image_count=len(fallback), cover_url=cover))

    return episodes


def get_title_detail(download_root: str, title: str) -> Optional[List[EpisodeInfo]]:
    title_dir = _safe_join(download_root, title)
    if not os.path.isdir(title_dir):
        return None
    return _episodes_for_title(download_root, title)


def get_episode_images(download_root: str, title: str, episode_id: str) -> Optional[List[str]]:
    """Return the ordered image URLs for one episode, or None if the episode doesn't exist."""
    title_dir = _safe_join(download_root, title)
    if not os.path.isdir(title_dir):
        return None

    episode_dir = os.path.join(title_dir, episode_id)
    if os.path.isdir(episode_dir):
        images = _list_image_files(episode_dir)
        return [_file_url(download_root, title, episode_id, f) for f in images]

    # flat layout: rebuild this episode's file list from the regrouped info
    for ep in _episodes_for_title(download_root, title):
        if ep.id != episode_id:
            continue
        flat_images = _list_image_files(title_dir)
        if episode_id == "_all_":
            stem_matches = [f for f in flat_images if not FLAT_PREFIX_RE.match(os.path.splitext(f)[0])]
        else:
            stem_matches = [
                f for f in flat_images
                if (m := FLAT_PREFIX_RE.match(os.path.splitext(f)[0])) and m.group(1) == episode_id
            ]
        stem_matches.sort(key=_natural_key)
        return [_file_url(download_root, title, f) for f in stem_matches]

    return None
