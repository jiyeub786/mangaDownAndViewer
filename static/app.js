const jobForm = document.getElementById("job-form");
const submitBtn = document.getElementById("submit-btn");
const jobListEl = document.getElementById("job-list");

const STATUS_LABEL = {
  pending: "대기중",
  running: "진행중",
  completed: "완료",
  failed: "실패",
  stopped: "중단됨",
};

let jobsCache = [];
let pollTimer = null;

jobForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const startPage = Number(document.getElementById("start_page").value);
  const endPage = Number(document.getElementById("end_page").value);
  if (endPage < startPage) {
    alert("끝 페이지는 시작 페이지보다 크거나 같아야 합니다.");
    return;
  }

  const payload = {
    site_url: document.getElementById("site_url").value.trim(),
    toon_id: Number(document.getElementById("toon_id").value),
    title: document.getElementById("title").value.trim(),
    start_page: startPage,
    end_page: endPage,
    separate_folders: document.getElementById("separate_folders").checked,
    make_zip: document.getElementById("make_zip").checked,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "시작하는 중...";

  try {
    const resp = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `요청 실패 (${resp.status})`);
    }
    await refreshJobs();
  } catch (err) {
    alert(`작업 시작 실패: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "다운로드 시작";
  }
});

async function refreshJobs() {
  try {
    const resp = await fetch("/api/jobs");
    if (!resp.ok) return;
    jobsCache = await resp.json();
    renderJobs();
  } catch (err) {
    // network hiccup during polling; ignore and retry on next tick
  }
}

function renderJobs() {
  if (jobsCache.length === 0) {
    jobListEl.innerHTML = '<div class="empty-state">아직 시작한 작업이 없습니다.</div>';
    return;
  }

  jobListEl.innerHTML = jobsCache.map(renderJobCard).join("");

  jobsCache.forEach((job) => {
    const logEl = document.getElementById(`log-${job.id}`);
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  });

  jobListEl.querySelectorAll("[data-stop]").forEach((btn) => {
    btn.addEventListener("click", () => stopJob(btn.getAttribute("data-stop")));
  });
}

function renderJobCard(job) {
  const badgeClass = `badge-${job.status}`;
  const statusLabel = STATUS_LABEL[job.status] || job.status;
  const logsHtml = job.logs.map((line) => `<div class="line">${escapeHtml(line)}</div>`).join("");

  const canStop = job.status === "pending" || job.status === "running";
  const canDownload = job.zip_ready;

  return `
    <div class="card job-card">
      <div class="job-head">
        <div class="job-title">${escapeHtml(job.title)}</div>
        <span class="badge ${badgeClass}">${statusLabel}</span>
      </div>
      <div class="job-stats">
        <div><span class="stat-label">회차</span>${job.episodes_processed}</div>
        <div><span class="stat-label">다운로드</span><span class="stat-up">${job.images_downloaded}</span></div>
        <div><span class="stat-label">실패</span><span class="stat-down">${job.images_failed}</span></div>
      </div>
      <div class="job-log" id="log-${job.id}">${logsHtml || '<div class="line">대기 중...</div>'}</div>
      <div class="job-actions">
        ${canDownload ? `<a class="btn btn-primary btn-sm" style="width:auto;" href="/api/jobs/${job.id}/download">zip 다운로드</a>` : ""}
        ${canStop ? `<button type="button" class="btn btn-danger btn-sm" data-stop="${job.id}">중단</button>` : ""}
      </div>
      ${job.error ? `<div style="color:var(--down); font-size:12px; margin-top:8px;">오류: ${escapeHtml(job.error)}</div>` : ""}
    </div>
  `;
}

async function stopJob(jobId) {
  await fetch(`/api/jobs/${jobId}/stop`, { method: "POST" });
  await refreshJobs();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshJobs, 2000);
}

refreshJobs();
startPolling();

/* ==================== 작품 검색 (다운로드 탭) ==================== */

const searchQueryInput = document.getElementById("search-query");
const searchBtn = document.getElementById("search-btn");
const searchResultsEl = document.getElementById("search-results");

searchBtn.addEventListener("click", runTitleSearch);
searchQueryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    runTitleSearch();
  }
});

async function runTitleSearch() {
  const siteUrl = document.getElementById("site_url").value.trim();
  const query = searchQueryInput.value.trim();

  if (!siteUrl) {
    searchResultsEl.innerHTML = '<div class="empty-state">먼저 위 폼의 "사이트 주소"를 입력하세요.</div>';
    return;
  }
  if (!query) {
    searchResultsEl.innerHTML = '<div class="empty-state">검색어를 입력하세요.</div>';
    return;
  }

  searchBtn.disabled = true;
  searchResultsEl.innerHTML = '<div class="empty-state">검색 중...</div>';

  try {
    const resp = await fetch(`/api/search?site_url=${encodeURIComponent(siteUrl)}&query=${encodeURIComponent(query)}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `요청 실패 (${resp.status})`);
    }
    const results = await resp.json();
    renderSearchResults(results);
  } catch (err) {
    searchResultsEl.innerHTML = `<div class="empty-state">검색 실패: ${escapeHtml(err.message)}</div>`;
  } finally {
    searchBtn.disabled = false;
  }
}

function renderSearchResults(results) {
  if (results.length === 0) {
    searchResultsEl.innerHTML = '<div class="empty-state">검색 결과가 없습니다.</div>';
    return;
  }

  searchResultsEl.innerHTML = results
    .map(
      (r) => `
        <button type="button" class="search-result-item" data-result-id="${r.id}" data-result-title="${escapeAttr(r.title)}">
          <div class="search-result-title">${escapeHtml(r.title)}</div>
          <div class="search-result-tags">ID ${r.id}${r.tags ? " &middot; " + escapeHtml(r.tags) : ""}</div>
        </button>
      `
    )
    .join("");

  searchResultsEl.querySelectorAll("[data-result-id]").forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("toon_id").value = el.getAttribute("data-result-id");
      document.getElementById("title").value = el.getAttribute("data-result-title");
      document.getElementById("title").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

/* ==================== 뷰어 탭 ==================== */

const tabButtons = document.querySelectorAll(".tab-btn");
const panelDownload = document.getElementById("tab-panel-download");
const panelViewer = document.getElementById("tab-panel-viewer");
const panelOnline = document.getElementById("tab-panel-online");
const viewerBody = document.getElementById("viewer-body");
const viewerBreadcrumb = document.getElementById("viewer-breadcrumb");
const onlineBody = document.getElementById("online-body");
const onlineBreadcrumb = document.getElementById("online-breadcrumb");
const viewerRefreshBtn = document.getElementById("viewer-refresh");
const viewerControls = document.getElementById("viewer-controls");
const viewerSearchInput = document.getElementById("viewer-search");
const viewerSortSelect = document.getElementById("viewer-sort");

const viewerState = {
  view: "titles", // titles | episodes | reader
  title: null,
  episodes: [], // full episode list for the currently open title
  episodeId: null, // the episode the reader was originally opened on
  activeEpisodeId: null, // episode currently in view while reading (infinite scroll)
  loadedIds: [], // episode ids appended to the reader strip so far, in order
};

let viewerLoadedOnce = false;
let allTitlesCache = [];
let titleSearchQuery = "";
let titleSortMode = "name";
let episodeSearchQuery = "";

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.getAttribute("data-tab");
    exitFullscreenIfActive();
    document.body.classList.remove("immersive");
    // Leaving a reader mid-read via the tab switch (rather than its own back/library
    // button) previously left its observers running and its `view` stuck at "reader" in
    // the background — harmless on its own, but combined with opening the other
    // reader it made both keydown listeners fire for one keypress. Tearing down here
    // closes that off regardless of which reader (if any) is currently open.
    if (tab !== "viewer") teardownReaderObservers();
    if (tab !== "online") teardownOnlineReaderObservers();
    panelDownload.hidden = tab !== "download";
    panelViewer.hidden = tab !== "viewer";
    panelOnline.hidden = tab !== "online";
    if (tab === "viewer" && !viewerLoadedOnce) {
      viewerLoadedOnce = true;
      showTitles();
    }
    if (tab === "online" && !onlineLoadedOnce) {
      onlineLoadedOnce = true;
      showOnlineSearch();
    }
  });
});

viewerRefreshBtn.addEventListener("click", () => {
  if (viewerState.view === "reader") {
    openEpisode(viewerState.title, viewerState.episodeId);
  } else if (viewerState.view === "episodes") {
    openTitle(viewerState.title);
  } else {
    showTitles();
  }
});

viewerSearchInput.addEventListener("input", () => {
  if (viewerState.view === "episodes") {
    episodeSearchQuery = viewerSearchInput.value;
    renderEpisodeGrid();
  } else {
    titleSearchQuery = viewerSearchInput.value;
    renderTitleGrid();
  }
});

viewerSortSelect.addEventListener("change", () => {
  titleSortMode = viewerSortSelect.value;
  renderTitleGrid();
});

function renderBreadcrumb() {
  const parts = [`<span class="crumb" data-crumb="titles">라이브러리</span>`];
  if (viewerState.title) {
    const isCurrentTitle = viewerState.view === "episodes";
    parts.push(`<span class="sep">/</span>`);
    parts.push(
      `<span class="crumb ${isCurrentTitle ? "current" : ""}" data-crumb="title">${escapeHtml(viewerState.title)}</span>`
    );
  }
  if (viewerState.view === "reader") {
    const activeId = viewerState.activeEpisodeId || viewerState.episodeId;
    const ep = viewerState.episodes.find((e) => e.id === activeId);
    parts.push(`<span class="sep">/</span>`);
    parts.push(`<span class="crumb current">${escapeHtml(ep ? ep.name : activeId)}</span>`);
  }
  viewerBreadcrumb.innerHTML = parts.join("");

  viewerBreadcrumb.querySelectorAll("[data-crumb='titles']").forEach((el) => {
    el.addEventListener("click", showTitles);
  });
  viewerBreadcrumb.querySelectorAll("[data-crumb='title']").forEach((el) => {
    el.addEventListener("click", () => {
      if (viewerState.title) openTitle(viewerState.title);
    });
  });
}

