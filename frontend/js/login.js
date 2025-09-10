document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const response = await fetch("http://localhost:3000/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (data.success) {
    alert("Login successful!");
    if (data.user.role === "freelancer") {
      window.location.href = "freelancer-dashboard.html";
    } else {
      window.location.href = "client-dashboard.html";
    }
  } else {
    alert("Login failed: " + data.error);
  }
});
