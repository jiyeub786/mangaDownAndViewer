from typing import List, Optional

from pydantic import BaseModel, Field


class CrawlJobRequest(BaseModel):
    site_url: str = Field(..., description="사이트 기본 주소, 예: http://103.204.13.68:8905")
    toon_id: int = Field(..., description="만화(웹툰) 게시판 ID, URL의 is= 파라미터 값")
    title: str = Field(..., description="저장 폴더/압축 파일 이름으로 쓰일 작품 제목")
    start_page: int = Field(1, ge=1, description="크롤링을 시작할 목록 페이지 번호")
    end_page: int = Field(1, ge=1, description="크롤링을 마칠 목록 페이지 번호 (start_page 이상)")
    separate_folders: bool = Field(True, description="회차별로 폴더를 나눌지 여부")
    make_zip: bool = Field(True, description="완료 후 zip으로 압축할지 여부")


class JobStatus(BaseModel):
    id: str
    status: str  # pending | running | completed | failed | stopped
    title: str
    request: CrawlJobRequest
    logs: List[str]
    episodes_processed: int = 0
    images_downloaded: int = 0
    images_failed: int = 0
    error: Optional[str] = None
    zip_ready: bool = False
    created_at: float
    updated_at: float
