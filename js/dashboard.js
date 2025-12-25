// dashboard.js

const API_URL = "https://valarie-interseaboard-jazmine.ngrok-free.dev"; // FastAPI backend
const LOCAL_EXTRA_CAMS_KEY = "extra_cams";

let allCameras = [];
let currentFilter = "all";

/* =========================
   Local Cameras Helpers
========================= */
const loadExtraCams = () => {
  try {
    const raw = localStorage.getItem(LOCAL_EXTRA_CAMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveExtraCams = (cams) => {
  localStorage.setItem(LOCAL_EXTRA_CAMS_KEY, JSON.stringify(cams));
};

/* =========================https://valarie-interseaboard-jazmine.ngrok-free.dev
   Stats
========================= */
const updateStats = () => {
  const total = allCameras.length;
  const online = allCameras.filter(c => c.online).length;
  const offline = total - online;

  document.getElementById("totalCameras").textContent = total;
  document.getElementById("onlineCameras").textContent = online;
  document.getElementById("offlineCameras").textContent = offline;
};

/* =========================
   Render Cameras
========================= */
const renderCameras = () => {
  const grid = document.getElementById("camerasGrid");

  let cams = allCameras;
  if (currentFilter === "online") cams = cams.filter(c => c.online);
  if (currentFilter === "offline") cams = cams.filter(c => !c.online);

  if (cams.length === 0) {
    grid.innerHTML = "<p style='padding:20px'>No cameras found</p>";
    return;
  }

  grid.innerHTML = cams.map(cam => `
    <div class="camera-card" data-name="${cam.name}" data-rtsp="${cam.rtsp}">
      <div class="camera-preview">
        ${cam.online ? "📹" : "📵"}
      </div>
      <div class="camera-info">
        <h3>${cam.name}</h3>
        <div class="rtsp">${cam.rtsp || "No stream"}</div>
        <span class="camera-status ${cam.online ? "status-online" : "status-offline"}">
          ● ${cam.online ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".camera-card").forEach(card => {
    card.addEventListener("click", () => {
      openVideo(card.dataset.name, card.dataset.rtsp);
    });
  });
};

/* =========================
   Load Cameras (FIXED)
========================= */
const loadCameras = async () => {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const grid = document.getElementById("camerasGrid");

  const token = localStorage.getItem("access_token");
  if (!token) {
    error.style.display = "block";
    error.textContent = "Not logged in";
    return;
  }

  loading.style.display = "block";
  error.style.display = "none";
  grid.style.display = "none";

  try {
    const res = await fetch(`${API_URL}/cams`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data.status !== "success") {
      throw new Error(data.message || "Failed to load cameras");
    }

    // Backend cameras
    const backendCams = data.cams.map(cam => ({
      id: cam.id,
      name: cam.name,
      rtsp: cam.rtsp_link || "",
      online: cam.enabled === true
    }));

    // Local-only cameras
    const extraCams = loadExtraCams();

    allCameras = [...backendCams, ...extraCams];

    updateStats();
    renderCameras();

    loading.style.display = "none";
    grid.style.display = "grid";

  } catch (err) {
    console.error(err);
    loading.style.display = "none";
    error.style.display = "block";
    error.textContent = "Failed to load cameras. Please try again.";
  }
};

/* =========================
   Filters
========================= */
const filterCameras = (filter) => {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
  renderCameras();
};

/* =========================
   Video Modal
========================= */
const openVideo = (name, url) => {
  if (!url) return;

  document.getElementById("modalTitle").textContent = name;
  document.getElementById("cameraImage").src = url;
  document.getElementById("videoModal").style.display = "flex";
};

const closeVideo = () => {
  document.getElementById("cameraImage").src = "";
  document.getElementById("videoModal").style.display = "none";
};

/* =========================
   Add Camera Modal
========================= */
const openAddCam = () => {
  document.getElementById("addCamMsg").textContent = "";
  document.getElementById("addCamMsg").style.display = "none";
  document.getElementById("addCamModal").style.display = "flex";
};

const closeAddCam = () => {
  document.getElementById("addCamModal").style.display = "none";
};

/* =========================
   Save New Camera (Local)
========================= */
const saveNewCam = () => {
  const name = camName.value.trim();
  const ip = camIp.value.trim();
  const user = camUser.value.trim();
  const pass = camPass.value;

  const msg = document.getElementById("addCamMsg");

  if (!name || !ip || !user || !pass) {
    msg.textContent = "Please fill all fields.";
    msg.style.display = "block";
    return;
  }

  const rtsp = `rtsp://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${ip}:554/cam/realmonitor?channel=1&subtype=1`;

  const id = Date.now();
  const cam = { id, name, rtsp, online: true };

  const extras = loadExtraCams();
  extras.push(cam);
  saveExtraCams(extras);

  allCameras.push(cam);
  updateStats();
  renderCameras();
  closeAddCam();
};

/* =========================
   Logout
========================= */
const logout = () => {
  localStorage.clear();
  window.location.href = "login.html";
};

/* =========================
   Init
========================= */
window.addEventListener("load", () => {
  document.getElementById("userName").textContent =
    "👤 " + (localStorage.getItem("username") || "User");

  loadCameras();
  setInterval(loadCameras, 30000);
});
