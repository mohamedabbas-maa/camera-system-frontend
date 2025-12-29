// frontend/js/login.js 
// only post 200

const LABVIEW_URL = "http://127.0.0.1:8001/WebService4/HTTPMethod_Post";

const form = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");

function showError(msg) {
  errorMessage.style.display = "block";
  errorMessage.style.color = "#e74c3c";
  errorMessage.textContent = msg;
}

function showOk(msg) {
  errorMessage.style.display = "block";
  errorMessage.style.color = "#2e7d32";
  errorMessage.textContent = msg;
}

function hideError() {
  errorMessage.style.display = "none";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    showError("Username and password are required");
    return;
  }

  // Build payload
  const payload = { user: username, password };

  // Debug
  console.log("Login payload (object):", payload);
  console.log("Login payload (string):", JSON.stringify(payload));

  try {
    const res = await fetch(LABVIEW_URL, {
      method: "POST",
      headers: {
        // LabVIEW Read Postdata.vi expects plain text
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await res.text();
    console.log("LabVIEW response:", rawText);
    console.log("HTTP status:", res.status);

    // ❌ Only HTTP 200 is success; everything else is failure
    if (res.status !== 200) {
      showError(`Login failed (HTTP ${res.status})`);
      return;
    }

    // ✅ Exactly HTTP 200 = success → go to dashboard
    localStorage.setItem("username", username);
    localStorage.setItem("labview_login_response", rawText);

    // Dummy token so dashboard.js won't block (your current architecture)
    localStorage.setItem("access_token", "OK");

    showOk("Login successful! Redirecting...");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 300);
  } catch (err) {
    console.error("Fetch error:", err);
    showError("Network error (Check Server)");
  }
});
