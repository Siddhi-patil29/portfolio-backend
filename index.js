const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');
require('dotenv').config();

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// SQLite helper promises
const dbRun = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const dbAll = (query, params = []) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const dbGet = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

// Configure Cloudinary if credentials exist
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary configured for image uploads');
}

// Helper: upload a buffer to Cloudinary, returns the secure URL
const uploadToCloudinary = (buffer, folder = 'portfolio') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'] },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// Email transporter (Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// CORS — allow all origins (fine for portfolio)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Setup uploads folder (local fallback if no Cloudinary)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Use memoryStorage for all uploads
const upload = multer({ storage: multer.memoryStorage() });

// ─── Health Check ───
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Unified Data Fetch ───
app.get('/api/all', async (req, res) => {
  const isMinimal = req.query.minimal === 'true';
  console.time(`Fetch All ${isMinimal ? '(minimal)' : '(full)'}`);
  
  try {
    const fetchTasks = [
      dbGet("SELECT * FROM user_profile LIMIT 1"),
      dbAll("SELECT * FROM skills ORDER BY order_index ASC, id DESC"),
      dbAll("SELECT * FROM projects ORDER BY order_index ASC, id DESC"),
      dbAll("SELECT * FROM experience ORDER BY order_index ASC, id DESC"),
      dbAll("SELECT * FROM certifications ORDER BY order_index ASC, id DESC"),
      dbAll("SELECT * FROM education ORDER BY order_index ASC, id DESC"),
      dbAll("SELECT * FROM achievements ORDER BY order_index ASC, id DESC")
    ];

    if (!isMinimal) {
      fetchTasks.push(dbAll("SELECT * FROM messages ORDER BY created_at DESC"));
    }

    const results = await Promise.all(fetchTasks);
    console.timeEnd(`Fetch All ${isMinimal ? '(minimal)' : '(full)'}`);

    let profileData = results[0];
    if (!profileData) {
      const resId = await dbRun("INSERT INTO user_profile (name, welcome_message) VALUES (?, ?)", ["Your Name", "Welcome to my portfolio!"]);
      profileData = { id: resId.lastID, name: "Your Name", welcome_message: "Welcome to my portfolio!" };
    }

    res.json({
      profile: profileData,
      skills: results[1],
      projects: results[2],
      experience: results[3],
      certifications: results[4],
      education: results[5],
      achievements: results[6],
      messages: isMinimal ? [] : (results[7] || [])
    });
  } catch (err) {
    console.timeEnd(`Fetch All ${isMinimal ? '(minimal)' : '(full)'}`);
    res.status(500).json({ error: err.message });
  }
});

