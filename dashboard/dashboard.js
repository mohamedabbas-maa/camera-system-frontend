// dashboard.js

const API_URL = "http://127.0.0.1:9001"; // your backend
const LOCAL_EXTRA_CAMS_KEY = "extra_cams";

let allCameras = [];
let currentFilter = 'all';

// On page load
window.addEventListener("load", async () => {
  const token = localStorage.getItem("access_token");
  const username = localStorage.getItem("username");

  if (!token) {
    // Uncomment if login is required
    // window.location.href = "login.html";
    // return;
  }

  document.getElementById("userName").textContent = `👤 ${username || "User"}`;

  await loadCameras();
  // Auto-refresh every 30 seconds
  setInterval(loadCameras, 30000);
});

// Load extra cameras from localStorage
function loadExtraCams() {
  try {
    const raw = localStorage.getItem(LOCAL_EXTRA_CAMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

// Save extra cameras to localStorage
function saveExtraCams(extraCams) {
  localStorage.setItem(LOCAL_EXTRA_CAMS_KEY, JSON.stringify(extraCams));
}

// Fetch cameras from backend
async function loadCameras() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const grid = document.getElementById("camerasGrid");

  loading.style.display = "block"; // show loading
  grid.style.display = "none";
  error.style.display = "none";

  try {
    const res = await fetch(`${API_URL}/api/cameras`);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // Map backend cameras
    const baseCams = (data.cameras || []).map(cam => ({
      id: cam.id,
      name: cam.name,
      rtsp: cam.stream_url,
      online: true
    }));

    const extraCams = loadExtraCams();

    allCameras = [...baseCams, ...extraCams].map(cam => ({
      ...cam,
      online: (typeof cam.online === "boolean") ? cam.online : (Math.random() > 0.2)
    }));

    updateStats();
    renderCameras();

    loading.style.display = "none";
    grid.style.display = "grid";
  } catch (err) {
    console.error("Error loading cameras:", err);
    loading.style.display = "none";
    error.style.display = "block";
    error.textContent = "Failed to load cameras. Please try again.";
  }
}

// Update statistics
function updateStats() {
  const total = allCameras.length;
  const online = allCameras.filter(c => c.online).length;
  const offline = total - online;

  document.getElementById("totalCameras").textContent = total;
  document.getElementById("onlineCameras").textContent = online;
  document.getElementById("offlineCameras").textContent = offline;
}

// Render camera cards
function renderCameras() {
  const grid = document.getElementById("camerasGrid");

  let camerasToShow = allCameras;
  if (currentFilter === 'online') camerasToShow = allCameras.filter(c => c.online);
  else if (currentFilter === 'offline') camerasToShow = allCameras.filter(c => !c.online);

  grid.innerHTML = camerasToShow.map(cam => `
    <div class="camera-card" onclick="openVideo('${cam.name}', '${cam.rtsp}')">
      <div class="camera-preview">
        ${cam.online ? '📹' : '📵'}
      </div>
      <div class="camera-info">
        <h3>${cam.name}</h3>
        <div class="rtsp">${cam.rtsp}</div>
        <span class="camera-status ${cam.online ? 'status-online' : 'status-offline'}">
          ${cam.online ? '● Online' : '● Offline'}
        </span>
      </div>
    </div>
  `).join('');
}

// Filter buttons
function filterCameras(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  renderCameras();
}

// Logout
function logout() {
  localStorage.clear();
  window.location.href = "../login/login.html";
}

// Open MJPEG stream
function openVideo(name, url) {
  const modal = document.getElementById("videoModal");
  const img = document.getElementById("cameraImage");
  const title = document.getElementById("modalTitle");

  title.textContent = name;
  img.src = url;
  modal.style.display = "flex";
}

// Close stream modal
function closeVideo() {
  const modal = document.getElementById("videoModal");
  const img = document.getElementById("cameraImage");
  img.src = "";
  modal.style.display = "none";
}

// --- Add CAM modal ---
function openAddCam() {
  const msg = document.getElementById("addCamMsg");
  msg.style.display = "none";
  msg.textContent = "";

  document.getElementById("camName").value = "";
  document.getElementById("camIp").value = "";
  document.getElementById("camUser").value = "";
  document.getElementById("camPass").value = "";

  document.getElementById("addCamModal").style.display = "flex";
}

function closeAddCam() {
  document.getElementById("addCamModal").style.display = "none";
}

// Save new camera
function saveNewCam() {
  const name = document.getElementById("camName").value.trim();
  const ip = document.getElementById("camIp").value.trim();
  const user = document.getElementById("camUser").value.trim();
  const pass = document.getElementById("camPass").value;

  const msg = document.getElementById("addCamMsg");

  if (!name || !ip || !user || !pass) {
    msg.textContent = "Please fill all fields.";
    msg.style.display = "block";
    return;
  }

  const rtspUrl = `rtsp://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${ip}:554/cam/realmonitor?channel=1&subtype=1`;

  const nextId = allCameras.reduce((m, c) => Math.max(m, (c.id || 0)), 0) + 1;
  const newCam = { id: nextId, name, rtsp: rtspUrl, online: true };

  const extraCams = loadExtraCams();
  extraCams.push(newCam);
  saveExtraCams(extraCams);

  allCameras.push(newCam);
  updateStats();
  renderCameras();

  closeAddCam();
}
