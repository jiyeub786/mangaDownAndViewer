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

// Which site a search result came from — set when a result card is clicked (see
// renderSearchResults below) so the next job submission dispatches to the right
// crawler. Stays set across repeated submits (e.g. adjusting page range and
// re-submitting the same title) until a different result is picked.
let pendingJobSource = "site2";
let pendingJobListPrefix = null;

// wfwf's mirror domain rotates (wfwf443 -> wfwf488 -> ...) so its default is just
// today's known-working one — meant to be edited in the site_url field, not relied on.
const SITE_KIND_DEFAULT_URL = {
  site2: "http://103.204.13.68:8905",
  wfwf: "https://wfwf488.com",
};

// Swaps a site_url-ish input to the newly-picked site kind's default, but only when
// the field is empty or still holds another kind's default — never clobbers a
// custom mirror URL the user actually typed in.
function applySiteKindDefault(kind, inputEl) {
  const current = inputEl.value.trim();
  if (!current || Object.values(SITE_KIND_DEFAULT_URL).includes(current)) {
    inputEl.value = SITE_KIND_DEFAULT_URL[kind];
  }
}

jobForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const startPage = Number(document.getElementById("start_page").value);
  const endPage = Number(document.getElementById("end_page").value);
  const episodeMode = currentRangeMode() === "episodes";
  const selectedEpisodes = episodeMode ? getSelectedEpisodes() : null;
  if (episodeMode && selectedEpisodes.length === 0) {
    alert("다운로드할 회차를 하나 이상 선택하세요.");
    return;
  }
  if (!episodeMode && endPage < startPage) {
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
    source: pendingJobSource,
    list_prefix: pendingJobListPrefix,
    episodes: selectedEpisodes,
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
  const runningCount = jobsCache.filter((j) => j.status === "running" || j.status === "pending").length;
  const countEl = document.getElementById("job-running-count");
  if (countEl) countEl.textContent = runningCount ? `(${runningCount}개 진행중)` : "";

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
const siteKindSelect = document.getElementById("site-kind");

searchBtn.addEventListener("click", runTitleSearch);
searchQueryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    runTitleSearch();
  }
});
siteKindSelect.addEventListener("change", () => {
  applySiteKindDefault(siteKindSelect.value, document.getElementById("site_url"));
});

async function runTitleSearch() {
  const siteUrl = document.getElementById("site_url").value.trim();
  const query = searchQueryInput.value.trim();
  const kind = siteKindSelect.value;

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

  const endpoint = kind === "wfwf" ? "/api/wfwf/search" : "/api/search";
  try {
    const resp = await fetch(`${endpoint}?site_url=${encodeURIComponent(siteUrl)}&query=${encodeURIComponent(query)}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `요청 실패 (${resp.status})`);
    }
    const results = await resp.json();
    renderSearchResults(results, kind);
  } catch (err) {
    searchResultsEl.innerHTML = `<div class="empty-state">검색 실패: ${escapeHtml(err.message)}</div>`;
  } finally {
    searchBtn.disabled = false;
  }
}

function renderSearchResults(results, kind) {
  if (results.length === 0) {
    searchResultsEl.innerHTML = '<div class="empty-state">검색 결과가 없습니다.</div>';
    return;
  }

  searchResultsEl.innerHTML = results
    .map(
      (r) => `
        <button type="button" class="search-result-item" data-result-id="${r.id}" data-result-title="${escapeAttr(r.title)}" data-result-prefix="${r.list_prefix || ""}">
          <div class="search-result-title">${escapeHtml(r.title)}</div>
          <div class="search-result-tags">ID ${r.id}${r.tags ? " &middot; " + escapeHtml(r.tags) : ""}${kind === "wfwf" && r.description ? " &middot; " + escapeHtml(r.description) : ""}</div>
        </button>
      `
    )
    .join("");

  searchResultsEl.querySelectorAll("[data-result-id]").forEach((el) => {
    el.addEventListener("click", () => {
      pendingJobSource = kind;
      pendingJobListPrefix = kind === "wfwf" ? el.getAttribute("data-result-prefix") : null;
      document.getElementById("toon_id").value = el.getAttribute("data-result-id");
      document.getElementById("title").value = el.getAttribute("data-result-title");
      clearEpisodeList();
      document.getElementById("title").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

/* ==================== 회차 선택 다운로드 (다운로드 탭) ==================== */

const episodeSelectEl = document.getElementById("episode-select");
const pageRangeFieldsEl = document.getElementById("page-range-fields");
const episodeListEl = document.getElementById("episode-list");
const episodeCountEl = document.getElementById("episode-count");
const episodeLoadBtn = document.getElementById("episode-load-btn");

// Full episode list ({num, wr_id, title, date}, oldest first) from /api/episodes/all.
// num is the title-wide episode number, so selected downloads land on the same
// file/folder names a full download would use.
let loadedEpisodes = [];
let lastEpisodeClickIndex = null; // anchor for Shift+click range selection

function currentRangeMode() {
  return document.querySelector('input[name="range_mode"]:checked').value;
}

document.querySelectorAll('input[name="range_mode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const episodeMode = currentRangeMode() === "episodes";
    episodeSelectEl.hidden = !episodeMode;
    pageRangeFieldsEl.hidden = episodeMode;
  });
});

// A list loaded for another title would download the wrong episodes — drop it
// whenever the title it belongs to may have changed.
function clearEpisodeList() {
  loadedEpisodes = [];
  lastEpisodeClickIndex = null;
  episodeListEl.innerHTML = "";
  updateEpisodeCount();
}
document.getElementById("toon_id").addEventListener("input", clearEpisodeList);
siteKindSelect.addEventListener("change", clearEpisodeList);

function episodeCheckboxes() {
  return Array.from(episodeListEl.querySelectorAll("input[data-ep-index]"));
}

function updateEpisodeCount() {
  const selected = episodeCheckboxes().filter((cb) => cb.checked).length;
  episodeCountEl.textContent = loadedEpisodes.length ? `${loadedEpisodes.length}개 중 ${selected}개 선택됨` : "";
}

function getSelectedEpisodes() {
  return episodeCheckboxes()
    .filter((cb) => cb.checked)
    .map((cb) => {
      const ep = loadedEpisodes[Number(cb.getAttribute("data-ep-index"))];
      return { wr_id: ep.wr_id, title: ep.title, num: ep.num };
    });
}

episodeLoadBtn.addEventListener("click", async () => {
  const siteUrl = document.getElementById("site_url").value.trim();
  const toonId = document.getElementById("toon_id").value.trim();
  if (!siteUrl || !toonId) {
    alert("사이트 주소와 작품 ID를 먼저 입력하세요.");
    return;
  }

  clearEpisodeList();
  episodeLoadBtn.disabled = true;
  episodeListEl.innerHTML = '<div class="empty-state">회차 목록을 불러오는 중...</div>';
  const params = new URLSearchParams({
    site_url: siteUrl,
    toon_id: toonId,
    source: pendingJobSource,
    list_prefix: pendingJobListPrefix || "",
  });
  try {
    const resp = await fetch(`/api/episodes/all?${params}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `요청 실패 (${resp.status})`);
    }
    loadedEpisodes = (await resp.json()).episodes;
    renderEpisodeList();
  } catch (err) {
    episodeListEl.innerHTML = `<div class="empty-state">불러오기 실패: ${escapeHtml(err.message)}</div>`;
  } finally {
    episodeLoadBtn.disabled = false;
  }
});

