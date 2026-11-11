from typing import List, Optional

from pydantic import BaseModel, Field


class SelectedEpisode(BaseModel):
    wr_id: str
    title: str
    num: int = Field(..., ge=1, description="작품 전체(오래된 순)에서의 회차 번호 — 파일/폴더 이름에 쓰임")


class CrawlJobRequest(BaseModel):
    site_url: str = Field(..., description="사이트 기본 주소, 예: http://103.204.13.68:8905 (source=hitomi일 때는 무시됨)")
    toon_id: int = Field(..., description="만화(웹툰) 게시판 ID, URL의 is= 파라미터 값 (source=hitomi일 때는 갤러리 id)")
    title: str = Field(..., description="저장 폴더/압축 파일 이름으로 쓰일 작품 제목")
    start_page: int = Field(1, ge=1, description="크롤링을 시작할 목록 페이지 번호 (source=hitomi일 때는 무시됨)")
    end_page: int = Field(1, ge=1, description="크롤링을 마칠 목록 페이지 번호, start_page 이상 (source=hitomi일 때는 무시됨)")
    separate_folders: bool = Field(True, description="회차별로 폴더를 나눌지 여부 (source=hitomi일 때는 무시됨)")
    make_zip: bool = Field(True, description="완료 후 zip으로 압축할지 여부")
    source: str = Field("site2", description="크롤링 대상 사이트 종류: site2(11툰) | wfwf(늑대닷컴) | hitomi(hitomi.la)")
    list_prefix: Optional[str] = Field(None, description="wfwf(늑대닷컴) 전용 — 목록/상세 URL 계열: list | cl")
    episodes: Optional[List[SelectedEpisode]] = Field(
        None, description="이 회차들만 다운로드(GET /api/episodes/all 결과에서 고른 것). 지정하면 start_page/end_page는 무시됨"
    )


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