/* ---- 읽기 진행 상태 (localStorage) ---- */

const PROGRESS_KEY = "mangadl_progress_v1";

function loadProgressStore() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch (err) {
    return {};
  }
}

function saveProgressStore(store) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
  } catch (err) {
    // localStorage unavailable (private mode, quota, etc.) — silently skip persistence
  }
}

function getTitleProgress(title) {
  return loadProgressStore()[title] || null;
}

function updateTitleProgress(title, patch) {
  const store = loadProgressStore();
  const prev = store[title] || { readEpisodeIds: [] };
  store[title] = { ...prev, ...patch, updatedAt: Date.now() };
  saveProgressStore(store);
}

function markEpisodeRead(title, episodeId) {
  if (!episodeId) return;
  const store = loadProgressStore();
  const entry = store[title] || { readEpisodeIds: [] };
  if (!entry.readEpisodeIds.includes(episodeId)) {
    entry.readEpisodeIds = [...entry.readEpisodeIds, episodeId];
  }
  entry.updatedAt = Date.now();
  store[title] = entry;
  saveProgressStore(store);
}

function isEpisodeRead(title, episodeId) {
  const p = getTitleProgress(title);
  return !!(p && p.readEpisodeIds && p.readEpisodeIds.includes(episodeId));
}

/* ---- 작품 목록 (검색 · 정렬 · 이어보기) ---- */

async function showTitles() {
  viewerState.view = "titles";
  viewerState.title = null;
  viewerState.episodeId = null;
  viewerState.activeEpisodeId = null;
  exitFullscreenIfActive();
  document.body.classList.remove("immersive");

  titleSearchQuery = "";
  viewerSearchInput.value = "";
  viewerSearchInput.placeholder = "작품 검색";
  viewerSortSelect.hidden = false;
  viewerControls.hidden = false;

  renderBreadcrumb();
  viewerBody.innerHTML = '<div class="empty-state">불러오는 중...</div>';

  try {
    const resp = await fetch("/api/library");
    allTitlesCache = await resp.json();
    renderTitleGrid();
  } catch (err) {
    viewerBody.innerHTML = `<div class="empty-state">목록을 불러오지 못했습니다: ${escapeHtml(err.message)}</div>`;
  }
}

function renderTitleGrid() {
  if (viewerState.view !== "titles") return;

  if (allTitlesCache.length === 0) {
    viewerBody.innerHTML = '<div class="empty-state">아직 다운로드한 작품이 없습니다. "다운로드" 탭에서 먼저 받아보세요.</div>';
    return;
  }

  let list = allTitlesCache;
  const q = titleSearchQuery.trim().toLowerCase();
  if (q) list = list.filter((t) => t.title.toLowerCase().includes(q));

  list = [...list];
  if (titleSortMode === "recent") {
    list.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  } else if (titleSortMode === "images") {
    list.sort((a, b) => b.image_count - a.image_count);
  } else {
    list.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  }

  if (list.length === 0) {
    viewerBody.innerHTML = '<div class="empty-state">검색 결과가 없습니다.</div>';
    return;
  }

  viewerBody.innerHTML = `<div class="lib-grid">${list.map(renderTitleCard).join("")}</div>`;
  viewerBody.querySelectorAll("[data-open-title]").forEach((el) => {
    el.addEventListener("click", () => openTitle(el.getAttribute("data-open-title")));
  });
  viewerBody.querySelectorAll("[data-resume-title]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      resumeTitle(el.getAttribute("data-resume-title"));
    });
  });
}

function renderTitleCard(t) {
  const cover = t.cover_url
    ? `<img class="lib-cover" src="${t.cover_url}" loading="lazy" alt="${escapeHtml(t.title)}" />`
    : `<div class="lib-cover-empty">이미지 없음</div>`;
  const progress = getTitleProgress(t.title);
  const continueBtn = progress && progress.lastEpisodeId
    ? `<button type="button" class="continue-btn" data-resume-title="${escapeAttr(t.title)}">이어보기</button>`
    : "";
  return `
    <div class="lib-card" data-open-title="${escapeAttr(t.title)}">
      ${cover}
      ${continueBtn}
      <div class="lib-meta">
        <div class="lib-name">${escapeHtml(t.title)}</div>
        <div class="lib-count">${t.episode_count}화 &middot; ${t.image_count}장</div>
      </div>
    </div>
  `;
}

async function resumeTitle(title) {
  const progress = getTitleProgress(title);
  viewerState.view = "episodes";
  viewerState.title = title;
  renderBreadcrumb();
  viewerControls.hidden = true;
  viewerBody.innerHTML = '<div class="empty-state">불러오는 중...</div>';

  try {
    const resp = await fetch(`/api/library/${encodeURIComponent(title)}`);
    if (!resp.ok) throw new Error(`요청 실패 (${resp.status})`);
    const data = await resp.json();
    viewerState.episodes = data.episodes;

    let targetId = progress && progress.lastEpisodeId;
    if (!targetId || !data.episodes.some((e) => e.id === targetId)) {
      targetId = data.episodes.length > 0 ? data.episodes[0].id : null;
    }
    if (!targetId) {
      viewerBody.innerHTML = '<div class="empty-state">이미지를 찾을 수 없습니다.</div>';
      return;
    }
    await openEpisode(title, targetId, { restoreScroll: true });
  } catch (err) {
    viewerBody.innerHTML = `<div class="empty-state">불러오지 못했습니다: ${escapeHtml(err.message)}</div>`;
  }
}

/* ---- 회차 목록 ---- */

let titleRequestId = 0;

async function openTitle(title) {
  const requestId = ++titleRequestId;

  viewerState.view = "episodes";
  viewerState.title = title;
  viewerState.episodeId = null;
  viewerState.activeEpisodeId = null;
  exitFullscreenIfActive();
  document.body.classList.remove("immersive");

  episodeSearchQuery = "";
  viewerSearchInput.value = "";
  viewerSearchInput.placeholder = "회차 검색 (예: 006)";
  viewerSortSelect.hidden = true;
  viewerControls.hidden = false;

  renderBreadcrumb();
  viewerBody.innerHTML = '<div class="empty-state">불러오는 중...</div>';

  try {
    const resp = await fetch(`/api/library/${encodeURIComponent(title)}`);
    if (!resp.ok) throw new Error(`요청 실패 (${resp.status})`);
    const data = await resp.json();
    // Ignore a stale response if a newer openTitle call has since started (e.g. the
    // user clicked back to the library and into another title before this resolved).
    if (requestId !== titleRequestId) return;
    viewerState.episodes = data.episodes;

    if (data.episodes.length === 0) {
      viewerBody.innerHTML = '<div class="empty-state">이미지를 찾을 수 없습니다.</div>';
      return;
    }
    renderEpisodeGrid();
  } catch (err) {
    if (requestId !== titleRequestId) return;
    viewerBody.innerHTML = `<div class="empty-state">회차 목록을 불러오지 못했습니다: ${escapeHtml(err.message)}</div>`;
  }
}

function renderEpisodeGrid() {
  if (viewerState.view !== "episodes") return;
  const title = viewerState.title;

  let list = viewerState.episodes;
  const q = episodeSearchQuery.trim().toLowerCase();
  if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));

  const progress = getTitleProgress(title);
  const resumeBtnHtml = progress && progress.lastEpisodeId && viewerState.episodes.some((e) => e.id === progress.lastEpisodeId)
    ? `<button type="button" class="btn btn-primary btn-sm" style="width:auto;" id="resume-here-btn">이어보기</button>`
    : "";
  const topBar = `<div class="action-row">
      <button type="button" class="btn btn-secondary btn-sm" style="width:auto;" id="back-to-library-btn">← 라이브러리</button>
      ${resumeBtnHtml}
    </div>`;

  const gridHtml = list.length === 0
    ? '<div class="empty-state">검색 결과가 없습니다.</div>'
    : `<div class="lib-grid">${list.map((e) => renderEpisodeCard(title, e)).join("")}</div>`;

  viewerBody.innerHTML = topBar + gridHtml;

  viewerBody.querySelectorAll("[data-open-episode]").forEach((el) => {
    el.addEventListener("click", () => openEpisode(title, el.getAttribute("data-open-episode")));
  });
  const backBtn = document.getElementById("back-to-library-btn");
  if (backBtn) backBtn.addEventListener("click", showTitles);
  const resumeBtn = document.getElementById("resume-here-btn");
  if (resumeBtn) resumeBtn.addEventListener("click", () => resumeTitle(title));
}

function renderEpisodeCard(title, ep) {
  const cover = ep.cover_url
    ? `<img class="lib-cover" src="${ep.cover_url}" loading="lazy" alt="${escapeHtml(ep.name)}" />`
    : `<div class="lib-cover-empty">이미지 없음</div>`;
  const read = isEpisodeRead(title, ep.id);
  return `
    <div class="lib-card ${read ? "read" : ""}" data-open-episode="${escapeAttr(ep.id)}">
      ${cover}
      ${read ? '<div class="read-badge">읽음</div>' : ""}
      <div class="lib-meta">
        <div class="lib-name">${escapeHtml(ep.name)}</div>
        <div class="lib-count">${ep.image_count}장</div>
      </div>
    </div>
  `;
}

