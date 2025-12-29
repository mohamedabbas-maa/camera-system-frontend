// frontend/js/dashboard.js
// Hybrid dashboard:
// - Local  : backend (/cams, /stream/{id})
// - Remote : Supabase Storage (list + public URLs)

const API_BASE_URL =
  localStorage.getItem("api_base_url") || "http://127.0.0.1:5500";

const CAMS_REFRESH_MS = 15000; // refresh camera list
const MODAL_FPS_MS = 1000;     // local stream refresh

/* =========================================================
   Supabase (Remote mode only)
========================================================= */
const SUPABASE_URL = "https://uepbmvkymltqqavuelwt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kmHGVgPcosfx_rmB17Q-zA_C4225Go2";
const SUPABASE_BUCKET = "test";

async function supabaseList(prefix) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/list/${SUPABASE_BUCKET}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ prefix }),
    }
  );
  if (!res.ok) throw new Error("SUPABASE_LIST_FAILED");
  return res.json();
}

function supabasePublicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/* =========================================================
   Helpers
========================================================= */
function byId(id) {
  return document.getElementById(id);
}

const imageLoading = byId("imageLoading");

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function isOnlineStatus(status) {
  return String(status || "").toLowerCase() === "online";
}

// Convert camera name to storage folder name (CAM1 -> cam1)
function camFolderName(cam) {
  return String(cam?.name || "").trim().toLowerCase();
}

function isLoggedIn() {
  return !!localStorage.getItem("access_token");
}

function authHeaders() {
  const token = localStorage.getItem("access_token");
  if (!token || token === "OK") return {};
  return { Authorization: `Bearer ${token}` };
}

/* =========================================================
   ensure login (Local / Remote)
========================================================= */

function ensureLoggedIn() {
  if (!isLoggedIn()) {
    const error = byId("error");
    const loading = byId("loading");

    if (loading) loading.style.display = "none";
    if (error) {
      error.style.display = "block";
      error.textContent = "Please login first.";
    }

    return false;
  }
  return true;
}

/* =========================================================
   Connection mode (Local / Remote)
========================================================= */
function getMode() {
  return localStorage.getItem("connection_mode"); // "local" | "remote"
}

function setMode(mode) {
  localStorage.setItem("connection_mode", mode);
}

function showModeModal() {
  const m = byId("modeModal");
  if (m) m.style.display = "flex";
}

function hideModeModal() {
  const m = byId("modeModal");
  if (m) m.style.display = "none";
}

window.selectMode = function (mode) {
  setMode(mode);
  hideModeModal();
  loadCameras();
};

/* =========================================================
   State
========================================================= */
let allCameras = [];
let currentFilter = "all";
let refreshTimer = null;

// modal state
let modalTimer = null;
let modalRunning = false;
let currentModalCameraId = null;
let modalGen = 0;

// gallery state (remote)
let galleryImages = [];
let galleryIndex = 0;
let galleryFolder = "";

/* =========================================================
   Stats
========================================================= */
function updateStats() {
  const total = allCameras.length;
  const online = allCameras.filter(c => isOnlineStatus(c.status)).length;
  const offline = total - online;

  byId("totalCameras").textContent = total;
  byId("onlineCameras").textContent =
    getMode() === "remote" ? total : online;
  byId("offlineCameras").textContent =
    getMode() === "remote" ? 0 : offline;
}

