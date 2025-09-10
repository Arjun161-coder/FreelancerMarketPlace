async function saveProfile() {
  const formData = new FormData();
  formData.append('name', document.getElementById('freelancerName').innerText);
  formData.append('location', document.getElementById('location').innerText);
  formData.append('rate', document.getElementById('rate').innerText);
  formData.append('about', document.getElementById('about').value);
  formData.append('skills', document.getElementById('skills').value);
  formData.append('projects', document.getElementById('projects').value);
  formData.append('rating', document.getElementById('rating').value);
  formData.append('github', document.getElementById('github').href);
  formData.append('linkedin', document.getElementById('linkedin').href);

  const image = document.getElementById('imageUpload').files[0];
  const resume = document.getElementById('resumeUpload').files[0];
  if (image) formData.append('profileImage', image);
  if (resume) formData.append('resume', resume);

  const res = await fetch('http://localhost:3000/api/freelancer/profile', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  alert(data.message);
}