/* ---- 리더 (웹툰 연속 스크롤 · 페이지 넘김 · 전체화면 · 페이지 점프) ---- */

const READER_VIEW_MODE_KEY = "mangadl_reader_view_mode"; // "scroll" | "paged"
const READER_DIRECTION_KEY = "mangadl_reader_direction"; // "ltr" | "rtl"
const READER_PAGES_KEY = "mangadl_reader_pages_per_view"; // "1" | "2"

function loadStringPref(key, fallback, allowed) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch (err) {
    return fallback;
  }
}

const readerRuntime = {
  sentinelObserver: null,
  positionObserver: null,
  loadingNext: false,
  noMoreEpisodes: false,
  viewMode: loadStringPref(READER_VIEW_MODE_KEY, "scroll", ["scroll", "paged"]),
  direction: loadStringPref(READER_DIRECTION_KEY, "ltr", ["ltr", "rtl"]),
  paged: {
    episodeId: null,
    images: [],
    index: 0,
    loading: false,
    pagesPerView: Number(loadStringPref(READER_PAGES_KEY, "1", ["1", "2"])),
  },
};

function teardownReaderObservers() {
  if (readerRuntime.sentinelObserver) readerRuntime.sentinelObserver.disconnect();
  if (readerRuntime.positionObserver) readerRuntime.positionObserver.disconnect();
  readerRuntime.sentinelObserver = null;
  readerRuntime.positionObserver = null;
  readerRuntime.loadingNext = false;
  readerRuntime.noMoreEpisodes = false;
}

async function openEpisode(title, episodeId, opts = {}) {
  teardownReaderObservers();
  viewerState.view = "reader";
  viewerState.title = title;
  viewerState.episodeId = episodeId;
  viewerState.activeEpisodeId = episodeId;
  viewerState.loadedIds = [];
  viewerControls.hidden = true;
  renderBreadcrumb();
  renderReaderShell(title);

  if (readerRuntime.viewMode === "paged") {
    await openEpisodePaged(title, episodeId, opts);
  } else {
    await openEpisodeScroll(title, episodeId, opts);
  }
}

async function fetchEpisodeImages(title, episodeId) {
  const resp = await fetch(`/api/library/${encodeURIComponent(title)}/episodes/${encodeURIComponent(episodeId)}/images`);
  if (!resp.ok) throw new Error(`요청 실패 (${resp.status})`);
  const data = await resp.json();
  return data.images;
}

function renderReaderShell(title) {
  viewerBody.innerHTML = `
    <div class="reader-header">
      <div class="reader-title" id="reader-title-text"></div>
      <div class="reader-nav">
        <div class="reader-jump">
          <input type="number" min="1" id="reader-jump-input" placeholder="쪽" />
          <button type="button" class="btn btn-secondary btn-sm" id="reader-jump-btn">이동</button>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="reader-pages-btn" hidden></button>
        <button type="button" class="btn btn-secondary btn-sm" id="reader-direction-btn" hidden></button>
        <button type="button" class="btn btn-secondary btn-sm" id="reader-viewmode-btn"></button>
        <button type="button" class="btn btn-secondary btn-sm" id="reader-immersive-btn">전체화면</button>
        <button type="button" class="btn btn-secondary btn-sm" id="reader-library-btn">라이브러리</button>
        <button type="button" class="btn btn-secondary btn-sm" id="reader-back">목록으로</button>
        <button type="button" class="btn btn-secondary btn-sm" id="reader-prev">이전 화</button>
        <button type="button" class="btn btn-secondary btn-sm" id="reader-next">다음 화</button>
      </div>
    </div>
    <div class="reader-strip" id="reader-strip"></div>
    <div class="reader-pager" id="reader-pager" hidden></div>
    <div class="page-indicator" id="page-indicator" hidden></div>
  `;

  document.getElementById("reader-library-btn").addEventListener("click", showTitles);
  document.getElementById("reader-back").addEventListener("click", () => openTitle(title));
  document.getElementById("reader-prev").addEventListener("click", () => gotoRelativeEpisode(title, -1));
  document.getElementById("reader-next").addEventListener("click", () => gotoRelativeEpisode(title, 1));
  document.getElementById("reader-immersive-btn").addEventListener("click", toggleImmersive);
  document.getElementById("reader-jump-btn").addEventListener("click", jumpToPage);
  document.getElementById("reader-jump-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") jumpToPage();
  });
  document.getElementById("reader-viewmode-btn").addEventListener("click", () => toggleViewMode(title));
  document.getElementById("reader-direction-btn").addEventListener("click", () => toggleDirection(title));
  document.getElementById("reader-pages-btn").addEventListener("click", () => togglePagesPerView(title));

  applyViewModeUI();
  updateReaderChrome(title);
}

function applyViewModeUI() {
  const isPaged = readerRuntime.viewMode === "paged";
  const strip = document.getElementById("reader-strip");
  const pager = document.getElementById("reader-pager");
  if (strip) strip.hidden = isPaged;
  if (pager) pager.hidden = !isPaged;

  const viewBtn = document.getElementById("reader-viewmode-btn");
  if (viewBtn) viewBtn.textContent = isPaged ? "웹툰 모드로 보기" : "페이지 넘김으로 보기";

  const dirBtn = document.getElementById("reader-direction-btn");
  if (dirBtn) {
    dirBtn.hidden = !isPaged;
    dirBtn.textContent = readerRuntime.direction === "ltr" ? "▶ 왼쪽 → 오른쪽" : "◀ 오른쪽 → 왼쪽";
  }

  const pagesBtn = document.getElementById("reader-pages-btn");
  if (pagesBtn) {
    pagesBtn.hidden = !isPaged;
    pagesBtn.textContent = readerRuntime.paged.pagesPerView === 2 ? "1쪽씩 보기" : "2쪽씩 보기";
  }
}

function toggleViewMode(title) {
  const activeId = viewerState.activeEpisodeId || viewerState.episodeId;
  let resumePage = 1;
  if (readerRuntime.viewMode === "paged") {
    resumePage = readerRuntime.paged.index + 1;
  } else {
    const progress = getTitleProgress(title);
    if (progress && progress.lastEpisodeId === activeId && progress.lastImageIndex) {
      resumePage = progress.lastImageIndex;
    }
  }

  readerRuntime.viewMode = readerRuntime.viewMode === "paged" ? "scroll" : "paged";
  try {
    localStorage.setItem(READER_VIEW_MODE_KEY, readerRuntime.viewMode);
  } catch (err) {
    // ignore
  }

  teardownReaderObservers();
  viewerState.loadedIds = [];
  applyViewModeUI();

  if (readerRuntime.viewMode === "paged") {
    openEpisodePaged(title, activeId, { startIndex: resumePage });
  } else {
    openEpisodeScroll(title, activeId, { jumpToPageIndex: resumePage });
  }
}

function toggleDirection(title) {
  readerRuntime.direction = readerRuntime.direction === "ltr" ? "rtl" : "ltr";
  try {
    localStorage.setItem(READER_DIRECTION_KEY, readerRuntime.direction);
  } catch (err) {
    // ignore
  }
  applyViewModeUI();
  if (readerRuntime.viewMode === "paged") renderPagedImage(title);
}

function alignToPairStart(index) {
  return index % 2 === 0 ? index : index - 1;
}

function togglePagesPerView(title) {
  readerRuntime.paged.pagesPerView = readerRuntime.paged.pagesPerView === 2 ? 1 : 2;
  try {
    localStorage.setItem(READER_PAGES_KEY, String(readerRuntime.paged.pagesPerView));
  } catch (err) {
    // ignore
  }
  if (readerRuntime.paged.pagesPerView === 2) {
    readerRuntime.paged.index = alignToPairStart(readerRuntime.paged.index);
  }
  applyViewModeUI();
  renderPagedImage(title);
}

function updateReaderChrome(title) {
  const activeId = viewerState.activeEpisodeId || viewerState.episodeId;
  const activeEp = viewerState.episodes.find((e) => e.id === activeId);
  const titleEl = document.getElementById("reader-title-text");
  if (titleEl) titleEl.textContent = `${title} · ${activeEp ? activeEp.name : activeId}`;

  const idx = viewerState.episodes.findIndex((e) => e.id === activeId);
  const prevEp = idx > 0 ? viewerState.episodes[idx - 1] : null;
  const nextEp = idx >= 0 && idx < viewerState.episodes.length - 1 ? viewerState.episodes[idx + 1] : null;
  const prevBtn = document.getElementById("reader-prev");
  const nextBtn = document.getElementById("reader-next");
  if (prevBtn) prevBtn.disabled = !prevEp;
  if (nextBtn) nextBtn.disabled = !nextEp;

  renderBreadcrumb();
}

/* -- 웹툰 모드: 연속 세로 스크롤 -- */

async function openEpisodeScroll(title, episodeId, opts = {}) {
  const strip = document.getElementById("reader-strip");
  if (strip) strip.innerHTML = "";
  viewerState.loadedIds = [];

  try {
    const images = await fetchEpisodeImages(title, episodeId);
    appendEpisodeToStrip(title, episodeId, images);
    setupSentinel(title);
    setupPositionObserver(title);

    if (opts.jumpToPageIndex) {
      const target = document.querySelector(
        `img[data-episode-id="${cssEscape(episodeId)}"][data-page-index="${opts.jumpToPageIndex}"]`
      );
      if (target) {
        target.scrollIntoView({ block: "start" });
        return;
      }
    }
    if (opts.restoreScroll) {
      const progress = getTitleProgress(title);
      if (progress && progress.lastEpisodeId === episodeId && progress.scrollY) {
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: progress.scrollY })));
      } else {
        window.scrollTo({ top: 0 });
      }
    } else {
      window.scrollTo({ top: 0 });
    }
  } catch (err) {
    if (strip) strip.innerHTML = `<div class="empty-state">이미지를 불러오지 못했습니다: ${escapeHtml(err.message)}</div>`;
  }
}