/* =========================================================
   Render cameras
========================================================= */
function renderCameras() {
  const grid = byId("camerasGrid");
  if (!grid) return;

  let cams = allCameras;
  if (currentFilter === "online") cams = cams.filter(c => isOnlineStatus(c.status));
  if (currentFilter === "offline") cams = cams.filter(c => !isOnlineStatus(c.status));

  if (cams.length === 0) {
    grid.innerHTML = "<p style='padding:20px'>No cameras found</p>";
    return;
  }

  grid.innerHTML = cams.map(cam => {
    const enabled = cam.enabled !== false;
    const online = isOnlineStatus(cam.status);

    const icon = enabled
      ? (online ? "📹" : "📵")
      : "⛔";

    const statusText =
      getMode() === "remote"
        ? "Remote"
        : (!enabled ? "Disabled" : (online ? "Online" : "Offline"));

    const statusClass =
      getMode() === "remote"
        ? "status-online"
        : (!enabled
            ? "status-disabled"
            : (online ? "status-online" : "status-offline"));

    return `
      <div class="camera-card" data-id="${cam.id}">
        <div class="camera-preview">${icon}</div>
        <div class="camera-info">
          <h3>${escapeHtml(cam.name)}</h3>
          <span class="camera-status ${statusClass}">
            ● ${escapeHtml(statusText)}
          </span>
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll(".camera-card").forEach(card => {
    card.addEventListener("click", () => {
      const camId = Number(card.dataset.id);
      const cam = allCameras.find(c => c.id === camId);
      openVideo(cam);
    });
  });
}

/* =========================================================
   Load cameras (Local vs Remote)
========================================================= */
async function loadCameras() {
  const loading = byId("loading");
  const error = byId("error");

  if (!ensureLoggedIn()) return;

  if (!getMode()) {
    if (loading) loading.style.display = "none";
    showModeModal();
    return;
  }

  if (loading) loading.style.display = "block";
  if (error) error.style.display = "none";

  try {
    if (getMode() === "local") {
      const res = await fetch(`${API_BASE_URL}/cams`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("CAMS_UNAVAILABLE");

      const data = await res.json();
      if (!data || !Array.isArray(data.cams))
        throw new Error("INVALID_CAMS_FORMAT");

      allCameras = data.cams.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        snapshot_url: c.snapshot_url || null,
        enabled: c.enabled,
      }));
    } else {
      const items = await supabaseList("");
      allCameras = items
        .map((x, i) => ({
          id: i,
          name: x.name,
          status: "remote",
          enabled: true,
        }))
        .filter(c => c.name.startsWith("cam"));
    }

    updateStats();
    renderCameras();
    if (loading) loading.style.display = "none";
  } catch (e) {
    console.error("Camera load error:", e);
    if (loading) loading.style.display = "none";
    if (error) {
      error.style.display = "block";
      error.textContent = "Couldn't load cameras.";
    }
    allCameras = [];
    updateStats();
    renderCameras();
  }
}

/* =========================================================
   Filters
========================================================= */
window.filterCameras = function (filter, btnEl) {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  if (btnEl && btnEl.classList) btnEl.classList.add("active");
  renderCameras();
};

/* =========================================================
   Modal helpers
========================================================= */
function stopModalLoop() {
  if (modalTimer) {
    clearInterval(modalTimer);
    modalTimer = null;
  }
  modalRunning = false;
  currentModalCameraId = null;
  modalGen++;
}

function showGalleryControls(show) {
  const controls = byId("galleryControls");
  if (controls) controls.style.display = show ? "flex" : "none";
}

function setGalleryCounter() {
  const counter = byId("galleryCounter");
  if (!counter) return;
  counter.textContent =
    `${galleryImages.length ? (galleryIndex + 1) : 0} / ${galleryImages.length}`;
}

/* =========================================================
   🔥 MODIFIED FUNCTION: Image loading with spinner
========================================================= */
function setImageSrc(src) {
  const img = byId("cameraImage");
  if (!img) return;

  if (imageLoading) imageLoading.style.display = "block";
  img.style.display = "none";

  const loader = new Image();

  loader.onload = () => {
    img.src = loader.src;
    img.style.display = "block";
    if (imageLoading) imageLoading.style.display = "none";
  };

  loader.onerror = () => {
    if (imageLoading) imageLoading.style.display = "none";
  };

  loader.src = src;
}

/* =========================================================
   Remote gallery (Supabase)
========================================================= */
async function openRemoteGallery(cam) {
  showGalleryControls(true);

  galleryFolder = camFolderName(cam);
  galleryImages = [];
  galleryIndex = 0;
  setGalleryCounter();
  setImageSrc("");

  try {
    const today = todayISO();

    let files = await supabaseList(`${galleryFolder}/${today}/`);
    let day = today;

    if (!files.length) {
      const days = await supabaseList(`${galleryFolder}/`);
      if (!days.length) return;
      day = days.map(d => d.name).sort().pop();
      files = await supabaseList(`${galleryFolder}/${day}/`);
    }

    galleryImages = files
      .map(f => `${galleryFolder}/${day}/${f.name}`)
      .filter(p => /\.(jpg|jpeg|png)$/i.test(p))
      .sort();

    galleryIndex = 0;
    setGalleryCounter();

    if (galleryImages.length) {
      setImageSrc(
        supabasePublicUrl(galleryImages[0]) + `?t=${Date.now()}`
      );
    }
  } catch (e) {
    console.error("Remote gallery error:", e);
  }
}

/* =========================================================
   Local stream (unchanged)
========================================================= */
function startLocalStreamLoop(cam) {
  showGalleryControls(false);

  const camId = cam.id;
  const myGen = modalGen;
  let inFlight = false;

  const tick = () => {
    if (!modalRunning) return;
    if (currentModalCameraId !== camId) return;
    if (inFlight) return;

    inFlight = true;
    const loader = new Image();

    loader.onload = () => {
      if (!modalRunning || currentModalCameraId !== camId) return;
      if (myGen !== modalGen) return;
      setImageSrc(loader.src);
      inFlight = false;
    };

    loader.onerror = () => { inFlight = false; };
    loader.src = `${API_BASE_URL}/stream/${camId}?t=${Date.now()}`;
  };

  modalTimer = setInterval(tick, MODAL_FPS_MS);
  tick();
}

/* =========================================================
   Open video (Local / Remote)
========================================================= */
function openVideo(cam) {
  if (!cam) return;
  if (modalRunning && currentModalCameraId === cam.id) return;

  stopModalLoop();
  modalRunning = true;
  currentModalCameraId = cam.id;

  const modal = byId("videoModal");
  const title = byId("modalTitle");

  if (title) {
    title.textContent =
      `${cam.name} — ${getMode() === "remote" ? "Remote" : "Local"}`;
  }

  if (modal) modal.style.display = "flex";

  if (getMode() === "remote") {
    openRemoteGallery(cam);
  } else {
    startLocalStreamLoop(cam);
  }
}

window.closeVideo = function () {
  stopModalLoop();
  showGalleryControls(false);
  setImageSrc("");
  const modal = byId("videoModal");
  if (modal) modal.style.display = "none";
};

/* =========================================================
   Gallery navigation (Remote)
========================================================= */
window.galleryPrev = function () {
  if (!galleryImages.length) return;
  galleryIndex = Math.max(0, galleryIndex - 1);
  setGalleryCounter();
  setImageSrc(
    supabasePublicUrl(galleryImages[galleryIndex]) + `?t=${Date.now()}`
  );
};

window.galleryNext = function () {
  if (!galleryImages.length) return;
  galleryIndex = Math.min(galleryImages.length - 1, galleryIndex + 1);
  setGalleryCounter();
  setImageSrc(
    supabasePublicUrl(galleryImages[galleryIndex]) + `?t=${Date.now()}`
  );
};

/* =========================================================
   Logout / Change mode / Refresh
========================================================= */
window.logout = function () {
  localStorage.clear();
  window.location.href = "login.html";
};

window.changeMode = function () {
  localStorage.removeItem("connection_mode");
  closeVideo();
  showModeModal();
};

window.refreshNow = function () {
  loadCameras();
};

/* =========================================================
   Init
========================================================= */
window.addEventListener("load", () => {
  const userNameEl = byId("userName");
  if (userNameEl)
    userNameEl.textContent = localStorage.getItem("username") || "User";

  if (!getMode()) {
    const loading = byId("loading");
    if (loading) loading.style.display = "none";
    showModeModal();
    return;
  }

  loadCameras();
  refreshTimer = setInterval(loadCameras, CAMS_REFRESH_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    } else {
      loadCameras();
      if (!refreshTimer)
        refreshTimer = setInterval(loadCameras, CAMS_REFRESH_MS);
    }
  });
});