function renderEpisodeList() {
  if (loadedEpisodes.length === 0) {
    episodeListEl.innerHTML = '<div class="empty-state">회차가 없습니다.</div>';
    updateEpisodeCount();
    return;
  }
  episodeListEl.innerHTML = loadedEpisodes
    .map(
      (ep, i) => `
        <label class="episode-item">
          <input type="checkbox" data-ep-index="${i}" />
          <span class="episode-num">${ep.num}</span>
          <span class="episode-title">${escapeHtml(ep.title)}</span>
          ${ep.date ? `<span class="episode-date">${escapeHtml(ep.date)}</span>` : ""}
        </label>
      `
    )
    .join("");

  episodeCheckboxes().forEach((cb) => {
    cb.addEventListener("click", (e) => {
      const index = Number(cb.getAttribute("data-ep-index"));
      if (e.shiftKey && lastEpisodeClickIndex !== null) {
        const [from, to] = [Math.min(lastEpisodeClickIndex, index), Math.max(lastEpisodeClickIndex, index)];
        const boxes = episodeCheckboxes();
        for (let k = from; k <= to; k++) boxes[k].checked = cb.checked;
      }
      lastEpisodeClickIndex = index;
      updateEpisodeCount();
    });
  });
  updateEpisodeCount();
}

function setAllEpisodes(checked) {
  episodeCheckboxes().forEach((cb) => (cb.checked = checked));
  updateEpisodeCount();
}
document.getElementById("episode-all-btn").addEventListener("click", () => setAllEpisodes(true));
document.getElementById("episode-none-btn").addEventListener("click", () => setAllEpisodes(false));

/* ==================== 뷰어 탭 ==================== */

const tabButtons = document.querySelectorAll(".tab-btn");
const panelDownload = document.getElementById("tab-panel-download");
const panelViewer = document.getElementById("tab-panel-viewer");
const panelOnline = document.getElementById("tab-panel-online");
const panelHitomi = document.getElementById("tab-panel-hitomi");
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

function activateTab(tab) {
  tabButtons.forEach((b) => b.classList.toggle("active", b.getAttribute("data-tab") === tab));
  exitFullscreenIfActive();
  document.body.classList.remove("immersive");
  // Leaving a reader mid-read via the tab switch (rather than its own back/library
  // button) previously left its observers running and its `view` stuck at "reader" in
  // the background — harmless on its own, but combined with opening the other
  // reader it made both keydown listeners fire for one keypress. Tearing down here
  // closes that off regardless of which reader (if any) is currently open.
  if (tab !== "viewer") teardownReaderObservers();
  if (tab !== "online") teardownOnlineReaderObservers();
  if (tab !== "hitomi") teardownHitomiReaderObservers();
  panelDownload.hidden = tab !== "download";
  panelViewer.hidden = tab !== "viewer";
  panelOnline.hidden = tab !== "online";
  panelHitomi.hidden = tab !== "hitomi";
  if (tab === "viewer" && !viewerLoadedOnce) {
    viewerLoadedOnce = true;
    showTitles();
  }
  if (tab === "online" && !onlineLoadedOnce) {
    onlineLoadedOnce = true;
    showOnlineSearch();
  }
  if (tab === "hitomi" && !hitomiLoadedOnce) {
    hitomiLoadedOnce = true;
    showHitomiList();
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.getAttribute("data-tab")));
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
    // Scroll mode only refreshes the title bar once the position observer sees a
    // page (and even then, only on episode change) — without this, the "· n페이지"
    // suffix renderPagedImage left behind would linger after switching away from
    // paged mode until the reader happened to cross an episode boundary.
    updateReaderChrome(title);
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
  if (titleEl) {
    let text = `${title} · ${activeEp ? activeEp.name : activeId}`;
    if (readerRuntime.viewMode === "paged") {
      const { index, images, pagesPerView } = readerRuntime.paged;
      if (images.length > 0) {
        const hasSecondPage = pagesPerView === 2 && index + 1 < images.length;
        text += hasSecondPage ? ` · ${index + 1}, ${index + 2} 페이지` : ` · ${index + 1}페이지`;
      }
    }
    titleEl.textContent = text;
  }

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

  // Paged mode shows its page number inline in the title bar (updateReaderChrome)
  // instead of the corner pill, which is scroll mode's — keep it hidden here so a
  // leftover scroll-mode reading doesn't show through after switching modes.
  const indicator = document.getElementById("page-indicator");
  if (indicator) indicator.hidden = true;

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
  const hitomiBtn = document.getElementById("hitomi-reader-immersive-btn");
  if (hitomiBtn) hitomiBtn.textContent = label;
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
  source: "site2", // site2 | wfwf — which site's parser the backend should use
  listPrefix: "", // wfwf only: "list" | "cl" (from the search result that got us here)
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
  onlineState.listPrefix = "";
  teardownOnlineReaderObservers();
  exitFullscreenIfActive();
  document.body.classList.remove("immersive");

  // First visit: default to whatever site kind/URL is already picked in the download
  // form, since it's very likely the same site — saves re-picking it.
  if (!onlineState.siteUrl) {
    onlineState.source = document.getElementById("site-kind").value;
    const downloadSiteUrl = document.getElementById("site_url").value.trim();
    if (downloadSiteUrl) onlineState.siteUrl = downloadSiteUrl;
  }

  renderOnlineBreadcrumb();

  onlineBody.innerHTML = `
    <section class="card">
      <h2>사이트에서 검색</h2>
      <div class="field">
        <label for="online-site-kind">사이트 종류</label>
        <select id="online-site-kind">
          <option value="site2" ${onlineState.source !== "wfwf" ? "selected" : ""}>11툰</option>
          <option value="wfwf" ${onlineState.source === "wfwf" ? "selected" : ""}>늑대닷컴</option>
        </select>
      </div>
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
  document.getElementById("online-site-kind").addEventListener("change", (e) => {
    applySiteKindDefault(e.target.value, document.getElementById("online-site-url"));
  });
}

async function runOnlineSearch() {
  const siteUrl = document.getElementById("online-site-url").value.trim();
  const query = document.getElementById("online-search-query").value.trim();
  const kind = document.getElementById("online-site-kind").value;
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

  onlineState.source = kind;
  const endpoint = kind === "wfwf" ? "/api/wfwf/search" : "/api/search";
  try {
    const resp = await fetch(`${endpoint}?site_url=${encodeURIComponent(onlineState.siteUrl)}&query=${encodeURIComponent(query)}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `요청 실패 (${resp.status})`);
    }
    const results = await resp.json();
    renderOnlineSearchResults(results, kind);
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty-state">검색 실패: ${escapeHtml(err.message)}</div>`;
  }
}

