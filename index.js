const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const connectDB = require('./db');
const models = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

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

// Setup uploads folder logic for local fallback
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Setup Cloudinary or Local Multer
let upload;
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'portfolio',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif']
    }
  });
  upload = multer({ storage: storage });
  console.log('Using Cloudinary for image uploads');
} else {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  });
  upload = multer({ storage: storage });
  console.log('WARN: Cloudinary not configured. Using local uploads (will clear on Render restart).');
}

// ─── Health Check (used for keep-alive pings from frontend) ───
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Unified Data Fetch (solves cold start slow loading) ───
app.get('/api/all', async (req, res) => {
  try {
    const [profile, skills, projects, experience, certifications, education, achievements, messages] = await Promise.all([
      models.UserProfile.findOne() || {},
      models.Skill.find().sort({ order_index: 1, _id: -1 }),
      models.Project.find().sort({ order_index: 1, _id: -1 }),
      models.Experience.find().sort({ order_index: 1, _id: -1 }),
      models.Certification.find().sort({ order_index: 1, _id: -1 }),
      models.Education.find().sort({ order_index: 1, _id: -1 }),
      models.Achievement.find().sort({ order_index: 1, _id: -1 }),
      models.Message.find().sort({ created_at: -1 })
    ]);

    // Handle edge case if profile doesn't exist yet
    let profileData = profile;
    if (!profileData) {
      profileData = await models.UserProfile.create({
        name: "Your Name",
        welcome_message: "Welcome to my portfolio!"
      });
    }

    res.json({
      profile: profileData,
      skills,
      projects,
      experience,
      certifications,
      education,
      achievements,
      messages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Helper for standard GET/POST/DELETE with Mongoose ---
function setupCrud(endpoint, Model, requiredFields) {
  app.get(`/api/${endpoint}`, async (req, res) => {
    try {
      const rows = await Model.find().sort({ order_index: 1, _id: -1 });
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
      const newDoc = new Model(req.body);
      await newDoc.save();
      res.json(newDoc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete(`/api/${endpoint}/:id`, async (req, res) => {
    try {
      await Model.findByIdAndDelete(req.params.id);
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// 1. User Profile (Special GET/PUT since it's a single record)
app.get('/api/profile', async (req, res) => {
  try {
    let profile = await models.UserProfile.findOne();
    if (!profile) {
      // Seed initial profile empty
      profile = await models.UserProfile.create({
        name: "Your Name",
        welcome_message: "Welcome to my portfolio!"
      });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', upload.fields([{ name: 'profile_image', maxCount: 1 }, { name: 'college_image', maxCount: 1 }]), async (req, res) => {
  try {
    let profile = await models.UserProfile.findOne();
    if (!profile) {
      profile = new models.UserProfile();
    }
    
    // Update string fields
    const fieldsToUpdate = ['name', 'field', 'university', 'location', 'career_goal', 'tagline', 'about_background', 'about_interests', 'journey_text', 'social_github', 'social_linkedin', 'social_instagram', 'social_email', 'resume_url', 'welcome_message'];
    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) profile[field] = req.body[field];
    });

    // Update images — Cloudinary gives full URL, local gives filename only
    if (req.files) {
      if (req.files.profile_image) {
        profile.profile_image = process.env.CLOUDINARY_CLOUD_NAME 
          ? req.files.profile_image[0].path  // Full Cloudinary URL
          : `/uploads/${req.files.profile_image[0].filename}`;
      }
      if (req.files.college_image) {
        profile.college_image = process.env.CLOUDINARY_CLOUD_NAME 
          ? req.files.college_image[0].path  // Full Cloudinary URL
          : `/uploads/${req.files.college_image[0].filename}`;
      }
    }
    
    await profile.save();
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Skills
setupCrud('skills', models.Skill, ['name', 'category']);

// 3. Projects (Custom because of potential image uploads)
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await models.Project.find().sort({ order_index: 1, _id: -1 });
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
      image_url = process.env.CLOUDINARY_CLOUD_NAME ? req.file.path : `/uploads/${req.file.filename}`;
    }

    const project = new models.Project({
       title, problem, solution, tools, role, outcome, image_url, github_url, live_url
    });
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await models.Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Experience, Certifications, Education
setupCrud('experience', models.Experience, ['role', 'company']);
setupCrud('certifications', models.Certification, ['title']);
setupCrud('education', models.Education, ['degree', 'institution']);

// 5. Achievements
app.get('/api/achievements', async (req, res) => {
  try {
    const achievements = await models.Achievement.find().sort({ order_index: 1, _id: -1 });
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
      image_url = process.env.CLOUDINARY_CLOUD_NAME ? req.file.path : `/uploads/${req.file.filename}`;
    }

    const achievement = new models.Achievement({ title, date, description, image_url });
    await achievement.save();
    res.json(achievement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/achievements/:id', async (req, res) => {
  try {
    await models.Achievement.findByIdAndDelete(req.params.id);
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
    
    const newMsg = new models.Message({ name, email, message });
    await newMsg.save();
      
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

    res.json({ success: true, id: newMsg._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/contact', async (req, res) => {
  try {
    const messages = await models.Message.find().sort({ created_at: -1 });
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
    
    const validTables = {
      'skills': models.Skill,
      'projects': models.Project,
      'experience': models.Experience,
      'certifications': models.Certification,
      'education': models.Education,
      'achievements': models.Achievement
    };
    
    const Model = validTables[table];
    if (!Model) return res.status(400).json({ error: 'Invalid table for reordering' });
    if (!orderedIds || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds must be an array' });
    if (orderedIds.length === 0) return res.json({ success: true });

    // Update each record's order_index
    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { order_index: index }
      }
    }));
    
    await Model.bulkWrite(bulkOps);
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
