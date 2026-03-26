const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create Tables
    db.serialize(() => {
      // 1. User Profile Table
      db.run(`CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        field TEXT,
        university TEXT,
        location TEXT,
        career_goal TEXT,
        tagline TEXT,
        about_background TEXT,
        about_interests TEXT,
        journey_text TEXT,
        resume_url TEXT
      )`);

      // Add columns safely if not exist
      db.run("ALTER TABLE user_profile ADD COLUMN profile_image TEXT", () => {});
      db.run("ALTER TABLE user_profile ADD COLUMN college_image TEXT", () => {});
      db.run("ALTER TABLE user_profile ADD COLUMN social_github TEXT", () => {});
      db.run("ALTER TABLE user_profile ADD COLUMN social_linkedin TEXT", () => {});
      db.run("ALTER TABLE user_profile ADD COLUMN social_instagram TEXT", () => {});
      db.run("ALTER TABLE user_profile ADD COLUMN social_email TEXT", () => {});
      db.run("ALTER TABLE user_profile ADD COLUMN resume_url TEXT", () => {});
      db.run("ALTER TABLE user_profile ADD COLUMN welcome_message TEXT", () => {});
      db.run("ALTER TABLE projects ADD COLUMN github_url TEXT", () => {});
      db.run("ALTER TABLE projects ADD COLUMN live_url TEXT", () => {});

      // Add order_index column
      db.run("ALTER TABLE skills ADD COLUMN order_index INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE projects ADD COLUMN order_index INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE experience ADD COLUMN order_index INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE certifications ADD COLUMN order_index INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE education ADD COLUMN order_index INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE achievements ADD COLUMN order_index INTEGER DEFAULT 0", () => {});

      // 2. Skills Table
      db.run(`CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        name TEXT
      )`);

      // 3. Projects Table
      db.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        problem TEXT,
        solution TEXT,
        tools TEXT,
        role TEXT,
        outcome TEXT,
        image_url TEXT,
        github_url TEXT,
        live_url TEXT
      )`);

      // 4. Experience Table
      db.run(`CREATE TABLE IF NOT EXISTS experience (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT,
        company TEXT,
        period TEXT,
        description TEXT
      )`);

      // 5. Certifications Table
      db.run(`CREATE TABLE IF NOT EXISTS certifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        issuer TEXT,
        year TEXT
      )`);

      // Original Tables
      db.run(`CREATE TABLE IF NOT EXISTS education (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        degree TEXT NOT NULL,
        institution TEXT NOT NULL,
        year TEXT,
        description TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        date TEXT,
        description TEXT,
        image_url TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // --- Database Seeding ---
      db.get("SELECT COUNT(*) as count FROM user_profile", (err, row) => {
        if (!err && row.count === 0) {
          db.run(`INSERT INTO user_profile (name, field, university, location, career_goal, tagline, about_background, about_interests, journey_text, welcome_message) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              "Siddhi Patil", 
              "MERN Developer & AI/ML Enthusiast", 
              "Your College Name", 
              "India", 
              "Full Stack Developer / AI Engineer",
              "Building modern web apps that solve real-world problems.",
              "I'm a passionate MERN stack developer with a deep interest in AI/ML. I love crafting seamless user experiences with React on the frontend, Node.js on the backend, and MongoDB for data — all powered by clean, scalable code.",
              "React.js, Node.js, MongoDB, Express.js, Machine Learning, Web Development, Open Source.",
              "My journey into tech started with curiosity and evolved into a deep passion for building full-stack applications. From debugging my first React component to deploying production Node.js APIs, every challenge taught me something new.",
              "Welcome to my portfolio!"
            ]
          );
          
          const seedSkills = [
            ["Technical", "HTML, CSS, JavaScript, TypeScript"],
            ["Technical", "React.js, Node.js, Express.js"],
            ["Technical", "MongoDB, REST APIs, Git"],
            ["Technical", "Tailwind CSS, Figma, Python"],
            ["Soft", "Problem-Solving, Team Collaboration, Adaptability"],
            ["Soft", "Communication, Leadership, Time Management"]
          ];
          seedSkills.forEach(s => db.run(`INSERT INTO skills (category, name) VALUES (?, ?)`, s));

          // Seed Projects
          db.run(`INSERT INTO projects (title, problem, solution, tools, role, outcome, github_url, live_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ["MERN E-Commerce Platform", "Businesses need a scalable full-stack shopping solution.", "A feature-rich e-commerce app with auth, cart, payments & admin dashboard.", "React.js, Node.js, MongoDB, Express, JWT", "Full Stack Developer", "Deployed with 100% uptime, handles 1000+ products.", "https://github.com", "https://vercel.app"]
          );
          db.run(`INSERT INTO projects (title, problem, solution, tools, role, outcome, github_url, live_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ["AI Crop Disease Detector", "Farmers struggle to identify crop diseases early.", "A CNN-based ML app that predicts crop disease from images with high accuracy.", "Python, TensorFlow, React, Flask", "ML Engineer & Frontend Developer", "Achieved 94% accuracy on test dataset.", "https://github.com", ""]
          );

          // Seed Experience
          db.run(`INSERT INTO experience (role, company, period, description) VALUES (?, ?, ?, ?)`,
            ["AI Intern", "Organization Name", "Jun 2023 - Aug 2023", "Trained NLP models and optimized pipelines."]
          );

          // Seed Certifications
          db.run(`INSERT INTO certifications (title, issuer, year) VALUES (?, ?, ?)`,
            ["Machine Learning Specialization", "Coursera", "2023"]
          );
        }
      });
    });
  }
});

module.exports = db;
