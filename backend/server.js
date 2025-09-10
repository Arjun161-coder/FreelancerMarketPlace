const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const nodemailer = require("nodemailer");

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend/html")));
app.use("/css", express.static(path.join(__dirname, "../frontend/css")));
app.use("/js", express.static(path.join(__dirname, "../frontend/js")));
app.use("/img", express.static(path.join(__dirname, "../frontend/img")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// DB Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Arjun@123",
  database: "freelancers_marketplace",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL DB");
});

// Tables
db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fullName VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role ENUM('client','freelancer') NOT NULL
  )
`);

db.query(`
  CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    skills VARCHAR(255),
    budget DECIMAL(10,2),
    client_email VARCHAR(255)
  )
`);

db.query(`
  CREATE TABLE IF NOT EXISTS bids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    freelancer_email VARCHAR(255),
    resume VARCHAR(255),
    days_required INT,
    bid_amount DECIMAL(10,2),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`);

db.query(`
  CREATE TABLE IF NOT EXISTS freelancers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    location VARCHAR(255),
    rate DECIMAL(10,2),
    about TEXT,
    skills VARCHAR(255),
    projects INT,
    rating DECIMAL(3,2),
    github VARCHAR(255),
    linkedin VARCHAR(255),
    profileImage VARCHAR(255),
    resume VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ================= AUTH =================

// Signup
app.post("/api/signup", async (req, res) => {
  const { fullName, email, password, role } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);
  db.query(
    "INSERT INTO users (fullName, email, password, role) VALUES (?, ?, ?, ?)",
    [fullName, email, hashedPassword, role],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Signup failed" });
      }
      res.status(200).json({ message: "Signup successful" });
    }
  );
});

// Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.status(200).json({ message: "Login successful", role: user.role, email: user.email });
  });
});

// ================= PROJECTS =================

// Post project
app.post("/api/post-project", (req, res) => {
  const { title, description, skills, budget, client_email } = req.body;

  if (!title || !description || !skills || !budget || !client_email) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sql =
    "INSERT INTO projects (title, description, skills, budget, client_email) VALUES (?, ?, ?, ?, ?)";
  db.query(sql, [title, description, skills, budget, client_email], (err) => {
    if (err) {
      console.error("Error inserting project:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json({ message: "Project posted successfully" });
  });
});

// Get all projects
app.get("/api/projects", (req, res) => {
  db.query("SELECT * FROM projects", (err, result) => {
    if (err) return res.status(500).json({ message: "Error retrieving projects" });
    res.json(result);
  });
});

// Get projects by client
app.get("/api/my-projects", (req, res) => {
  const email = req.query.email;
  db.query("SELECT * FROM projects WHERE client_email = ?", [email], (err, result) => {
    if (err) return res.status(500).json({ message: "Error retrieving client projects" });
    res.json(result);
  });
});

// ================= BIDS =================

// Apply / Submit bid
app.post("/api/apply", upload.single("resume"), (req, res) => {
  const { email, estimated_days, bid_amount, project_id } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: "Resume file is missing" });
  }

  const resume = req.file.filename;

  const sql = `INSERT INTO bids (project_id, freelancer_email, resume, days_required, bid_amount) 
               VALUES (?, ?, ?, ?, ?)`;

  db.query(sql, [project_id, email, resume, estimated_days, bid_amount], (err) => {
    if (err) {
      console.error("Error submitting bid:", err);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    res.json({ message: "Bid submitted successfully" });
  });
});

// Get bids for client
app.get("/api/bids/:clientEmail", (req, res) => {
  const clientEmail = req.params.clientEmail;

  db.query(
    `SELECT b.*, p.title 
     FROM bids b 
     JOIN projects p ON b.project_id = p.id 
     WHERE p.client_email = ?`,
    [clientEmail],
    (err, results) => {
      if (err) {
        console.error("Error fetching bids:", err);
        return res.status(500).json({ message: "Server error" });
      }
      res.json(results);
    }
  );
});

// ================= EMAIL NOTIFICATIONS =================

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: "malliarjun326@gmail.com",
    pass: "bgis jcme pgde bfwe", // app password
  },
});

// Accept Bid
app.post("/acceptBid", (req, res) => {
  const { email } = req.body;
  const googleFormLink =
    "https://docs.google.com/forms/d/1fyb4o0DCm-iii31D6KwNPFMzQkV0E7xhg6YrljHRE54/edit";

  const mailOptions = {
    from: "malliarjun326@gmail.com",
    to: email,
    subject: "Your Bid Has Been Accepted",
    html: `<p>Dear Freelancer,</p>
           <p>Your bid has been <strong>accepted</strong> for the following project:</p>
           <p>Please fill out this form: 
           <a href="${googleFormLink}" target="_blank">${googleFormLink}</a></p>
           <p>Regards,<br/>Freelance Marketplace Team</p>`,
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) {
      console.error("Error sending accept email:", err);
      return res.status(500).send("Failed to send accept email.");
    }
    res.send("Acceptance email sent successfully!");
  });
});