function appendEpisodeToStrip(title, episodeId, images) {
  const ep = viewerState.episodes.find((e) => e.id === episodeId);
  const strip = document.getElementById("reader-strip");
  if (!strip) return;

  const dividerHtml = `<div class="chapter-divider" data-episode-id="${escapeAttr(episodeId)}">${escapeHtml(ep ? ep.name : episodeId)} &middot; ${images.length}장</div>`;
  const pagesHtml = images
    .map(
      (url, i) =>
        `<img src="${url}" loading="lazy" alt="${i + 1}" data-episode-id="${escapeAttr(episodeId)}" data-page-index="${i + 1}" data-page-total="${images.length}" />`
    )
    .join("");

  const wrapper = document.createElement("div");
  wrapper.innerHTML = dividerHtml + pagesHtml;
  while (wrapper.firstChild) strip.appendChild(wrapper.firstChild);

  viewerState.loadedIds.push(episodeId);

  const oldSentinel = document.getElementById("reader-sentinel");
  if (oldSentinel) {
    if (readerRuntime.sentinelObserver) readerRuntime.sentinelObserver.unobserve(oldSentinel);
    oldSentinel.remove();
  }
  const sentinel = document.createElement("div");
  sentinel.id = "reader-sentinel";
  sentinel.dataset.episodeId = episodeId;
  strip.appendChild(sentinel);

  if (readerRuntime.positionObserver) {
    strip.querySelectorAll(`img[data-episode-id="${cssEscape(episodeId)}"]`).forEach((img) => {
      readerRuntime.positionObserver.observe(img);
    });
  }
  if (readerRuntime.sentinelObserver) {
    readerRuntime.sentinelObserver.observe(sentinel);
  }
}

function setupSentinel(title) {
  readerRuntime.sentinelObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) onReachEnd(title, entry.target.dataset.episodeId);
      });
    },
    { rootMargin: "0px 0px 600px 0px" }
  );
  const sentinel = document.getElementById("reader-sentinel");
  if (sentinel) readerRuntime.sentinelObserver.observe(sentinel);
}

async function onReachEnd(title, fromEpisodeId) {
  if (readerRuntime.loadingNext || readerRuntime.noMoreEpisodes) return;

  const idx = viewerState.episodes.findIndex((e) => e.id === fromEpisodeId);
  const nextEp = idx >= 0 && idx < viewerState.episodes.length - 1 ? viewerState.episodes[idx + 1] : null;

  if (!nextEp) {
    readerRuntime.noMoreEpisodes = true;
    markEpisodeRead(title, fromEpisodeId);
    const strip = document.getElementById("reader-strip");
    if (strip) {
      const note = document.createElement("div");
      note.className = "reader-end-note";
      note.textContent = "마지막 화입니다.";
      strip.appendChild(note);
    }
    if (readerRuntime.sentinelObserver) readerRuntime.sentinelObserver.disconnect();
    return;
  }

  if (viewerState.loadedIds.includes(nextEp.id)) return;

  readerRuntime.loadingNext = true;
  try {
    const images = await fetchEpisodeImages(title, nextEp.id);
    appendEpisodeToStrip(title, nextEp.id, images);
  } catch (err) {
    // network hiccup mid-scroll; sentinel stays in place so the user can retry by scrolling again
  } finally {
    readerRuntime.loadingNext = false;
  }
}

function setupPositionObserver(title) {
  readerRuntime.positionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length === 0) return;
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const top = visible[0].target;
      onActivePageChange(title, top.dataset.episodeId, Number(top.dataset.pageIndex), Number(top.dataset.pageTotal));
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  document.querySelectorAll("#reader-strip img").forEach((img) => readerRuntime.positionObserver.observe(img));
}

function onActivePageChange(title, episodeId, pageIndex, pageTotal) {
  const indicator = document.getElementById("page-indicator");
  if (indicator) {
    indicator.hidden = false;
    indicator.textContent = `${pageIndex} / ${pageTotal}`;
  }

  if (episodeId !== viewerState.activeEpisodeId) {
    const prevActiveIdx = viewerState.loadedIds.indexOf(viewerState.activeEpisodeId);
    const newActiveIdx = viewerState.loadedIds.indexOf(episodeId);
    if (prevActiveIdx !== -1 && newActiveIdx > prevActiveIdx) {
      markEpisodeRead(title, viewerState.activeEpisodeId);
    }
    viewerState.activeEpisodeId = episodeId;
    updateReaderChrome(title);
  }

  updateTitleProgress(title, {
    lastEpisodeId: episodeId,
    lastEpisodeName: (viewerState.episodes.find((e) => e.id === episodeId) || {}).name || episodeId,
    lastImageIndex: pageIndex,
    scrollY: window.scrollY,
  });
}

/* -- 페이지 넘김 모드: 만화책처럼 한 쪽씩 -- */

async function openEpisodePaged(title, episodeId, opts = {}) {
  const pagerBox = document.getElementById("reader-pager");
  try {
    const images = await fetchEpisodeImages(title, episodeId);
    readerRuntime.paged.episodeId = episodeId;
    readerRuntime.paged.images = images;

    let startIndex = 0;
    if (opts.startAtEnd) {
      startIndex = images.length - 1;
    } else if (opts.startIndex) {
      startIndex = Math.min(Math.max(opts.startIndex - 1, 0), images.length - 1);
    } else if (opts.restoreScroll) {
      const progress = getTitleProgress(title);
      if (progress && progress.lastEpisodeId === episodeId && progress.lastImageIndex) {
        startIndex = Math.min(Math.max(progress.lastImageIndex - 1, 0), images.length - 1);
      }
    }
    if (readerRuntime.paged.pagesPerView === 2) startIndex = alignToPairStart(startIndex);
    readerRuntime.paged.index = Math.max(startIndex, 0);
    viewerState.loadedIds = [episodeId];
    viewerState.activeEpisodeId = episodeId;
    renderPagedImage(title);
  } catch (err) {
    if (pagerBox) pagerBox.innerHTML = `<div class="empty-state">이미지를 불러오지 못했습니다: ${escapeHtml(err.message)}</div>`;
  }
}

function renderPagedImage(title) {
  const { images, index, episodeId, pagesPerView } = readerRuntime.paged;
  const pagerBox = document.getElementById("reader-pager");
  if (!pagerBox) return;
  if (images.length === 0) {
    pagerBox.innerHTML = '<div class="empty-state">이 회차에는 이미지가 없습니다.</div>';
    return;
  }

  const dual = pagesPerView === 2;
  pagerBox.classList.toggle("dual", dual);

  let pageIndexes;
  if (dual) {
    const a = index;
    const b = index + 1 < images.length ? index + 1 : null;
    // `a` is always the earlier page; direction only decides which side it renders on.
    pageIndexes = readerRuntime.direction === "ltr" ? [a, b] : [b, a];
    pageIndexes = pageIndexes.filter((i) => i !== null);
  } else {
    pageIndexes = [index];
  }

  pagerBox.innerHTML = [
    `<div class="page-zone page-zone-left" id="page-zone-left" title="이전 쪽"></div>`,
    ...pageIndexes.map((i) => `<img class="pager-image" src="${images[i]}" alt="${i + 1}" />`),
    `<div class="page-zone page-zone-right" id="page-zone-right" title="다음 쪽"></div>`,
  ].join("");

  document
    .getElementById("page-zone-left")
    .addEventListener("click", () => pagerStep(title, readerRuntime.direction === "ltr" ? -1 : 1));
  document
    .getElementById("page-zone-right")
    .addEventListener("click", () => pagerStep(title, readerRuntime.direction === "ltr" ? 1 : -1));

  const indicator = document.getElementById("page-indicator");
  if (indicator) {
    indicator.hidden = false;
    indicator.textContent = dual && pageIndexes.length === 2
      ? `${index + 1}-${index + 2} / ${images.length}`
      : `${index + 1} / ${images.length}`;
  }

  updateReaderChrome(title);

  updateTitleProgress(title, {
    lastEpisodeId: episodeId,
    lastEpisodeName: (viewerState.episodes.find((e) => e.id === episodeId) || {}).name || episodeId,
    lastImageIndex: index + 1,
    scrollY: 0,
  });
}

async function pagerStep(title, direction) {
  if (readerRuntime.paged.loading) return;
  const { images, index, episodeId, pagesPerView } = readerRuntime.paged;
  const step = pagesPerView === 2 ? 2 : 1;
  const nextLocalIndex = index + direction * step;

  if (nextLocalIndex >= 0 && nextLocalIndex < images.length) {
    readerRuntime.paged.index = pagesPerView === 2 ? alignToPairStart(nextLocalIndex) : nextLocalIndex;
    renderPagedImage(title);
    return;
  }

  const idx = viewerState.episodes.findIndex((e) => e.id === episodeId);
  readerRuntime.paged.loading = true;
  try {
    if (direction > 0) {
      if (idx === -1 || idx >= viewerState.episodes.length - 1) return;
      markEpisodeRead(title, episodeId);
      await openEpisodePaged(title, viewerState.episodes[idx + 1].id, { startIndex: 1 });
    } else {
      if (idx <= 0) return;
      await openEpisodePaged(title, viewerState.episodes[idx - 1].id, { startAtEnd: true });
    }
  } finally {
    readerRuntime.paged.loading = false;
  }
}

