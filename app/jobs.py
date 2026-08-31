"""In-memory crawl job registry + worker execution.

Jobs run in a background thread (via FastAPI's default threadpool executor through
``BackgroundTasks``). State lives in a single process-wide dict, which is fine for a
personal/self-hosted tool but does not survive a server restart and is not shared
across multiple worker processes.
"""
from __future__ import annotations

import os
import threading
import time
import uuid
from typing import Dict, Optional

from . import crawler
from .models import CrawlJobRequest, JobStatus

DOWNLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "downloads")
MAX_LOG_LINES = 500


class Job:
    def __init__(self, request: CrawlJobRequest):
        self.id = str(uuid.uuid4())
        self.request = request
        self.status = "pending"
        self.logs: list[str] = []
        self.episodes_processed = 0
        self.images_downloaded = 0
        self.images_failed = 0
        self.error: Optional[str] = None
        self.zip_path: Optional[str] = None
        self.created_at = time.time()
        self.updated_at = time.time()
        self._stop_requested = False
        self._lock = threading.Lock()

    def log(self, message: str) -> None:
        with self._lock:
            self.logs.append(message)
            if len(self.logs) > MAX_LOG_LINES:
                self.logs = self.logs[-MAX_LOG_LINES:]
            self.updated_at = time.time()

    def request_stop(self) -> None:
        self._stop_requested = True

    def should_stop(self) -> bool:
        return self._stop_requested

    @property
    def zip_ready(self) -> bool:
        return bool(self.zip_path and os.path.exists(self.zip_path))

    def to_status(self) -> JobStatus:
        with self._lock:
            logs_copy = list(self.logs)
        return JobStatus(
            id=self.id,
            status=self.status,
            title=self.request.title,
            request=self.request,
            logs=logs_copy,
            episodes_processed=self.episodes_processed,
            images_downloaded=self.images_downloaded,
            images_failed=self.images_failed,
            error=self.error,
            zip_ready=self.zip_ready,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


_JOBS: Dict[str, Job] = {}
_JOBS_LOCK = threading.Lock()


def create_job(request: CrawlJobRequest) -> Job:
    job = Job(request)
    with _JOBS_LOCK:
        _JOBS[job.id] = job
    return job


def get_job(job_id: str) -> Optional[Job]:
    with _JOBS_LOCK:
        return _JOBS.get(job_id)


def list_jobs() -> list[Job]:
    with _JOBS_LOCK:
        jobs = list(_JOBS.values())
    return sorted(jobs, key=lambda j: j.created_at, reverse=True)


def run_job(job_id: str) -> None:
    job = get_job(job_id)
    if job is None:
        return

    job.status = "running"
    job.log(f"크롤링 시작: {job.request.title} (toon_id={job.request.toon_id})")

    try:
        if job.request.source == "wfwf":
            result = crawler.crawl_toon_wfwf(
                site_url=job.request.site_url.rstrip("/"),
                toon_id=job.request.toon_id,
                list_prefix=job.request.list_prefix or "list",
                title=job.request.title,
                download_root=DOWNLOAD_ROOT,
                start_page=job.request.start_page,
                end_page=job.request.end_page,
                separate_folders=job.request.separate_folders,
                log=job.log,
                should_stop=job.should_stop,
            )
        else:
            result = crawler.crawl_toon(
                site_url=job.request.site_url.rstrip("/"),
                toon_id=job.request.toon_id,
                title=job.request.title,
                download_root=DOWNLOAD_ROOT,
                start_page=job.request.start_page,
                end_page=job.request.end_page,
                separate_folders=job.request.separate_folders,
                log=job.log,
                should_stop=job.should_stop,
            )
        job.episodes_processed = result.episodes_processed
        job.images_downloaded = result.images_downloaded
        job.images_failed = result.images_failed

        if job.should_stop():
            job.status = "stopped"
        else:
            if job.request.make_zip:
                source_dir = os.path.join(DOWNLOAD_ROOT, crawler.sanitize_folder_name(job.request.title))
                zip_path = os.path.join(DOWNLOAD_ROOT, "_zips", f"{crawler.sanitize_folder_name(job.request.title)}.zip")
                job.zip_path = crawler.zip_directory(source_dir, zip_path, log=job.log)
            job.status = "completed"
            job.log(
                f"완료: 회차 {job.episodes_processed}개, 이미지 {job.images_downloaded}개 성공"
                f"{f', {job.images_failed}개 실패' if job.images_failed else ''}"
            )
    except Exception as exc:  # noqa: BLE001 - surface any crawl failure to the UI
        job.status = "failed"
        job.error = str(exc)
        job.log(f"오류 발생: {exc}")