// Reject Bid
app.post("/rejectBid", (req, res) => {
  const { email } = req.body;

  const mailOptions = {
    from: "malliarjun326@gmail.com",
    to: email,
    subject: "Your Bid Has Been Rejected",
    text: "Dear Freelancer,\n\nYour bid has been rejected. Thank you for your interest.\n\nBest regards,\nFreelance Marketplace Team",
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) {
      console.error("Error sending reject email:", err);
      return res.status(500).send("Failed to send reject email.");
    }
    res.send("Rejection email sent successfully!");
  });
});
// ================= NOTIFICATIONS =================

// Get all bid notifications for a client
app.get("/getNotifications", (req, res) => {
  const sql = `
    SELECT b.id, b.freelancer_email, b.resume, b.days_required, b.bid_amount, b.status, p.title
    FROM bids b
    JOIN projects p ON b.project_id = p.id
    ORDER BY b.id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching notifications:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});

// Accept Bid
app.post("/acceptBid", (req, res) => {
  const { email } = req.body;
  const updateSql = "UPDATE bids SET status='accepted' WHERE freelancer_email=?";
  
  db.query(updateSql, [email], (err) => {
    if (err) {
      console.error("Error updating bid status:", err);
      return res.status(500).send("Failed to accept bid.");
    }

    // Send email notification
    const googleFormLink = "https://docs.google.com/forms/d/1fyb4o0DCm-iii31D6KwNPFMzQkV0E7xhg6YrljHRE54/edit";
    const mailOptions = {
      from: "malliarjun326@gmail.com",
      to: email,
      subject: "Your Bid Has Been Accepted",
      html: `<p>Dear Freelancer,</p>
             <p>Your bid has been <strong>accepted</strong>.</p>
             <p>Please fill out this form: 
             <a href="${googleFormLink}" target="_blank">${googleFormLink}</a></p>
             <p>Regards,<br/>Freelance Marketplace Team</p>`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error("Error sending accept email:", err);
        return res.status(500).send("Bid accepted but failed to send email.");
      }
      res.send("Bid accepted and email sent!");
    });
  });
});

// Reject Bid
app.post("/rejectBid", (req, res) => {
  const { email } = req.body;
  const updateSql = "UPDATE bids SET status='rejected' WHERE freelancer_email=?";
  
  db.query(updateSql, [email], (err) => {
    if (err) {
      console.error("Error updating bid status:", err);
      return res.status(500).send("Failed to reject bid.");
    }

    const mailOptions = {
      from: "malliarjun326@gmail.com",
      to: email,
      subject: "Your Bid Has Been Rejected",
      text: "Dear Freelancer,\n\nYour bid has been rejected. Thank you for your interest.\n\nBest regards,\nFreelance Marketplace Team",
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error("Error sending reject email:", err);
        return res.status(500).send("Bid rejected but failed to send email.");
      }
      res.send("Bid rejected and email sent!");
    });
  });
});


// ================= FREELANCER PROFILE =================

// Save or Update Freelancer Profile
app.post("/api/freelancer/profile", upload.fields([
  { name: "profileImage" }, { name: "resume" }
]), (req, res) => {
  const {
    name, location, rate, about, skills,
    projects, rating, github, linkedin, email
  } = req.body;

  const profileImage = req.files["profileImage"]?.[0]?.filename || null;
  const resume = req.files["resume"]?.[0]?.filename || null;

  const checkSql = "SELECT * FROM freelancers WHERE email = ?";
  db.query(checkSql, [email], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (results.length > 0) {
      // Update
      const updateSql = `
        UPDATE freelancers
        SET name=?, location=?, rate=?, about=?, skills=?, projects=?, rating=?, github=?, linkedin=?, 
            profileImage=IFNULL(?, profileImage),
            resume=IFNULL(?, resume)
        WHERE email=?`;

      db.query(updateSql, [name, location, rate, about, skills, projects, rating, github, linkedin, profileImage, resume, email], (err) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ message: "Profile updated successfully!" });
      });

    } else {
      // Insert
      const insertSql = `
        INSERT INTO freelancers (email, name, location, rate, about, skills, projects, rating, github, linkedin, profileImage, resume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      db.query(insertSql, [email, name, location, rate, about, skills, projects, rating, github, linkedin, profileImage, resume], (err) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json({ message: "Profile created successfully!" });
      });
    }
  });
});

// Get freelancer profile by email
app.get("/api/freelancer/:email", (req, res) => {
  const email = req.params.email;
  const sql = "SELECT * FROM freelancers WHERE email = ?";

  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "Profile not found" });
    res.json(results[0]);
  });
});

// Get all freelancers (Hire Freelancers page)
app.get("/api/freelancers", (req, res) => {
  const sql = "SELECT * FROM freelancers";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.status(200).json(results);
  });
});



// ================= START SERVER =================
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
