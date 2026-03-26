const mongoose = require('mongoose');

// Global plugin to map _id to id in JSON responses
mongoose.plugin((schema) => {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
    }
  });
});

const userProfileSchema = new mongoose.Schema({
  name: String,
  field: String,
  university: String,
  location: String,
  career_goal: String,
  tagline: String,
  about_background: String,
  about_interests: String,
  journey_text: String,
  resume_url: String,
  profile_image: String,
  college_image: String,
  social_github: String,
  social_linkedin: String,
  social_instagram: String,
  social_email: String,
  welcome_message: String
});

const skillSchema = new mongoose.Schema({
  category: String,
  name: String,
  order_index: { type: Number, default: 0 }
});

const projectSchema = new mongoose.Schema({
  title: String,
  problem: String,
  solution: String,
  tools: String,
  role: String,
  outcome: String,
  image_url: String,
  github_url: String,
  live_url: String,
  order_index: { type: Number, default: 0 }
});

const experienceSchema = new mongoose.Schema({
  role: String,
  company: String,
  period: String,
  description: String,
  order_index: { type: Number, default: 0 }
});

const certificationSchema = new mongoose.Schema({
  title: String,
  issuer: String,
  year: String,
  order_index: { type: Number, default: 0 }
});

const educationSchema = new mongoose.Schema({
  degree: String,
  institution: String,
  year: String,
  description: String,
  order_index: { type: Number, default: 0 }
});

const achievementSchema = new mongoose.Schema({
  title: String,
  date: String,
  description: String,
  image_url: String,
  order_index: { type: Number, default: 0 }
});

const messageSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  created_at: { type: Date, default: Date.now }
});

module.exports = {
  UserProfile: mongoose.model('UserProfile', userProfileSchema),
  Skill: mongoose.model('Skill', skillSchema),
  Project: mongoose.model('Project', projectSchema),
  Experience: mongoose.model('Experience', experienceSchema),
  Certification: mongoose.model('Certification', certificationSchema),
  Education: mongoose.model('Education', educationSchema),
  Achievement: mongoose.model('Achievement', achievementSchema),
  Message: mongoose.model('Message', messageSchema)
};
