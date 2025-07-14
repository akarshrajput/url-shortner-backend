const mongoose = require("mongoose");
require("dotenv").config();

const url = process.env.MONGODB_URI;

const connectDB = async () => {
  try {
    await mongoose.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB Atlas");
  } catch (err) {
    console.error("Error connecting to MongoDB Atlas:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
