import os
from urllib.parse import quote

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import requests

from . import jobs, library, online
from . import crawler
from .crawler import sanitize_folder_name
from .models import CrawlJobRequest, JobStatus

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DOWNLOAD_ROOT = jobs.DOWNLOAD_ROOT
os.makedirs(DOWNLOAD_ROOT, exist_ok=True)

app = FastAPI(title="온라인만화뷰어", description="만화 사이트 이미지 크롤러 웹 앱")


@app.post("/api/jobs", response_model=JobStatus)
def create_job(request: CrawlJobRequest, background_tasks: BackgroundTasks) -> JobStatus:
    if request.end_page < request.start_page:
        raise HTTPException(400, "end_page는 start_page보다 크거나 같아야 합니다.")

    job = jobs.create_job(request)
    background_tasks.add_task(jobs.run_job, job.id)
    return job.to_status()


@app.get("/api/jobs", response_model=list[JobStatus])
def get_jobs() -> list[JobStatus]:
    return [j.to_status() for j in jobs.list_jobs()]


@app.get("/api/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str) -> JobStatus:
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(404, "존재하지 않는 작업입니다.")
    return job.to_status()


@app.post("/api/jobs/{job_id}/stop", response_model=JobStatus)
def stop_job(job_id: str) -> JobStatus:
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(404, "존재하지 않는 작업입니다.")
    job.request_stop()
    job.log("중단 요청을 받았습니다...")
    return job.to_status()


@app.get("/api/jobs/{job_id}/download")
def download_job_zip(job_id: str):
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(404, "존재하지 않는 작업입니다.")
    if not job.zip_ready:
        raise HTTPException(409, "아직 압축 파일이 준비되지 않았습니다.")
    file_name = f"{sanitize_folder_name(job.request.title)}.zip"
    return FileResponse(job.zip_path, filename=file_name, media_type="application/zip")


@app.get("/api/search")
def search_titles(site_url: str, query: str) -> list[dict]:
    query = query.strip()
    if not query:
        return []
    site_url = site_url.rstrip("/")
    headers = crawler.headers_for(site_url)
    try:
        results = crawler.search_titles(site_url, query, headers)
    except requests.RequestException as exc:
        raise HTTPException(502, f"검색 요청에 실패했습니다: {exc}")
    except ValueError:
        raise HTTPException(502, "사이트 응답을 해석할 수 없습니다 (JSON 형식이 아님).")
    return [{"id": r.id, "title": r.title, "tags": r.tags, "description": r.description} for r in results]


@app.get("/api/online/episodes")
def get_online_episodes(site_url: str, toon_id: int, page: int = 1, source: str = "site2", list_prefix: str = "") -> dict:
    site_url = site_url.rstrip("/")
    try:
        episodes = online.list_episodes(site_url, toon_id, page, source=source, list_prefix=list_prefix)
    except requests.RequestException as exc:
        raise HTTPException(502, f"회차 목록 요청에 실패했습니다: {exc}")
    return {"page": page, "episodes": [{"wr_id": e.wr_id, "title": e.title, "date": e.date} for e in episodes]}


@app.get("/api/online/images")
def get_online_images(site_url: str, toon_id: int, wr_id: str, source: str = "site2", list_prefix: str = "") -> dict:
    site_url = site_url.rstrip("/")
    try:
        images = online.list_episode_images(site_url, toon_id, wr_id, source=source, list_prefix=list_prefix)
    except requests.RequestException as exc:
        raise HTTPException(502, f"이미지 목록 요청에 실패했습니다: {exc}")
    if source == "wfwf":
        # 늑대닷컴(wfwf)'s image CDNs hotlink-block a bare <img src> pointed straight
        # at them (confirmed: browser requests came back 503) — our backend's requests
        # calls work because they set a Referer header manually (same as the download
        # path), so route each image through the proxy below instead of linking to
        # the CDN directly. 11툰(site2)'s CDN doesn't enforce this, so it's untouched.
        images = [
            f"/api/wfwf/image-proxy?site_url={quote(site_url, safe='')}&url={quote(img, safe='')}" for img in images
        ]
    return {"wr_id": wr_id, "images": images}


@app.get("/api/wfwf/image-proxy")
def wfwf_image_proxy(url: str, site_url: str):
    headers = crawler.headers_for(site_url)
    try:
        resp = requests.get(url, headers=headers, timeout=10, stream=True)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"이미지 요청에 실패했습니다: {exc}")
    return StreamingResponse(resp.iter_content(65536), media_type=resp.headers.get("content-type", "image/jpeg"))


@app.get("/api/wfwf/search")
def search_titles_wfwf(site_url: str, query: str) -> list[dict]:
    query = query.strip()
    if not query:
        return []
    site_url = site_url.rstrip("/")
    headers = crawler.headers_for(site_url)
    try:
        results = crawler.search_titles_wfwf(site_url, query, headers)
    except requests.RequestException as exc:
        raise HTTPException(502, f"검색 요청에 실패했습니다: {exc}")
    return [
        {"id": r.id, "title": r.title, "tags": r.tags, "description": r.description, "list_prefix": r.list_prefix}
        for r in results
    ]


@app.get("/api/library")
def get_library() -> list[dict]:
    try:
        titles = library.list_titles(DOWNLOAD_ROOT)
    except library.InvalidPath:
        raise HTTPException(400, "잘못된 경로입니다.")
    return [
        {
            "title": t.title,
            "episode_count": t.episode_count,
            "image_count": t.image_count,
            "cover_url": t.cover_url,
            "updated_at": t.updated_at,
        }
        for t in titles
    ]


@app.get("/api/library/{title}")
def get_library_title(title: str) -> dict:
    try:
        episodes = library.get_title_detail(DOWNLOAD_ROOT, title)
    except library.InvalidPath:
        raise HTTPException(400, "잘못된 경로입니다.")
    if episodes is None:
        raise HTTPException(404, "존재하지 않는 작품입니다.")
    return {
        "title": title,
        "episodes": [
            {"id": e.id, "name": e.name, "image_count": e.image_count, "cover_url": e.cover_url}
            for e in episodes
        ],
    }


@app.get("/api/library/{title}/episodes/{episode_id}/images")
def get_library_episode_images(title: str, episode_id: str) -> dict:
    try:
        images = library.get_episode_images(DOWNLOAD_ROOT, title, episode_id)
    except library.InvalidPath:
        raise HTTPException(400, "잘못된 경로입니다.")
    if images is None:
        raise HTTPException(404, "존재하지 않는 회차입니다.")
    return {"title": title, "episode_id": episode_id, "images": images}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


# CSS/JS assets, mounted under /static so they don't shadow the API routes above.
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Downloaded images themselves, served read-only for the in-browser viewer.
app.mount("/files", StaticFiles(directory=DOWNLOAD_ROOT), name="files")