// --- Helper for standard GET/POST/DELETE with SQLite ---
function setupCrud(endpoint, table, requiredFields) {
  app.get(`/api/${endpoint}`, async (req, res) => {
    try {
      const rows = await dbAll(`SELECT * FROM ${table} ORDER BY order_index ASC, id DESC`);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`/api/${endpoint}`, async (req, res) => {
    try {
      for(let field of requiredFields) {
        if(!req.body[field]) return res.status(400).json({ error: `Missing ${field}` });
      }
      
      const fields = Object.keys(req.body);
      const values = Object.values(req.body);
      const placeholders = fields.map(() => '?').join(', ');
      
      const insertResult = await dbRun(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`, values);
      req.body.id = insertResult.lastID;
      res.json(req.body);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete(`/api/${endpoint}/:id`, async (req, res) => {
    try {
      await dbRun(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// 1. User Profile 
app.get('/api/profile', async (req, res) => {
  try {
    let profile = await dbGet("SELECT * FROM user_profile LIMIT 1");
    if (!profile) {
      const resId = await dbRun("INSERT INTO user_profile (name, welcome_message) VALUES (?, ?)", ["Your Name", "Welcome to my portfolio!"]);
      profile = { id: resId.lastID, name: "Your Name", welcome_message: "Welcome to my portfolio!" };
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', upload.fields([{ name: 'profile_image', maxCount: 1 }, { name: 'college_image', maxCount: 1 }]), async (req, res) => {
  try {
    let profile = await dbGet("SELECT * FROM user_profile LIMIT 1");
    if (!profile) {
      const resId = await dbRun("INSERT INTO user_profile (name, welcome_message) VALUES (?, ?)", ["Your Name", "Welcome to my portfolio!"]);
      profile = { id: resId.lastID };
    }
    
    const params = [];
    let setClauses = [];
    const fieldsToUpdate = ['name', 'field', 'university', 'location', 'career_goal', 'tagline', 'about_background', 'about_interests', 'journey_text', 'social_github', 'social_linkedin', 'social_instagram', 'social_email', 'resume_url', 'welcome_message'];
    
    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
         setClauses.push(`${field} = ?`);
         params.push(req.body[field]);
      }
    });

    if (req.files) {
      if (req.files.profile_image) {
        const buf = req.files.profile_image[0].buffer;
        let imgUrl;
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          imgUrl = await uploadToCloudinary(buf);
        } else {
          const fname = `${Date.now()}-profile${path.extname(req.files.profile_image[0].originalname)}`;
          fs.writeFileSync(path.join(uploadDir, fname), buf);
          imgUrl = `/uploads/${fname}`;
        }
        setClauses.push("profile_image = ?");
        params.push(imgUrl);
      }
      if (req.files.college_image) {
        const buf = req.files.college_image[0].buffer;
        let imgUrl;
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          imgUrl = await uploadToCloudinary(buf);
        } else {
          const fname = `${Date.now()}-college${path.extname(req.files.college_image[0].originalname)}`;
          fs.writeFileSync(path.join(uploadDir, fname), buf);
          imgUrl = `/uploads/${fname}`;
        }
        setClauses.push("college_image = ?");
        params.push(imgUrl);
      }
    }
    
    if (setClauses.length > 0) {
      params.push(profile.id);
      await dbRun(`UPDATE user_profile SET ${setClauses.join(', ')} WHERE id = ?`, params);
    }

    const updatedProfile = await dbGet("SELECT * FROM user_profile LIMIT 1");
    res.json({ success: true, profile: updatedProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Skills
setupCrud('skills', 'skills', ['name', 'category']);

// 3. Projects 
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await dbAll("SELECT * FROM projects ORDER BY order_index ASC, id DESC");
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', upload.single('image'), async (req, res) => {
  try {
    const { title, problem, solution, tools, role, outcome, github_url, live_url } = req.body;
    if (!title) return res.status(400).json({ error: 'Missing title' });

    let image_url = null;
    if (req.file) {
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        image_url = await uploadToCloudinary(req.file.buffer);
      } else {
        const fname = `${Date.now()}-proj${path.extname(req.file.originalname)}`;
        fs.writeFileSync(path.join(uploadDir, fname), req.file.buffer);
        image_url = `/uploads/${fname}`;
      }
    }

    const resId = await dbRun(
      "INSERT INTO projects (title, problem, solution, tools, role, outcome, image_url, github_url, live_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [title, problem, solution, tools, role, outcome, image_url, github_url, live_url]
    );

    const project = await dbGet("SELECT * FROM projects WHERE id = ?", [resId.lastID]);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await dbRun("DELETE FROM projects WHERE id = ?", [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Experience, Certifications, Education
setupCrud('experience', 'experience', ['role', 'company']);
setupCrud('certifications', 'certifications', ['title']);
setupCrud('education', 'education', ['degree', 'institution']);

// 5. Achievements
app.get('/api/achievements', async (req, res) => {
  try {
    const achievements = await dbAll("SELECT * FROM achievements ORDER BY order_index ASC, id DESC");
    res.json(achievements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/achievements', upload.single('image'), async (req, res) => {
  try {
    const { title, date, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Missing title' });

    let image_url = null;
    if (req.file) {
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        image_url = await uploadToCloudinary(req.file.buffer);
      } else {
        const fname = `${Date.now()}-ach${path.extname(req.file.originalname)}`;
        fs.writeFileSync(path.join(uploadDir, fname), req.file.buffer);
        image_url = `/uploads/${fname}`;
      }
    }

    const resId = await dbRun(
      "INSERT INTO achievements (title, date, description, image_url) VALUES (?, ?, ?, ?)",
      [title, date, description, image_url]
    );
    const achievement = await dbGet("SELECT * FROM achievements WHERE id = ?", [resId.lastID]);
    res.json(achievement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/achievements/:id', async (req, res) => {
  try {
    await dbRun("DELETE FROM achievements WHERE id = ?", [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contact
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: 'Name and message are required' });
    
    const resId = await dbRun("INSERT INTO messages (name, email, message) VALUES (?, ?, ?)", [name, email, message]);
      
    // Send email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        subject: `New Portfolio Contact: ${name}`,
        text: `You have a new message from ${name} (${email || 'No email provided'}):\n\n${message}`
      };
      transporter.sendMail(mailOptions, (error) => {
        if (error) console.error('Error sending email:', error);
      });
    }

    res.json({ success: true, id: resId.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/contact', async (req, res) => {
  try {
    const messages = await dbAll("SELECT * FROM messages ORDER BY created_at DESC");
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reorder endpoint
app.put('/api/:table/reorder', async (req, res) => {
  try {
    const { table } = req.params;
    const { orderedIds } = req.body;
    
    const validTables = ['skills', 'projects', 'experience', 'certifications', 'education', 'achievements'];
    
    if (!validTables.includes(table)) return res.status(400).json({ error: 'Invalid table for reordering' });
    if (!orderedIds || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds must be an array' });
    if (orderedIds.length === 0) return res.json({ success: true });

    // Update each record's order_index
    for(let index = 0; index < orderedIds.length; index++) {
        await dbRun(`UPDATE ${table} SET order_index = ? WHERE id = ?`, [index, orderedIds[index]]);
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