/* -- 공통: 회차 이동 · 페이지 점프 · 전체화면 · 키보드 -- */

function gotoRelativeEpisode(title, direction) {
  const activeId = viewerState.activeEpisodeId || viewerState.episodeId;
  const idx = viewerState.episodes.findIndex((e) => e.id === activeId);
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= viewerState.episodes.length) return;
  const targetEp = viewerState.episodes[targetIdx];

  // Set before the (async) episode load resolves, so the title bar reflects the
  // new episode immediately rather than waiting on the scroll-position observer
  // (which only fires once the user scrolls the new page into its tracked band).
  viewerState.activeEpisodeId = targetEp.id;
  updateReaderChrome(title);

  if (readerRuntime.viewMode === "paged") {
    if (direction > 0) markEpisodeRead(title, activeId);
    openEpisodePaged(title, targetEp.id, { startIndex: 1 });
    return;
  }

  if (direction > 0 && viewerState.loadedIds.includes(targetEp.id)) {
    const divider = document.querySelector(`.chapter-divider[data-episode-id="${cssEscape(targetEp.id)}"]`);
    if (divider) {
      divider.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  teardownReaderObservers();
  openEpisodeScroll(title, targetEp.id, {});
}

function jumpToPage() {
  const input = document.getElementById("reader-jump-input");
  const n = Number(input.value);
  if (!n || n < 1) return;

  if (readerRuntime.viewMode === "paged") {
    if (n > readerRuntime.paged.images.length) return;
    let idx = n - 1;
    if (readerRuntime.paged.pagesPerView === 2) idx = alignToPairStart(idx);
    readerRuntime.paged.index = idx;
    renderPagedImage(viewerState.title);
    return;
  }

  const activeId = viewerState.activeEpisodeId || viewerState.episodeId;
  const target = document.querySelector(`img[data-episode-id="${cssEscape(activeId)}"][data-page-index="${n}"]`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleImmersive() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    const exit = document.exitFullscreen
      ? document.exitFullscreen.bind(document)
      : document.webkitExitFullscreen
        ? document.webkitExitFullscreen.bind(document)
        : null;
    if (exit) exit();
  } else {
    const target = document.documentElement;
    const request = target.requestFullscreen
      ? target.requestFullscreen.bind(target)
      : target.webkitRequestFullscreen
        ? target.webkitRequestFullscreen.bind(target)
        : null;
    if (request) {
      const p = request();
      if (p && p.catch) p.catch(() => {});
    }
  }
}

function exitFullscreenIfActive() {
  if (!(document.fullscreenElement || document.webkitFullscreenElement)) return;
  try {
    const exit = document.exitFullscreen
      ? document.exitFullscreen.bind(document)
      : document.webkitExitFullscreen
        ? document.webkitExitFullscreen.bind(document)
        : null;
    if (exit) {
      const p = exit();
      if (p && p.catch) p.catch(() => {});
    }
  } catch (err) {
    // ignore
  }
}

function syncImmersiveWithFullscreen() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  document.body.classList.toggle("immersive", isFs);
  const label = isFs ? "전체화면 종료" : "전체화면";
  // Both readers' immersive buttons share this one Fullscreen API/event pair (see
  // toggleImmersive/exitFullscreenIfActive) — only one is ever visible at a time,
  // but updating both ids here is harmless and keeps them in sync either way.
  const btn = document.getElementById("reader-immersive-btn");
  if (btn) btn.textContent = label;
  const onlineBtn = document.getElementById("online-reader-immersive-btn");
  if (onlineBtn) onlineBtn.textContent = label;
}

document.addEventListener("fullscreenchange", syncImmersiveWithFullscreen);
document.addEventListener("webkitfullscreenchange", syncImmersiveWithFullscreen);

document.addEventListener("keydown", (e) => {
  if (viewerState.view !== "reader" || panelViewer.hidden) return;
  const tag = (document.activeElement && document.activeElement.tagName) || "";
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // 단일 문자 키(a/d/w/s/f/n/p)만 소문자로 맞춰 비교 — ArrowLeft 등 이름 있는
  // 키는 그대로 둔다.
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (key === "f") {
    e.preventDefault();
    toggleImmersive();
    return;
  }
  if (key === "l") {
    e.preventDefault();
    openTitle(viewerState.title);
    return;
  }
  if (key === "n") {
    e.preventDefault();
    gotoRelativeEpisode(viewerState.title, 1);
    return;
  }
  if (key === "p") {
    e.preventDefault();
    gotoRelativeEpisode(viewerState.title, -1);
    return;
  }

  if (readerRuntime.viewMode === "paged") {
    if (key === "ArrowRight" || key === " " || key === "d") {
      e.preventDefault();
      pagerStep(viewerState.title, readerRuntime.direction === "ltr" ? 1 : -1);
    } else if (key === "ArrowLeft" || key === "a") {
      e.preventDefault();
      pagerStep(viewerState.title, readerRuntime.direction === "ltr" ? -1 : 1);
    } else if (key === "Home") {
      e.preventDefault();
      readerRuntime.paged.index = 0;
      renderPagedImage(viewerState.title);
    } else if (key === "End") {
      e.preventDefault();
      const lastIdx = readerRuntime.paged.images.length - 1;
      readerRuntime.paged.index = readerRuntime.paged.pagesPerView === 2 ? alignToPairStart(lastIdx) : lastIdx;
      renderPagedImage(viewerState.title);
    }
    return;
  }

  if (key === " " || key === "PageDown" || key === "ArrowDown" || key === "s") {
    e.preventDefault();
    window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
  } else if (key === "PageUp" || key === "ArrowUp" || key === "w") {
    e.preventDefault();
    window.scrollBy({ top: -window.innerHeight * 0.9, behavior: "smooth" });
  } else if (key === "Home") {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (key === "End") {
    e.preventDefault();
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }
});

function cssEscape(str) {
  if (window.CSS && CSS.escape) return CSS.escape(str);
  return String(str).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

/* ====================================================================
   온라인 보기 탭 — 다운로드 없이 사이트에서 바로 검색·열람.
   기존 다운로드 크롤러(app/jobs.py, crawler.crawl_toon)와는 완전히 별개다:
   여기서 호출하는 API(/api/online/*)는 파일을 쓰지 않고 매번 사이트에서
   직접 읽어온다. 아래 함수들은 위쪽 "뷰어 탭" 코드와 의도적으로 상태를
   공유하지 않는다(각자 onlineState/onlineReaderRuntime 사용) — 다운로드한
   파일을 보는 기존 뷰어를 건드리지 않기 위해서다. 보기 모드/읽는 방향/
   1·2쪽 설정만 같은 localStorage 키를 공유해 두 리더가 같은 취향을 따르게
   한다.
   ==================================================================== */

let onlineLoadedOnce = false;

const onlineState = {
  view: "search", // search | episodes | reader
  siteUrl: "",
  toonId: null,
  seriesTitle: "",
  page: 1,
  episodes: [], // [{wr_id, title}] for the current listing page
  episodeId: null,
  activeEpisodeId: null,
  loadedIds: [],
};

const onlineReaderRuntime = {
  sentinelObserver: null,
  positionObserver: null,
  loadingNext: false,
  noMoreEpisodes: false,
  viewMode: loadStringPref(READER_VIEW_MODE_KEY, "scroll", ["scroll", "paged"]),
  direction: loadStringPref(READER_DIRECTION_KEY, "ltr", ["ltr", "rtl"]),
  paged: {
    episodeId: null,
    images: [],
    index: 0,
    loading: false,
    pagesPerView: Number(loadStringPref(READER_PAGES_KEY, "1", ["1", "2"])),
  },
};

function teardownOnlineReaderObservers() {
  if (onlineReaderRuntime.sentinelObserver) onlineReaderRuntime.sentinelObserver.disconnect();
  if (onlineReaderRuntime.positionObserver) onlineReaderRuntime.positionObserver.disconnect();
  onlineReaderRuntime.sentinelObserver = null;
  onlineReaderRuntime.positionObserver = null;
  onlineReaderRuntime.loadingNext = false;
  onlineReaderRuntime.noMoreEpisodes = false;
}

function renderOnlineBreadcrumb() {
  const parts = [`<span class="crumb" data-crumb="search">온라인 보기</span>`];
  if (onlineState.view !== "search" && onlineState.seriesTitle) {
    const isCurrent = onlineState.view === "episodes";
    parts.push(`<span class="sep">/</span>`);
    parts.push(
      `<span class="crumb ${isCurrent ? "current" : ""}" data-crumb="episodes">${escapeHtml(onlineState.seriesTitle)}</span>`
    );
  }
  if (onlineState.view === "reader") {
    const activeId = onlineState.activeEpisodeId || onlineState.episodeId;
    const ep = onlineState.episodes.find((e) => e.wr_id === activeId);
    parts.push(`<span class="sep">/</span>`);
    parts.push(`<span class="crumb current">${escapeHtml(ep ? ep.title : activeId)}</span>`);
  }
  onlineBreadcrumb.innerHTML = parts.join("");

  onlineBreadcrumb.querySelectorAll("[data-crumb='search']").forEach((el) => {
    el.addEventListener("click", showOnlineSearch);
  });
  onlineBreadcrumb.querySelectorAll("[data-crumb='episodes']").forEach((el) => {
    el.addEventListener("click", () => {
      if (onlineState.toonId) openOnlineEpisodes(onlineState.toonId, onlineState.seriesTitle, onlineState.page);
    });
  });
}

/* ---- 검색 화면 ---- */

function showOnlineSearch() {
  onlineState.view = "search";
  onlineState.episodes = [];
  onlineState.episodeId = null;
  onlineState.activeEpisodeId = null;
  teardownOnlineReaderObservers();
  exitFullscreenIfActive();
  document.body.classList.remove("immersive");

  // First visit: default to whatever site URL is already in the download form,
  // since it's very likely the same site — saves retyping it.
  if (!onlineState.siteUrl) {
    const downloadSiteUrl = document.getElementById("site_url").value.trim();
    if (downloadSiteUrl) onlineState.siteUrl = downloadSiteUrl;
  }

  renderOnlineBreadcrumb();

  onlineBody.innerHTML = `
    <section class="card">
      <h2>사이트에서 검색</h2>
      <div class="field">
        <label for="online-site-url">사이트 주소</label>
        <input type="url" id="online-site-url" placeholder="http://103.204.13.68:8905" value="${escapeAttr(onlineState.siteUrl)}" />
      </div>
      <div class="field-row search-row">
        <div class="field" style="flex:1; margin-bottom:0;">
          <input type="text" id="online-search-query" placeholder="작품 제목으로 검색" />
        </div>
        <button type="button" class="btn btn-secondary" id="online-search-btn" style="width:auto;">검색</button>
      </div>
      <span class="hint">toons 게시판 결과만 표시됩니다.</span>
      <div class="search-results" id="online-search-results"></div>
    </section>
  `;

  document.getElementById("online-search-btn").addEventListener("click", runOnlineSearch);
  document.getElementById("online-search-query").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runOnlineSearch();
    }
  });
}

