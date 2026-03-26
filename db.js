const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error('ERROR: MONGODB_URI is not set in environment variables!');
      console.error('Admin dashboard and all API data will NOT work without this.');
      console.error('Please set MONGODB_URI in your .env file and in Render environment variables.');
      // Do NOT exit — let the server start so /health still works
      return;
    }
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10s timeout for initial connection
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Don't crash the server — let it run so health check still works
  }
};

module.exports = connectDB;
