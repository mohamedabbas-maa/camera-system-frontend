const API_URL = "http://127.0.0.1:8000"; // Your backend URL
const form = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMessage.style.display = "none";

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.status === "error") {
      errorMessage.style.display = "block";
      errorMessage.textContent = data.message || "Login failed";
      return;
    }

    // Save token and show redirecting message
    localStorage.setItem("access_token", data.token);
    errorMessage.style.display = "block";
    errorMessage.style.color = "#2e7d32"; // green for success
    errorMessage.textContent = "Login successful! Redirecting...";

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1000);

  } catch (err) {
    errorMessage.style.display = "block";
    errorMessage.style.color = "#e74c3c";
    errorMessage.textContent = "Network error - ensure backend is running";
  }
});