async function runOnlineSearch() {
  const siteUrl = document.getElementById("online-site-url").value.trim();
  const query = document.getElementById("online-search-query").value.trim();
  const resultsEl = document.getElementById("online-search-results");

  if (!siteUrl) {
    resultsEl.innerHTML = '<div class="empty-state">사이트 주소를 입력하세요.</div>';
    return;
  }
  if (!query) {
    resultsEl.innerHTML = '<div class="empty-state">검색어를 입력하세요.</div>';
    return;
  }

  onlineState.siteUrl = siteUrl.replace(/\/+$/, "");
  resultsEl.innerHTML = '<div class="empty-state">검색 중...</div>';

  try {
    const resp = await fetch(`/api/search?site_url=${encodeURIComponent(onlineState.siteUrl)}&query=${encodeURIComponent(query)}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `요청 실패 (${resp.status})`);
    }
    const results = await resp.json();
    renderOnlineSearchResults(results);
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty-state">검색 실패: ${escapeHtml(err.message)}</div>`;
  }
}

function renderOnlineSearchResults(results) {
  const resultsEl = document.getElementById("online-search-results");
  if (results.length === 0) {
    resultsEl.innerHTML = '<div class="empty-state">검색 결과가 없습니다.</div>';
    return;
  }

  resultsEl.innerHTML = results
    .map(
      (r) => `
        <button type="button" class="search-result-item" data-toon-id="${r.id}" data-toon-title="${escapeAttr(r.title)}">
          <div class="search-result-title">${escapeHtml(r.title)}</div>
          <div class="search-result-tags">ID ${r.id}${r.tags ? " &middot; " + escapeHtml(r.tags) : ""}</div>
        </button>
      `
    )
    .join("");

  resultsEl.querySelectorAll("[data-toon-id]").forEach((el) => {
    el.addEventListener("click", () => {
      openOnlineEpisodes(Number(el.getAttribute("data-toon-id")), el.getAttribute("data-toon-title"), 1);
    });
  });
}

/* ---- 회차 목록 화면 (사이트 페이지 단위) ---- */

let onlineEpisodesRequestId = 0;

async function openOnlineEpisodes(toonId, title, page) {
  const requestId = ++onlineEpisodesRequestId;

  onlineState.view = "episodes";
  onlineState.toonId = toonId;
  onlineState.seriesTitle = title;
  onlineState.page = page;
  onlineState.episodeId = null;
  onlineState.activeEpisodeId = null;
  teardownOnlineReaderObservers();
  exitFullscreenIfActive();
  document.body.classList.remove("immersive");
  renderOnlineBreadcrumb();
  onlineBody.innerHTML = '<div class="empty-state">불러오는 중...</div>';

  try {
    const resp = await fetch(
      `/api/online/episodes?site_url=${encodeURIComponent(onlineState.siteUrl)}&toon_id=${toonId}&page=${page}`
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `요청 실패 (${resp.status})`);
    }
    const data = await resp.json();
    // A newer call to this function (e.g. a second page-nav click) may have already
    // started and could still resolve after this one — ignore this response if so,
    // so a slow request can't clobber a page the user has since moved past.
    if (requestId !== onlineEpisodesRequestId) return;
    onlineState.episodes = data.episodes;
    renderOnlineEpisodeList();
  } catch (err) {
    if (requestId !== onlineEpisodesRequestId) return;
    onlineBody.innerHTML = `<div class="empty-state">회차 목록을 불러오지 못했습니다: ${escapeHtml(err.message)}</div>`;
  }
}

function renderOnlineEpisodeList() {
  if (onlineState.view !== "episodes") return;

  const pager = `
    <div class="action-row">
      <button type="button" class="btn btn-secondary btn-sm" style="width:auto;" id="online-back-to-search-btn">← 검색으로</button>
      <button type="button" class="btn btn-secondary btn-sm" style="width:auto;" id="online-prev-page-btn" ${onlineState.page <= 1 ? "disabled" : ""}>이전 페이지</button>
      <span style="align-self:center; font-size:12px; color:var(--muted);">페이지 ${onlineState.page}</span>
      <button type="button" class="btn btn-secondary btn-sm" style="width:auto;" id="online-next-page-btn" ${onlineState.episodes.length === 0 ? "disabled" : ""}>다음 페이지</button>
    </div>
  `;

  const listHtml =
    onlineState.episodes.length === 0
      ? '<div class="empty-state">이 페이지에는 회차가 없습니다.</div>'
      : `<div class="search-results">${onlineState.episodes
          .map(
            (ep) => `
              <button type="button" class="search-result-item" data-wr-id="${escapeAttr(ep.wr_id)}">
                <div class="search-result-title">${escapeHtml(ep.title)}${ep.date ? ` (${escapeHtml(ep.date)})` : ""}</div>
              </button>
            `
          )
          .join("")}</div>`;

  onlineBody.innerHTML = pager + listHtml;

  document.getElementById("online-back-to-search-btn").addEventListener("click", showOnlineSearch);
  document.getElementById("online-prev-page-btn").addEventListener("click", () => {
    if (onlineState.page > 1) openOnlineEpisodes(onlineState.toonId, onlineState.seriesTitle, onlineState.page - 1);
  });
  document.getElementById("online-next-page-btn").addEventListener("click", () => {
    openOnlineEpisodes(onlineState.toonId, onlineState.seriesTitle, onlineState.page + 1);
  });
  onlineBody.querySelectorAll("[data-wr-id]").forEach((el) => {
    el.addEventListener("click", () => openOnlineEpisode(el.getAttribute("data-wr-id")));
  });
}

/* ---- 리더: 웹툰 세로 스크롤 ---- */

async function fetchOnlineEpisodeImages(wrId) {
  const resp = await fetch(
    `/api/online/images?site_url=${encodeURIComponent(onlineState.siteUrl)}&toon_id=${onlineState.toonId}&wr_id=${encodeURIComponent(wrId)}`
  );
  if (!resp.ok) throw new Error(`요청 실패 (${resp.status})`);
  const data = await resp.json();
  return data.images;
}

async function openOnlineEpisode(wrId, opts = {}) {
  teardownOnlineReaderObservers();
  onlineState.view = "reader";
  onlineState.episodeId = wrId;
  onlineState.activeEpisodeId = wrId;
  onlineState.loadedIds = [];
  renderOnlineBreadcrumb();
  renderOnlineReaderShell();

  if (onlineReaderRuntime.viewMode === "paged") {
    await openOnlineEpisodePaged(wrId, opts);
  } else {
    await openOnlineEpisodeScroll(wrId, opts);
  }
}

function renderOnlineReaderShell() {
  onlineBody.innerHTML = `
    <div class="reader-header">
      <div class="reader-title" id="online-reader-title-text"></div>
      <div class="reader-nav">
        <div class="reader-jump">
          <input type="number" min="1" id="online-reader-jump-input" placeholder="쪽" />
          <button type="button" class="btn btn-secondary btn-sm" id="online-reader-jump-btn">이동</button>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="online-reader-pages-btn" hidden></button>
        <button type="button" class="btn btn-secondary btn-sm" id="online-reader-direction-btn" hidden></button>
        <button type="button" class="btn btn-secondary btn-sm" id="online-reader-viewmode-btn"></button>
        <button type="button" class="btn btn-secondary btn-sm" id="online-reader-immersive-btn">전체화면</button>
        <button type="button" class="btn btn-secondary btn-sm" id="online-reader-back">회차 목록</button>
        <button type="button" class="btn btn-secondary btn-sm" id="online-reader-prev">이전 화</button>
        <button type="button" class="btn btn-secondary btn-sm" id="online-reader-next">다음 화</button>
      </div>
    </div>
    <div class="reader-strip" id="online-reader-strip"></div>
    <div class="reader-pager" id="online-reader-pager" hidden></div>
    <div class="page-indicator" id="online-page-indicator" hidden></div>
  `;

  document.getElementById("online-reader-back").addEventListener("click", () => {
    openOnlineEpisodes(onlineState.toonId, onlineState.seriesTitle, onlineState.page);
  });
  document.getElementById("online-reader-prev").addEventListener("click", () => gotoOnlineRelativeEpisode(-1));
  document.getElementById("online-reader-next").addEventListener("click", () => gotoOnlineRelativeEpisode(1));
  document.getElementById("online-reader-immersive-btn").addEventListener("click", toggleImmersive);
  document.getElementById("online-reader-jump-btn").addEventListener("click", jumpToOnlinePage);
  document.getElementById("online-reader-jump-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") jumpToOnlinePage();
  });
  document.getElementById("online-reader-viewmode-btn").addEventListener("click", toggleOnlineViewMode);
  document.getElementById("online-reader-direction-btn").addEventListener("click", toggleOnlineDirection);
  document.getElementById("online-reader-pages-btn").addEventListener("click", toggleOnlinePagesPerView);

  applyOnlineViewModeUI();
  updateOnlineReaderChrome();
}

