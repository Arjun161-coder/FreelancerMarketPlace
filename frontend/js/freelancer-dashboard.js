document.addEventListener("DOMContentLoaded", () => {
  fetch("http://localhost:3000/api/projects")
    .then(response => response.json())
    .then(projects => {
      const container = document.getElementById("projects-container");
      container.innerHTML = "";

      if (projects.length === 0) {
        container.innerHTML = "<p>No projects available at the moment.</p>";
        return;
      }

      projects.forEach(project => {
        const card = document.createElement("div");
        card.className = "project-card";

        card.innerHTML = `
          <h3>${project.title}</h3>
          <p>${project.description}</p>
          <p><strong>Skills:</strong> ${project.skills}</p>
          <p><strong>Budget:</strong> ₹${project.budget}</p>
          <button class="apply-btn" onclick="applyToProject(${project.id}, '${project.client_email}')">Apply</button>
        `;

        container.appendChild(card);
      });
    })
    .catch(error => {
      console.error("Error fetching projects:", error);
      document.getElementById("projects-container").innerHTML = "<p>Error loading projects. Please try again later.</p>";
    });
});

function applyToProject(projectId, clientEmail) {
  window.location.href = `apply-project.html?projectId=${projectId}&clientEmail=${encodeURIComponent(clientEmail)}`;
}