function renderOnlineSearchResults(results, kind) {
  const resultsEl = document.getElementById("online-search-results");
  if (results.length === 0) {
    resultsEl.innerHTML = '<div class="empty-state">검색 결과가 없습니다.</div>';
    return;
  }

  resultsEl.innerHTML = results
    .map(
      (r) => `
        <button type="button" class="search-result-item" data-toon-id="${r.id}" data-toon-title="${escapeAttr(r.title)}" data-toon-prefix="${r.list_prefix || ""}">
          <div class="search-result-title">${escapeHtml(r.title)}</div>
          <div class="search-result-tags">ID ${r.id}${r.tags ? " &middot; " + escapeHtml(r.tags) : ""}${kind === "wfwf" && r.description ? " &middot; " + escapeHtml(r.description) : ""}</div>
        </button>
      `
    )
    .join("");

  resultsEl.querySelectorAll("[data-toon-id]").forEach((el) => {
    el.addEventListener("click", () => {
      onlineState.listPrefix = el.getAttribute("data-toon-prefix");
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
      `/api/online/episodes?site_url=${encodeURIComponent(onlineState.siteUrl)}&toon_id=${toonId}&page=${page}` +
        `&source=${encodeURIComponent(onlineState.source)}&list_prefix=${encodeURIComponent(onlineState.listPrefix)}`
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
    `/api/online/images?site_url=${encodeURIComponent(onlineState.siteUrl)}&toon_id=${onlineState.toonId}&wr_id=${encodeURIComponent(wrId)}` +
      `&source=${encodeURIComponent(onlineState.source)}&list_prefix=${encodeURIComponent(onlineState.listPrefix)}`
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

/* ====================================================================
   hitomi 탭 — hitomi.la 목록 조회, 갤러리 열람(전체 스크롤), 관련 작품,
   zip 다운로드(기존 /api/jobs 작업 큐 재사용, source="hitomi").
   ==================================================================== */

const hitomiBody = document.getElementById("hitomi-body");
let hitomiLoadedOnce = false;

// Fixed checklist of tag substrings the user can exclude from the list (matched
// case-insensitively against the "Tags:" text server-side). Add more here if
// asked for another one — the UI/state/API plumbing doesn't need to change.
const HITOMI_TAG_FILTERS = [
  { key: "♂", label: "♂ 태그 제외" },
  { key: "loli", label: "loli 태그 제외" },
];

// Pagination is by raw .nozomi offset, not page number — excludeTags can drop
// items, which breaks a simple "page N = bytes N*80..." mapping (see
// app/hitomi.py's _fetch_nozomi_page). offsetStack remembers each page's starting
// offset so "이전 페이지" can go back without the server needing to track any
// session state: push before going forward, pop before going back.
const hitomiState = {
  view: "list",
  offsetStack: [0],
  hasMore: false,
  nextOffset: 0,
  artist: null,
  artistName: null,
  excludeTags: [],
  // 체크박스가 지금 가리키는 상태(아직 미적용) — "적용" 버튼을 눌러야
  // excludeTags로 확정되고 리로드된다(체크박스 하나 누를 때마다 매번
  // 다시 불러오던 불편함 개선).
  pendingExcludeTags: [],
  filterPanelOpen: false,
  galleryData: null,
  // Title/tag text search (여러 단어 = AND) — 작가 필터와는 배타적으로 동작
  // (검색을 시작하면 작가 필터를 비우고, 작가를 고르면 검색어를 비운다).
  searchQuery: "",
};

// Ctrl/가운데 클릭으로 새 탭에서 열기가 되도록 hitomi 전용 클릭 요소를 실제
// <a href> 링크로 렌더링할 때 쓰는 쿼리스트링 — 페이지 로드 시 이 값을 다시
// 읽어 그 화면으로 바로 진입한다(맨 아래 "hitomi 딥링크" 절 참고).
function hitomiGalleryUrl(id) {
  return `?tab=hitomi&view=gallery&id=${id}`;
}
function hitomiArtistUrl(slug, name) {
  const params = new URLSearchParams({ tab: "hitomi", view: "list", artist: slug });
  if (name) params.set("artistName", name);
  return `?${params.toString()}`;
}

async function loadHitomiListOffset(offset) {
  hitomiState.view = "list";
  teardownHitomiReaderObservers();
  exitFullscreenIfActive();
  document.body.classList.remove("immersive");
  hitomiBody.innerHTML = '<div class="empty-state">불러오는 중...</div>';

  try {
    const params = new URLSearchParams({ offset: String(offset) });
    if (hitomiState.excludeTags.length) params.set("exclude_tags", hitomiState.excludeTags.join(","));
    let endpoint = "/api/hitomi/list";
    if (hitomiState.searchQuery) {
      endpoint = "/api/hitomi/search";
      params.set("query", hitomiState.searchQuery);
    } else if (hitomiState.artist) {
      params.set("artist", hitomiState.artist);
    }
    const resp = await fetch(`${endpoint}?${params}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `요청 실패 (${resp.status})`);
    }
    const data = await resp.json();
    hitomiState.nextOffset = data.next_offset;
    hitomiState.hasMore = data.has_more;
    renderHitomiList(data.items);
  } catch (err) {
    hitomiBody.innerHTML = `<div class="empty-state">목록을 불러오지 못했습니다: ${escapeHtml(err.message)}</div>`;
  }
}

// Starts a fresh browse from the top — artist filter (or null to clear it) and
// the current excludeTags apply. Used for the initial tab open, an artist-name
// click, and "전체 목록으로". Also clears any active search — artist filter and
// search are mutually exclusive modes.
function showHitomiList(artist = null, artistName = null) {
  hitomiState.artist = artist;
  hitomiState.artistName = artistName;
  hitomiState.searchQuery = "";
  hitomiState.offsetStack = [0];
  return loadHitomiListOffset(0);
}

// Starts a fresh title/tag search — clears the artist filter (mutually exclusive).
function runHitomiSearch(query) {
  query = query.trim();
  if (!query) return;
  hitomiState.searchQuery = query;
  hitomiState.artist = null;
  hitomiState.artistName = null;
  hitomiState.offsetStack = [0];
  return loadHitomiListOffset(0);
}

// Re-renders whichever page is currently on top of the stack, unchanged — for
// "← 목록"/`l` returning from a gallery without losing your place.
function hitomiReloadCurrentList() {
  return loadHitomiListOffset(hitomiState.offsetStack[hitomiState.offsetStack.length - 1]);
}

function hitomiNextPage() {
  hitomiState.offsetStack.push(hitomiState.nextOffset);
  return loadHitomiListOffset(hitomiState.nextOffset);
}

function hitomiPrevPage() {
  if (hitomiState.offsetStack.length <= 1) return;
  hitomiState.offsetStack.pop();
  return loadHitomiListOffset(hitomiState.offsetStack[hitomiState.offsetStack.length - 1]);
}

function hitomiFirstPage() {
  if (hitomiState.offsetStack.length <= 1) return;
  hitomiState.offsetStack = [0];
  return loadHitomiListOffset(0);
}

// 체크박스 변경은 더 이상 즉시 리로드하지 않고 pendingExcludeTags만 갱신 —
// "적용" 버튼을 눌러야 excludeTags로 확정된다(applyHitomiTagFilters).
function toggleHitomiPendingTagFilter(key) {
  const idx = hitomiState.pendingExcludeTags.indexOf(key);
  if (idx === -1) hitomiState.pendingExcludeTags.push(key);
  else hitomiState.pendingExcludeTags.splice(idx, 1);
}

function applyHitomiTagFilters() {
  hitomiState.excludeTags = [...hitomiState.pendingExcludeTags];
  hitomiState.offsetStack = [0];
  return loadHitomiListOffset(0);
}

// 위/아래 페이저에서 공유하는 버튼 마크업 — id만 suffix로 구분해서 같은
// 화면에 두 벌이 있어도 DOM id가 안 겹치게 한다.
function hitomiPagerButtonsHtml(suffix) {
  const pageNum = hitomiState.offsetStack.length;
  return `
    <button type="button" class="btn btn-secondary btn-sm" style="width:auto;" id="hitomi-first-page${suffix}" ${pageNum <= 1 ? "disabled" : ""}>처음 페이지</button>
    <button type="button" class="btn btn-secondary btn-sm" style="width:auto;" id="hitomi-prev-page${suffix}" ${pageNum <= 1 ? "disabled" : ""}>이전 페이지</button>
    <span class="hint">${pageNum}페이지</span>
    <button type="button" class="btn btn-secondary btn-sm" style="width:auto;" id="hitomi-next-page${suffix}" ${hitomiState.hasMore ? "" : "disabled"}>다음 페이지</button>`;
}

function wireHitomiPagerButtons(suffix) {
  document.getElementById(`hitomi-first-page${suffix}`).addEventListener("click", hitomiFirstPage);
  document.getElementById(`hitomi-prev-page${suffix}`).addEventListener("click", hitomiPrevPage);
  document.getElementById(`hitomi-next-page${suffix}`).addEventListener("click", hitomiNextPage);
}

function renderHitomiList(items) {
  // 리로드가 끝났으니 체크박스 상태를 다시 실제 적용된 필터와 맞춘다.
  hitomiState.pendingExcludeTags = [...hitomiState.excludeTags];

  const searchBar = `
    <div class="action-row">
      <input type="text" id="hitomi-search-input" placeholder="작품명/태그 검색 (여러 단어 = AND, 한국어 작품만)" value="${escapeAttr(hitomiState.searchQuery)}" style="flex:1; min-width:200px;" />
      <button type="button" class="btn btn-primary btn-sm" style="width:auto;" id="hitomi-search-btn">검색</button>
    </div>`;

  const modeBar = hitomiState.searchQuery
    ? `<span class="hint">검색: "${escapeHtml(hitomiState.searchQuery)}"</span>
       <button type="button" class="btn btn-secondary btn-sm" style="width:auto;" id="hitomi-clear-artist">전체 목록으로</button>`
    : hitomiState.artist
    ? `<span class="hint">작가: ${escapeHtml(hitomiState.artistName || hitomiState.artist)}</span>
       <button type="button" class="btn btn-secondary btn-sm" style="width:auto;" id="hitomi-clear-artist">전체 목록으로</button>`
    : "";
  const pager = `<div class="action-row">${modeBar}${hitomiPagerButtonsHtml("")}</div>`;
  // 목록이 길면 다음 페이지로 넘어가려고 맨 위로 다시 스크롤해야 하는 불편함이
  // 있어서, 같은 버튼을 그리드 아래에도 한 번 더 둔다(id만 접미사로 구분).
  const bottomPager = items.length > 0 ? `<div class="action-row">${hitomiPagerButtonsHtml("-bottom")}</div>` : "";

  // 필터 목록은 나중에 더 추가될 수 있어서(HITOMI_TAG_FILTERS), 화면에 늘 펼쳐
  // 두지 않고 접이식으로 묶어 공간을 아낀다. 펼침 상태는 체크박스를 눌러도
  // (매번 목록을 다시 그리므로) 유지되도록 hitomiState에 따로 기억해 둔다.
  const activeCount = hitomiState.excludeTags.length;
  const filterPanel = `
    <details class="hitomi-collapsible" id="hitomi-filter-details" ${hitomiState.filterPanelOpen ? "open" : ""}>
      <summary>태그 필터${activeCount ? ` (${activeCount}개 적용중)` : ""}</summary>
      <div class="action-row">
        ${HITOMI_TAG_FILTERS.map(
          (f) => `
            <label class="checkbox-row" style="margin:0;">
              <input type="checkbox" data-tag-filter="${escapeAttr(f.key)}" ${hitomiState.pendingExcludeTags.includes(f.key) ? "checked" : ""} />
              ${escapeHtml(f.label)}
            </label>`
        ).join("")}
        <button type="button" class="btn btn-primary btn-sm" style="width:auto;" id="hitomi-filter-apply">적용</button>
      </div>
    </details>`;

  const gridHtml = items.length === 0
    ? '<div class="empty-state">항목이 없습니다(필터가 너무 좁을 수 있음 — "다음 페이지"를 눌러 더 찾아보세요).</div>'
    : `<div class="hitomi-grid">${items.map(renderHitomiCard).join("")}</div>`;

  hitomiBody.innerHTML = searchBar + pager + filterPanel + gridHtml + bottomPager;

  document.getElementById("hitomi-search-btn").addEventListener("click", () => {
    runHitomiSearch(document.getElementById("hitomi-search-input").value);
  });
  document.getElementById("hitomi-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runHitomiSearch(e.target.value);
  });
  document.getElementById("hitomi-filter-details").addEventListener("toggle", (e) => {
    hitomiState.filterPanelOpen = e.target.open;
  });
  hitomiBody.querySelectorAll("[data-tag-filter]").forEach((el) => {
    el.addEventListener("change", () => toggleHitomiPendingTagFilter(el.getAttribute("data-tag-filter")));
  });
  document.getElementById("hitomi-filter-apply").addEventListener("click", applyHitomiTagFilters);
  wireHitomiPagerButtons("");
  if (items.length > 0) wireHitomiPagerButtons("-bottom");
  const clearArtistBtn = document.getElementById("hitomi-clear-artist");
  if (clearArtistBtn) clearArtistBtn.addEventListener("click", () => showHitomiList());
  wireHitomiGalleryLinks(hitomiBody);
  wireHitomiArtistLinks(hitomiBody);
  wireHitomiTagsToggle(hitomiBody);
}

// 작가명을 누르면 그 작가의 한국어 작품 목록으로 필터링(hitomi.la의
// /artist/{slug}-korean.html과 같은 규칙) — slug가 없는(파싱 실패한) 작가는
// 그냥 텍스트로만 표시. 목록 카드·상세보기 헤더 양쪽에서 재사용. 실제 href가
// 있는 <a>라 Ctrl/가운데 클릭으로 새 탭에서 열 수 있다(wireHitomiArtistLinks).
function hitomiArtistLinksHtml(artists) {
  return (artists || [])
    .map((a) =>
      a.slug
        ? `<a href="${escapeAttr(hitomiArtistUrl(a.slug, a.name))}" class="link-btn" data-open-artist="${escapeAttr(a.slug)}" data-open-artist-name="${escapeAttr(a.name)}">${escapeHtml(a.name)}</a>`
        : escapeHtml(a.name)
    )
    .join(", ");
}

function wireHitomiArtistLinks(container) {
  container.querySelectorAll("[data-open-artist]").forEach((el) => {
    el.addEventListener("click", (e) => {
      // list/related cards nest this link inside a [data-open-gallery] card —
      // without stopPropagation the click would also open that gallery.
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey || e.shiftKey) return; // 브라우저가 새 탭으로 열게 그대로 둔다
      e.preventDefault();
      showHitomiList(el.getAttribute("data-open-artist"), el.getAttribute("data-open-artist-name"));
    });
  });
}

// 갤러리 카드(목록/관련 작품)를 여는 오버레이 링크 배선 — renderHitomiCard가
// 만드는 [data-open-gallery] <a>가 대상. 실제 href가 있어 Ctrl/가운데 클릭은
// 새 탭으로, 일반 클릭은 SPA 화면 전환으로 처리한다.
function wireHitomiGalleryLinks(container) {
  container.querySelectorAll("[data-open-gallery]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      openHitomiGallery(Number(el.getAttribute("data-open-gallery")));
    });
  });
}

// decensored/uncensored 태그를 맨 앞으로, 나머지는 오름차순 정렬 — 이 두
// 키워드가 있으면 "앞 3개만 보이고 나머지 접기" 로직에서도 보통 바로 보이게
// 된다(renderHitomiTagsField가 정렬 후 자르기 때문).
function sortHitomiTags(tags) {
  const isSpecial = (t) => /decensored|uncensored/i.test(t);
  const pinned = tags.filter(isSpecial);
  const rest = tags.filter((t) => !isSpecial(t)).sort((a, b) => a.localeCompare(b));
  return [...pinned, ...rest];
}

// decensored/uncensored 단어를 빨간 볼드로 강조. escapeHtml로 먼저 이스케이프한
// 뒤 그 결과 문자열에 정규식을 적용한다 — 영문 단어라 이스케이프에 영향받지
// 않아 안전하다.
function highlightSpecialKeywords(text) {
  return escapeHtml(text).replace(/decensored|uncensored/gi, (m) => `<span class="hl-keyword">${m}</span>`);
}

// "[artist names] title", or "[N/A] title" when the gallery has no listed artist —
// shared by list/related cards and the detail header.
function hitomiTitleLine(title, artists) {
  const links = hitomiArtistLinksHtml(artists) || "N/A";
  return `[${links}] ${highlightSpecialKeywords(title)}`;
}

// Tags can run long (a dozen+) — show the first 3 and let a "+N개 더" toggle reveal
// the rest in place, instead of the card growing to fit every tag up front.
function renderHitomiTagsField(tagsStr) {
  if (!tagsStr) return "";
  const tags = sortHitomiTags(tagsStr.split(" / ").filter(Boolean));
  if (tags.length <= 3) {
    return `<div class="lib-count">Tags: ${tags.map(highlightSpecialKeywords).join(" / ")}</div>`;
  }
  const shown = tags.slice(0, 3).map(highlightSpecialKeywords).join(" / ");
  const rest = tags.slice(3).map(highlightSpecialKeywords).join(" / ");
  const moreLabel = `+${tags.length - 3}개 더`;
  return `
    <div class="lib-count">
      Tags: ${shown}<span data-tags-rest hidden> / ${rest}</span>
      <button type="button" class="link-btn" data-tags-toggle data-more-label="${escapeAttr(moreLabel)}">${moreLabel}</button>
    </div>
  `;
}

function wireHitomiTagsToggle(container) {
  container.querySelectorAll("[data-tags-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rest = btn.closest(".lib-count").querySelector("[data-tags-rest]");
      rest.hidden = !rest.hidden;
      btn.textContent = rest.hidden ? btn.getAttribute("data-more-label") : "접기";
    });
  });
}

function renderHitomiCard(item) {
  const cover = item.thumbnail_url
    ? `<img class="lib-cover" src="${escapeAttr(item.thumbnail_url)}" loading="lazy" alt="${escapeHtml(item.title)}" />`
    : `<div class="lib-cover-empty">이미지 없음</div>`;

  const fields = [
    ["쪽수", item.page_count ? `${item.page_count}쪽` : ""],
    ["Group", item.group],
    ["Type", item.type],
    ["Language", item.language],
    ["Series", item.series],
    ["Characters", item.characters],
  ];
  const fieldsHtml =
    fields
      .filter(([, value]) => value)
      .map(([label, value]) => `<div class="lib-count">${label}: ${escapeHtml(value)}</div>`)
      .join("") + renderHitomiTagsField(item.tags);

  return `
    <div class="lib-card">
      <a class="lib-card-link" href="${escapeAttr(hitomiGalleryUrl(item.id))}" data-open-gallery="${item.id}" aria-label="열기"></a>
      ${cover}
      <div class="lib-meta">
        <div class="lib-name">${hitomiTitleLine(item.title, item.artists)}</div>
        ${fieldsHtml}
        <div class="lib-count">${escapeHtml(item.date)}</div>
      </div>
    </div>
  `;
}

async function openHitomiGallery(galleryId) {
  hitomiState.view = "gallery";
  teardownHitomiReaderObservers();
  hitomiBody.innerHTML = '<div class="empty-state">불러오는 중...</div>';
  window.scrollTo({ top: 0 });

  try {
    const resp = await fetch(`/api/hitomi/gallery/${galleryId}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `요청 실패 (${resp.status})`);
    }
    const data = await resp.json();
    hitomiState.galleryData = data;
    renderHitomiGallery(data);
  } catch (err) {
    hitomiBody.innerHTML = `<div class="empty-state">불러오지 못했습니다: ${escapeHtml(err.message)}</div>`;
  }
}

/* ---- 상세보기 리더 — 뷰어/온라인 탭과 같은 스크롤·페이지 넘김·전체화면·
   방향전환·페이지 점프·키보드 단축키를 제공한다. 회차 개념이 없어(갤러리
   하나 = 이미지 배열 하나) 에피소드 경계를 넘나드는 부분(다음/이전 화,
   무한 스크롤 자동 로드)만 뺐다 — 보기모드/방향/1·2쪽 설정은 뷰어·온라인
   탭과 같은 localStorage 키를 공유해 취향이 이어지지만, 런타임 상태
   (hitomiReaderRuntime)는 독립적이다. ---- */

const hitomiReaderRuntime = {
  positionObserver: null,
  viewMode: loadStringPref(READER_VIEW_MODE_KEY, "scroll", ["scroll", "paged"]),
  direction: loadStringPref(READER_DIRECTION_KEY, "ltr", ["ltr", "rtl"]),
  paged: {
    images: [],
    index: 0,
    pagesPerView: Number(loadStringPref(READER_PAGES_KEY, "1", ["1", "2"])),
  },
};

function teardownHitomiReaderObservers() {
  if (hitomiReaderRuntime.positionObserver) hitomiReaderRuntime.positionObserver.disconnect();
  hitomiReaderRuntime.positionObserver = null;
}

function renderHitomiGallery(data) {
  const topBar = `
    <div class="action-row">
      <button type="button" class="btn btn-secondary btn-sm" style="width:auto;" id="hitomi-back-btn">← 목록</button>
      <button type="button" class="btn btn-primary btn-sm" style="width:auto;" id="hitomi-download-btn">zip으로 다운로드</button>
      <span class="hint" id="hitomi-download-status"></span>
    </div>`;

  // 상세보기는 목록 카드가 이미 Group/Type/Language/Series/Characters/Tags를
  // 다 보여주므로 여기선 [작가명] 작품명 + 날짜로만 단순 표기.
  // 관련 작품은 <details>로 접어둔 채 맨 위에 둔다 — 펼치기 전까진 공간을
  // 차지하지 않으면서도, 읽기 시작하기 전에 바로 보이는 위치.
  const relatedHtml = data.related.length
    ? `<details class="hitomi-collapsible">
         <summary>관련 작품 (${data.related.length})</summary>
         <div class="hitomi-grid">${data.related.map(renderHitomiCard).join("")}</div>
       </details>`
    : "";

  hitomiBody.innerHTML = `
    ${topBar}
    <div class="reader-header">
      <div>
        <div class="reader-title">${hitomiTitleLine(data.title, data.artists)}</div>
        <div class="hint">${escapeHtml(data.date)} &middot; ${data.images.length}쪽</div>
      </div>
      <div class="reader-nav">
        <div class="reader-jump">
          <input type="number" min="1" id="hitomi-reader-jump-input" placeholder="쪽" />
          <button type="button" class="btn btn-secondary btn-sm" id="hitomi-reader-jump-btn">이동</button>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="hitomi-reader-pages-btn" hidden></button>
        <button type="button" class="btn btn-secondary btn-sm" id="hitomi-reader-direction-btn" hidden></button>
        <button type="button" class="btn btn-secondary btn-sm" id="hitomi-reader-viewmode-btn"></button>
        <button type="button" class="btn btn-secondary btn-sm" id="hitomi-reader-immersive-btn">전체화면</button>
      </div>
    </div>
    ${relatedHtml}
    <div class="reader-strip" id="hitomi-reader-strip"></div>
    <div class="reader-pager" id="hitomi-reader-pager" hidden></div>
    <div class="page-indicator" id="hitomi-page-indicator" hidden></div>
  `;

  document.getElementById("hitomi-back-btn").addEventListener("click", hitomiReloadCurrentList);
  document.getElementById("hitomi-download-btn").addEventListener("click", () => startHitomiDownload(data));
  document.getElementById("hitomi-reader-immersive-btn").addEventListener("click", toggleImmersive);
  document.getElementById("hitomi-reader-jump-btn").addEventListener("click", jumpToHitomiPage);
  document.getElementById("hitomi-reader-jump-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") jumpToHitomiPage();
  });
  document.getElementById("hitomi-reader-viewmode-btn").addEventListener("click", toggleHitomiViewMode);
  document.getElementById("hitomi-reader-direction-btn").addEventListener("click", toggleHitomiDirection);
  document.getElementById("hitomi-reader-pages-btn").addEventListener("click", toggleHitomiPagesPerView);
  wireHitomiGalleryLinks(hitomiBody);
  wireHitomiArtistLinks(hitomiBody);
  wireHitomiTagsToggle(hitomiBody);

  applyHitomiViewModeUI();
  if (hitomiReaderRuntime.viewMode === "paged") {
    openHitomiPaged(data);
  } else {
    renderHitomiScroll(data);
  }
}

function applyHitomiViewModeUI() {
  const isPaged = hitomiReaderRuntime.viewMode === "paged";
  const strip = document.getElementById("hitomi-reader-strip");
  const pager = document.getElementById("hitomi-reader-pager");
  if (strip) strip.hidden = isPaged;
  if (pager) pager.hidden = !isPaged;

  const viewBtn = document.getElementById("hitomi-reader-viewmode-btn");
  if (viewBtn) viewBtn.textContent = isPaged ? "웹툰 모드로 보기" : "페이지 넘김으로 보기";

  const dirBtn = document.getElementById("hitomi-reader-direction-btn");
  if (dirBtn) {
    dirBtn.hidden = !isPaged;
    dirBtn.textContent = hitomiReaderRuntime.direction === "ltr" ? "▶ 왼쪽 → 오른쪽" : "◀ 오른쪽 → 왼쪽";
  }

  const pagesBtn = document.getElementById("hitomi-reader-pages-btn");
  if (pagesBtn) {
    pagesBtn.hidden = !isPaged;
    pagesBtn.textContent = hitomiReaderRuntime.paged.pagesPerView === 2 ? "1쪽씩 보기" : "2쪽씩 보기";
  }
}

function toggleHitomiViewMode() {
  let resumePage = 1;
  if (hitomiReaderRuntime.viewMode === "paged") {
    resumePage = hitomiReaderRuntime.paged.index + 1;
  }

  hitomiReaderRuntime.viewMode = hitomiReaderRuntime.viewMode === "paged" ? "scroll" : "paged";
  try {
    localStorage.setItem(READER_VIEW_MODE_KEY, hitomiReaderRuntime.viewMode);
  } catch (err) {
    // ignore
  }

  teardownHitomiReaderObservers();
  applyHitomiViewModeUI();

  const data = hitomiState.galleryData;
  if (hitomiReaderRuntime.viewMode === "paged") {
    openHitomiPaged(data, { startIndex: resumePage });
  } else {
    renderHitomiScroll(data, { jumpToPageIndex: resumePage });
  }
}

function toggleHitomiDirection() {
  hitomiReaderRuntime.direction = hitomiReaderRuntime.direction === "ltr" ? "rtl" : "ltr";
  try {
    localStorage.setItem(READER_DIRECTION_KEY, hitomiReaderRuntime.direction);
  } catch (err) {
    // ignore
  }
  applyHitomiViewModeUI();
  if (hitomiReaderRuntime.viewMode === "paged") renderHitomiPagedImage();
}

function toggleHitomiPagesPerView() {
  hitomiReaderRuntime.paged.pagesPerView = hitomiReaderRuntime.paged.pagesPerView === 2 ? 1 : 2;
  try {
    localStorage.setItem(READER_PAGES_KEY, String(hitomiReaderRuntime.paged.pagesPerView));
  } catch (err) {
    // ignore
  }
  if (hitomiReaderRuntime.paged.pagesPerView === 2) {
    hitomiReaderRuntime.paged.index = alignToPairStart(hitomiReaderRuntime.paged.index);
  }
  applyHitomiViewModeUI();
  renderHitomiPagedImage();
}

/* -- 웹툰 모드: 세로 스크롤 (전체 이미지가 이미 다 있어 무한 스크롤 로드 없음) -- */

// hitomi 이미지 프록시가 502로 실패하면(주로 그 순간 네트워크 우회 프로그램이
// 꺼져 있어서 — docs/claude_plan/hitomi-viewer.md "26번 분석" 참고) 깨진
// <img> 자리에 안내 + "다시 시도" 버튼을 넣어, 캐시를 무효화하는 쿼리스트링을
// 붙여 그 이미지 하나만 다시 요청할 수 있게 한다.
function attachHitomiImageRetry(img) {
  img.addEventListener("error", () => {
    const wrapper = document.createElement("div");
    wrapper.className = "img-error";
    if (img.style.aspectRatio) wrapper.style.aspectRatio = img.style.aspectRatio;
    wrapper.innerHTML = `
      <span>이미지를 불러오지 못했습니다.</span>
      <button type="button" class="btn btn-secondary btn-sm" style="width:auto;">다시 시도</button>
    `;
    wrapper.querySelector("button").addEventListener("click", () => {
      wrapper.replaceWith(img);
      const sep = img.dataset.baseSrc.includes("?") ? "&" : "?";
      img.src = `${img.dataset.baseSrc}${sep}retry=${Date.now()}`;
    });
    img.replaceWith(wrapper);
  });
}

function wireHitomiImageRetries(imgs) {
  imgs.forEach((img) => {
    img.dataset.baseSrc = img.getAttribute("src");
    attachHitomiImageRetry(img);
  });
}

function renderHitomiScroll(data, opts = {}) {
  const strip = document.getElementById("hitomi-reader-strip");
  if (!strip) return;

  // aspect-ratio reserves each page's height before the image itself loads — without it
  // the whole strip's height keeps shifting as lazy-loaded pages arrive, and Chrome's
  // scroll anchoring drags the scroll position along with it (observed: thousands of
  // pixels of drift on longer galleries).
  strip.innerHTML = data.images
    .map(
      (img, i) =>
        `<img src="${escapeAttr(img.url)}" loading="lazy" alt="${i + 1}쪽" data-page-index="${i + 1}" data-page-total="${data.images.length}" style="aspect-ratio:${img.width || 1}/${img.height || 1};" />`
    )
    .join("");
  wireHitomiImageRetries(strip.querySelectorAll("img"));

  setupHitomiPositionObserver();

  if (opts.jumpToPageIndex && opts.jumpToPageIndex > 1) {
    const target = strip.querySelector(`img[data-page-index="${opts.jumpToPageIndex}"]`);
    if (target) {
      target.scrollIntoView({ block: "start" });
      return;
    }
  }
  window.scrollTo({ top: 0 });
}

function setupHitomiPositionObserver() {
  hitomiReaderRuntime.positionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length === 0) return;
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const top = visible[0].target;
      const indicator = document.getElementById("hitomi-page-indicator");
      if (indicator) {
        indicator.hidden = false;
        indicator.textContent = `${top.dataset.pageIndex} / ${top.dataset.pageTotal}`;
      }
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  document.querySelectorAll("#hitomi-reader-strip img").forEach((img) => hitomiReaderRuntime.positionObserver.observe(img));
}

/* -- 페이지 넘김 모드 -- */

function openHitomiPaged(data, opts = {}) {
  hitomiReaderRuntime.paged.images = data.images;
  let startIndex = opts.startIndex ? Math.min(Math.max(opts.startIndex - 1, 0), data.images.length - 1) : 0;
  if (hitomiReaderRuntime.paged.pagesPerView === 2) startIndex = alignToPairStart(startIndex);
  hitomiReaderRuntime.paged.index = Math.max(startIndex, 0);
  renderHitomiPagedImage();
}

function renderHitomiPagedImage() {
  const { images, index, pagesPerView } = hitomiReaderRuntime.paged;
  const pagerBox = document.getElementById("hitomi-reader-pager");
  if (!pagerBox) return;
  if (images.length === 0) {
    pagerBox.innerHTML = '<div class="empty-state">이 작품에는 이미지가 없습니다.</div>';
    return;
  }

  const dual = pagesPerView === 2;
  pagerBox.classList.toggle("dual", dual);

  let pageIndexes;
  if (dual) {
    const a = index;
    const b = index + 1 < images.length ? index + 1 : null;
    pageIndexes = hitomiReaderRuntime.direction === "ltr" ? [a, b] : [b, a];
    pageIndexes = pageIndexes.filter((i) => i !== null);
  } else {
    pageIndexes = [index];
  }

  pagerBox.innerHTML = [
    `<div class="page-zone page-zone-left" id="hitomi-page-zone-left" title="이전 쪽"></div>`,
    ...pageIndexes.map((i) => `<img class="pager-image" src="${escapeAttr(images[i].url)}" alt="${i + 1}" />`),
    `<div class="page-zone page-zone-right" id="hitomi-page-zone-right" title="다음 쪽"></div>`,
  ].join("");
  wireHitomiImageRetries(pagerBox.querySelectorAll("img.pager-image"));

  document
    .getElementById("hitomi-page-zone-left")
    .addEventListener("click", () => hitomiPagerStep(hitomiReaderRuntime.direction === "ltr" ? -1 : 1));
  document
    .getElementById("hitomi-page-zone-right")
    .addEventListener("click", () => hitomiPagerStep(hitomiReaderRuntime.direction === "ltr" ? 1 : -1));

  const indicator = document.getElementById("hitomi-page-indicator");
  if (indicator) {
    indicator.hidden = false;
    indicator.textContent = dual && pageIndexes.length === 2
      ? `${index + 1}-${index + 2} / ${images.length}`
      : `${index + 1} / ${images.length}`;
  }
}

function hitomiPagerStep(direction) {
  const { images, index, pagesPerView } = hitomiReaderRuntime.paged;
  const step = pagesPerView === 2 ? 2 : 1;
  const next = index + direction * step;
  // Clamp silently at either end — unlike the viewer/online readers there's no next/prev
  // work to fall through to here (a hitomi "gallery" isn't part of an ordered series).
  if (next < 0 || next >= images.length) return;
  hitomiReaderRuntime.paged.index = pagesPerView === 2 ? alignToPairStart(next) : next;
  renderHitomiPagedImage();
}

/* -- 공통: 페이지 점프 · 키보드 -- */

function jumpToHitomiPage() {
  const input = document.getElementById("hitomi-reader-jump-input");
  const n = Number(input.value);
  if (!n || n < 1) return;

  if (hitomiReaderRuntime.viewMode === "paged") {
    if (n > hitomiReaderRuntime.paged.images.length) return;
    let idx = n - 1;
    if (hitomiReaderRuntime.paged.pagesPerView === 2) idx = alignToPairStart(idx);
    hitomiReaderRuntime.paged.index = idx;
    renderHitomiPagedImage();
    return;
  }

  const target = document.querySelector(`#hitomi-reader-strip img[data-page-index="${n}"]`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("keydown", (e) => {
  if (hitomiState.view !== "gallery" || panelHitomi.hidden) return;
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
    hitomiReloadCurrentList();
    return;
  }

  if (hitomiReaderRuntime.viewMode === "paged") {
    if (key === "ArrowRight" || key === " " || key === "d") {
      e.preventDefault();
      hitomiPagerStep(hitomiReaderRuntime.direction === "ltr" ? 1 : -1);
    } else if (key === "ArrowLeft" || key === "a") {
      e.preventDefault();
      hitomiPagerStep(hitomiReaderRuntime.direction === "ltr" ? -1 : 1);
    } else if (key === "Home") {
      e.preventDefault();
      hitomiReaderRuntime.paged.index = 0;
      renderHitomiPagedImage();
    } else if (key === "End") {
      e.preventDefault();
      const lastIdx = hitomiReaderRuntime.paged.images.length - 1;
      hitomiReaderRuntime.paged.index = hitomiReaderRuntime.paged.pagesPerView === 2 ? alignToPairStart(lastIdx) : lastIdx;
      renderHitomiPagedImage();
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

function hitomiDownloadTitle(data) {
  const names = (data.artists || []).map((a) => a.name).filter(Boolean).join(", ");
  return names ? `[${names}] ${data.title}` : data.title;
}

async function startHitomiDownload(data) {
  const statusEl = document.getElementById("hitomi-download-status");
  statusEl.textContent = "다운로드 시작하는 중...";

  const payload = {
    site_url: "https://hitomi.la",
    toon_id: data.id,
    title: hitomiDownloadTitle(data),
    start_page: 1,
    end_page: 1,
    separate_folders: false,
    make_zip: true,
    source: "hitomi",
    list_prefix: null,
  };

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
    statusEl.textContent = '다운로드 작업이 시작됐습니다 — "다운로드" 탭에서 진행 상황을 확인하세요.';
    refreshJobs();
  } catch (err) {
    statusEl.textContent = `다운로드 시작 실패: ${err.message}`;
  }
}

/* ---- hitomi 딥링크 — Ctrl/가운데 클릭으로 새 탭을 열었을 때(hitomiGalleryUrl/
   hitomiArtistUrl로 만든 주소) 그 화면으로 바로 진입한다. hitomi 탭에만 있는
   URL 상태라, 다른 탭 로직에는 영향이 없다. 이 파일 끝에 둔 이유: 필요한
   모든 함수/상태(activateTab, showHitomiList, openHitomiGallery, hitomiState
   등)가 위에서 이미 다 정의된 뒤에 실행돼야 하기 때문(스크립트가 위에서
   아래로 순서대로 실행되므로). ---- */
(function applyHitomiDeepLink() {
  const params = new URLSearchParams(location.search);
  if (params.get("tab") !== "hitomi") return;

  hitomiLoadedOnce = true; // activateTab의 기본 showHitomiList() 호출을 막는다
  activateTab("hitomi");

  const view = params.get("view");
  if (view === "gallery" && params.get("id")) {
    openHitomiGallery(Number(params.get("id")));
  } else if (view === "list" && params.get("artist")) {
    showHitomiList(params.get("artist"), params.get("artistName"));
  } else {
    showHitomiList();
  }
})();