function applyOnlineViewModeUI() {
  const isPaged = onlineReaderRuntime.viewMode === "paged";
  const strip = document.getElementById("online-reader-strip");
  const pager = document.getElementById("online-reader-pager");
  if (strip) strip.hidden = isPaged;
  if (pager) pager.hidden = !isPaged;

  const viewBtn = document.getElementById("online-reader-viewmode-btn");
  if (viewBtn) viewBtn.textContent = isPaged ? "웹툰 모드로 보기" : "페이지 넘김으로 보기";

  const dirBtn = document.getElementById("online-reader-direction-btn");
  if (dirBtn) {
    dirBtn.hidden = !isPaged;
    dirBtn.textContent = onlineReaderRuntime.direction === "ltr" ? "▶ 왼쪽 → 오른쪽" : "◀ 오른쪽 → 왼쪽";
  }

  const pagesBtn = document.getElementById("online-reader-pages-btn");
  if (pagesBtn) {
    pagesBtn.hidden = !isPaged;
    pagesBtn.textContent = onlineReaderRuntime.paged.pagesPerView === 2 ? "1쪽씩 보기" : "2쪽씩 보기";
  }
}

function toggleOnlineViewMode() {
  const activeId = onlineState.activeEpisodeId || onlineState.episodeId;
  let resumePage = 1;
  if (onlineReaderRuntime.viewMode === "paged") {
    resumePage = onlineReaderRuntime.paged.index + 1;
  }

  onlineReaderRuntime.viewMode = onlineReaderRuntime.viewMode === "paged" ? "scroll" : "paged";
  try {
    localStorage.setItem(READER_VIEW_MODE_KEY, onlineReaderRuntime.viewMode);
  } catch (err) {
    // ignore
  }

  teardownOnlineReaderObservers();
  onlineState.loadedIds = [];
  applyOnlineViewModeUI();

  if (onlineReaderRuntime.viewMode === "paged") {
    openOnlineEpisodePaged(activeId, { startIndex: resumePage });
  } else {
    openOnlineEpisodeScroll(activeId, { jumpToPageIndex: resumePage });
  }
}

function toggleOnlineDirection() {
  onlineReaderRuntime.direction = onlineReaderRuntime.direction === "ltr" ? "rtl" : "ltr";
  try {
    localStorage.setItem(READER_DIRECTION_KEY, onlineReaderRuntime.direction);
  } catch (err) {
    // ignore
  }
  applyOnlineViewModeUI();
  if (onlineReaderRuntime.viewMode === "paged") renderOnlinePagedImage();
}

function toggleOnlinePagesPerView() {
  onlineReaderRuntime.paged.pagesPerView = onlineReaderRuntime.paged.pagesPerView === 2 ? 1 : 2;
  try {
    localStorage.setItem(READER_PAGES_KEY, String(onlineReaderRuntime.paged.pagesPerView));
  } catch (err) {
    // ignore
  }
  if (onlineReaderRuntime.paged.pagesPerView === 2) {
    onlineReaderRuntime.paged.index = alignToPairStart(onlineReaderRuntime.paged.index);
  }
  applyOnlineViewModeUI();
  renderOnlinePagedImage();
}

function updateOnlineReaderChrome() {
  const activeId = onlineState.activeEpisodeId || onlineState.episodeId;
  const activeEp = onlineState.episodes.find((e) => e.wr_id === activeId);
  const titleEl = document.getElementById("online-reader-title-text");
  if (titleEl) {
    const epLabel = activeEp ? `${activeEp.title}${activeEp.date ? ` (${activeEp.date})` : ""}` : activeId;
    titleEl.textContent = `${onlineState.seriesTitle} · ${epLabel}`;
  }

  // Newest-first listing: "다음 화" (chronologically forward) sits at a lower index,
  // "이전 화" (chronologically backward) sits at a higher index.
  const idx = onlineState.episodes.findIndex((e) => e.wr_id === activeId);
  const nextEp = idx > 0 ? onlineState.episodes[idx - 1] : null;
  const prevEp = idx >= 0 && idx < onlineState.episodes.length - 1 ? onlineState.episodes[idx + 1] : null;
  const prevBtn = document.getElementById("online-reader-prev");
  const nextBtn = document.getElementById("online-reader-next");
  if (prevBtn) prevBtn.disabled = !prevEp;
  if (nextBtn) nextBtn.disabled = !nextEp;

  renderOnlineBreadcrumb();
}

async function openOnlineEpisodeScroll(wrId, opts = {}) {
  const strip = document.getElementById("online-reader-strip");
  if (strip) strip.innerHTML = "";
  onlineState.loadedIds = [];

  try {
    const images = await fetchOnlineEpisodeImages(wrId);
    appendOnlineEpisodeToStrip(wrId, images);
    setupOnlineSentinel();
    setupOnlinePositionObserver();

    if (opts.jumpToPageIndex) {
      const target = document.querySelector(
        `#online-reader-strip img[data-episode-id="${cssEscape(wrId)}"][data-page-index="${opts.jumpToPageIndex}"]`
      );
      if (target) {
        target.scrollIntoView({ block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  } catch (err) {
    if (strip) strip.innerHTML = `<div class="empty-state">이미지를 불러오지 못했습니다: ${escapeHtml(err.message)}</div>`;
  }
}

function appendOnlineEpisodeToStrip(wrId, images) {
  const ep = onlineState.episodes.find((e) => e.wr_id === wrId);
  const strip = document.getElementById("online-reader-strip");
  if (!strip) return;

  const dividerHtml = `<div class="chapter-divider" data-episode-id="${escapeAttr(wrId)}">${escapeHtml(ep ? ep.title : wrId)} &middot; ${images.length}장</div>`;
  const pagesHtml = images
    .map(
      (url, i) =>
        `<img src="${url}" loading="lazy" alt="${i + 1}" data-episode-id="${escapeAttr(wrId)}" data-page-index="${i + 1}" data-page-total="${images.length}" />`
    )
    .join("");

  const wrapper = document.createElement("div");
  wrapper.innerHTML = dividerHtml + pagesHtml;
  while (wrapper.firstChild) strip.appendChild(wrapper.firstChild);

  onlineState.loadedIds.push(wrId);

  const oldSentinel = document.getElementById("online-reader-sentinel");
  if (oldSentinel) {
    if (onlineReaderRuntime.sentinelObserver) onlineReaderRuntime.sentinelObserver.unobserve(oldSentinel);
    oldSentinel.remove();
  }
  const sentinel = document.createElement("div");
  sentinel.id = "online-reader-sentinel";
  sentinel.dataset.episodeId = wrId;
  strip.appendChild(sentinel);

  if (onlineReaderRuntime.positionObserver) {
    strip.querySelectorAll(`img[data-episode-id="${cssEscape(wrId)}"]`).forEach((img) => {
      onlineReaderRuntime.positionObserver.observe(img);
    });
  }
  if (onlineReaderRuntime.sentinelObserver) {
    onlineReaderRuntime.sentinelObserver.observe(sentinel);
  }
}

function setupOnlineSentinel() {
  onlineReaderRuntime.sentinelObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) onOnlineReachEnd(entry.target.dataset.episodeId);
      });
    },
    { rootMargin: "0px 0px 600px 0px" }
  );
  const sentinel = document.getElementById("online-reader-sentinel");
  if (sentinel) onlineReaderRuntime.sentinelObserver.observe(sentinel);
}

async function onOnlineReachEnd(fromWrId) {
  if (onlineReaderRuntime.loadingNext || onlineReaderRuntime.noMoreEpisodes) return;

  const idx = onlineState.episodes.findIndex((e) => e.wr_id === fromWrId);
  // Newest-first listing: the chronologically-next episode sits at a lower index.
  const nextEp = idx > 0 ? onlineState.episodes[idx - 1] : null;

  if (!nextEp) {
    onlineReaderRuntime.noMoreEpisodes = true;
    const strip = document.getElementById("online-reader-strip");
    if (strip) {
      const note = document.createElement("div");
      note.className = "reader-end-note";
      note.textContent = "이 페이지의 마지막 회차입니다. (다른 페이지는 회차 목록에서 이동)";
      strip.appendChild(note);
    }
    if (onlineReaderRuntime.sentinelObserver) onlineReaderRuntime.sentinelObserver.disconnect();
    return;
  }

  if (onlineState.loadedIds.includes(nextEp.wr_id)) return;

  onlineReaderRuntime.loadingNext = true;
  try {
    const images = await fetchOnlineEpisodeImages(nextEp.wr_id);
    appendOnlineEpisodeToStrip(nextEp.wr_id, images);
  } catch (err) {
    // network hiccup mid-scroll; sentinel stays in place so the user can retry by scrolling again
  } finally {
    onlineReaderRuntime.loadingNext = false;
  }
}

function setupOnlinePositionObserver() {
  onlineReaderRuntime.positionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length === 0) return;
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const top = visible[0].target;
      onOnlineActivePageChange(top.dataset.episodeId, Number(top.dataset.pageIndex), Number(top.dataset.pageTotal));
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  document.querySelectorAll("#online-reader-strip img").forEach((img) => onlineReaderRuntime.positionObserver.observe(img));
}

function onOnlineActivePageChange(wrId, pageIndex, pageTotal) {
  const indicator = document.getElementById("online-page-indicator");
  if (indicator) {
    indicator.hidden = false;
    indicator.textContent = `${pageIndex} / ${pageTotal}`;
  }

  if (wrId !== onlineState.activeEpisodeId) {
    onlineState.activeEpisodeId = wrId;
    updateOnlineReaderChrome();
  }
}

/* ---- 리더: 페이지 넘김 ---- */

async function openOnlineEpisodePaged(wrId, opts = {}) {
  const pagerBox = document.getElementById("online-reader-pager");
  try {
    const images = await fetchOnlineEpisodeImages(wrId);
    onlineReaderRuntime.paged.episodeId = wrId;
    onlineReaderRuntime.paged.images = images;

    let startIndex = 0;
    if (opts.startAtEnd) {
      startIndex = images.length - 1;
    } else if (opts.startIndex) {
      startIndex = Math.min(Math.max(opts.startIndex - 1, 0), images.length - 1);
    }
    if (onlineReaderRuntime.paged.pagesPerView === 2) startIndex = alignToPairStart(startIndex);
    onlineReaderRuntime.paged.index = Math.max(startIndex, 0);
    onlineState.loadedIds = [wrId];
    onlineState.activeEpisodeId = wrId;
    renderOnlinePagedImage();
  } catch (err) {
    if (pagerBox) pagerBox.innerHTML = `<div class="empty-state">이미지를 불러오지 못했습니다: ${escapeHtml(err.message)}</div>`;
  }
}

function renderOnlinePagedImage() {
  const { images, index } = onlineReaderRuntime.paged;
  const pagerBox = document.getElementById("online-reader-pager");
  if (!pagerBox) return;
  if (images.length === 0) {
    pagerBox.innerHTML = '<div class="empty-state">이 회차에는 이미지가 없습니다.</div>';
    return;
  }

  const dual = onlineReaderRuntime.paged.pagesPerView === 2;
  pagerBox.classList.toggle("dual", dual);

  let pageIndexes;
  if (dual) {
    const a = index;
    const b = index + 1 < images.length ? index + 1 : null;
    pageIndexes = onlineReaderRuntime.direction === "ltr" ? [a, b] : [b, a];
    pageIndexes = pageIndexes.filter((i) => i !== null);
  } else {
    pageIndexes = [index];
  }

  pagerBox.innerHTML = [
    `<div class="page-zone page-zone-left" id="online-page-zone-left" title="이전 쪽"></div>`,
    ...pageIndexes.map((i) => `<img class="pager-image" src="${images[i]}" alt="${i + 1}" />`),
    `<div class="page-zone page-zone-right" id="online-page-zone-right" title="다음 쪽"></div>`,
  ].join("");

  document
    .getElementById("online-page-zone-left")
    .addEventListener("click", () => onlinePagerStep(onlineReaderRuntime.direction === "ltr" ? -1 : 1));
  document
    .getElementById("online-page-zone-right")
    .addEventListener("click", () => onlinePagerStep(onlineReaderRuntime.direction === "ltr" ? 1 : -1));

  const indicator = document.getElementById("online-page-indicator");
  if (indicator) {
    indicator.hidden = false;
    indicator.textContent = dual && pageIndexes.length === 2 ? `${index + 1}-${index + 2} / ${images.length}` : `${index + 1} / ${images.length}`;
  }

  updateOnlineReaderChrome();
}

async function onlinePagerStep(direction) {
  if (onlineReaderRuntime.paged.loading) return;
  const { images, index, episodeId, pagesPerView } = onlineReaderRuntime.paged;
  const step = pagesPerView === 2 ? 2 : 1;
  const nextLocalIndex = index + direction * step;

  if (nextLocalIndex >= 0 && nextLocalIndex < images.length) {
    onlineReaderRuntime.paged.index = pagesPerView === 2 ? alignToPairStart(nextLocalIndex) : nextLocalIndex;
    renderOnlinePagedImage();
    return;
  }

  // Newest-first listing: moving forward in story order (direction > 0) means walking
  // to a LOWER array index, same reasoning as gotoOnlineRelativeEpisode/onOnlineReachEnd.
  const idx = onlineState.episodes.findIndex((e) => e.wr_id === episodeId);
  onlineReaderRuntime.paged.loading = true;
  try {
    if (direction > 0) {
      if (idx <= 0) return;
      await openOnlineEpisodePaged(onlineState.episodes[idx - 1].wr_id, { startIndex: 1 });
    } else {
      if (idx === -1 || idx >= onlineState.episodes.length - 1) return;
      await openOnlineEpisodePaged(onlineState.episodes[idx + 1].wr_id, { startAtEnd: true });
    }
  } finally {
    onlineReaderRuntime.paged.loading = false;
  }
}

/* ---- 공통: 회차 이동 · 페이지 점프 · 키보드 ---- */

function gotoOnlineRelativeEpisode(direction) {
  const activeId = onlineState.activeEpisodeId || onlineState.episodeId;
  const idx = onlineState.episodes.findIndex((e) => e.wr_id === activeId);
  // The site lists episodes newest-first, so moving forward in story order (direction
  // > 0, the "다음 화" button) means walking to a LOWER array index, not a higher one.
  const targetIdx = idx - direction;
  if (targetIdx < 0 || targetIdx >= onlineState.episodes.length) return;
  const targetEp = onlineState.episodes[targetIdx];

  // Set before the (async) episode load resolves, so the title bar reflects the
  // new episode immediately rather than waiting on the scroll-position observer
  // (which only fires once the user scrolls the new page into its tracked band).
  onlineState.activeEpisodeId = targetEp.wr_id;
  updateOnlineReaderChrome();

  if (onlineReaderRuntime.viewMode === "paged") {
    openOnlineEpisodePaged(targetEp.wr_id, { startIndex: 1 });
    return;
  }

  if (direction > 0 && onlineState.loadedIds.includes(targetEp.wr_id)) {
    const divider = document.querySelector(`.chapter-divider[data-episode-id="${cssEscape(targetEp.wr_id)}"]`);
    if (divider) {
      divider.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  teardownOnlineReaderObservers();
  openOnlineEpisodeScroll(targetEp.wr_id, {});
}

function jumpToOnlinePage() {
  const input = document.getElementById("online-reader-jump-input");
  const n = Number(input.value);
  if (!n || n < 1) return;

  if (onlineReaderRuntime.viewMode === "paged") {
    if (n > onlineReaderRuntime.paged.images.length) return;
    let idx = n - 1;
    if (onlineReaderRuntime.paged.pagesPerView === 2) idx = alignToPairStart(idx);
    onlineReaderRuntime.paged.index = idx;
    renderOnlinePagedImage();
    return;
  }

  const activeId = onlineState.activeEpisodeId || onlineState.episodeId;
  const target = document.querySelector(`#online-reader-strip img[data-episode-id="${cssEscape(activeId)}"][data-page-index="${n}"]`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("keydown", (e) => {
  if (onlineState.view !== "reader" || panelOnline.hidden) return;
  const tag = (document.activeElement && document.activeElement.tagName) || "";
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (key === "f") {
    e.preventDefault();
    toggleImmersive();
    return;
  }
  if (key === "l") {
    e.preventDefault();
    openOnlineEpisodes(onlineState.toonId, onlineState.seriesTitle, onlineState.page);
    return;
  }
  if (key === "n") {
    e.preventDefault();
    gotoOnlineRelativeEpisode(1);
    return;
  }
  if (key === "p") {
    e.preventDefault();
    gotoOnlineRelativeEpisode(-1);
    return;
  }

  if (onlineReaderRuntime.viewMode === "paged") {
    if (key === "ArrowRight" || key === " " || key === "d") {
      e.preventDefault();
      onlinePagerStep(onlineReaderRuntime.direction === "ltr" ? 1 : -1);
    } else if (key === "ArrowLeft" || key === "a") {
      e.preventDefault();
      onlinePagerStep(onlineReaderRuntime.direction === "ltr" ? -1 : 1);
    } else if (key === "Home") {
      e.preventDefault();
      onlineReaderRuntime.paged.index = 0;
      renderOnlinePagedImage();
    } else if (key === "End") {
      e.preventDefault();
      const lastIdx = onlineReaderRuntime.paged.images.length - 1;
      onlineReaderRuntime.paged.index = onlineReaderRuntime.paged.pagesPerView === 2 ? alignToPairStart(lastIdx) : lastIdx;
      renderOnlinePagedImage();
    }
    return;
  }

  if (key === " " || key === "PageDown" || key === "ArrowDown" || key === "s") {
    e.preventDefault();
    window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
  } else if (key === "PageUp" || key === "ArrowUp" || key === "w") {
    e.preventDefault();
    window.scrollBy({ top: -window.innerHeight * 0.9, behavior: "smooth" });
  } else if (key === "Home") {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (key === "End") {
    e.preventDefault();
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }
});
