require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Property = require('./model/properties');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Database connection
const DB_URI = process.env.DB_URI || 'mongodb://127.0.0.1:27017/real-state';
mongoose.connect(DB_URI)
  .then(() => console.log("Database connected"))
  .catch(err => console.error("Connection error:", err));

// Cloudinary config
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

// Sample properties
const sampleProperties = [
  {
    title: "Luxury Beach Villa",
    price: 2500000,
    location: "Miami, FL",
    images: [
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be",
      "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf"
    ],
    bedrooms: 4,
    bathrooms: 3,
    sqft: 5000
  }
];

// Temporary storage setup
const tempDir = path.join(__dirname, 'temp');

// Improved file operations with retries
const cleanupTempFiles = async (maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (await fs.access(tempDir).then(() => true).catch(() => false)) {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log('Temp directory cleaned successfully');
        return;
      }
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Failed to clean temp directory after ${maxRetries} attempts:`, error);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// Robust image download with timeout
const downloadImage = async (url, timeout = 30000) => {
  const localPath = path.join(tempDir, `${uuidv4()}.jpg`);
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      timeout
    });

    const writer = require('fs').createWriteStream(localPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(localPath));
      writer.on('error', reject);
      response.data.on('error', reject);
    });
  } catch (err) {
    await safeDelete(localPath);
    throw err;
  }
};

// Enhanced Cloudinary upload with retries
const uploadToCloudinary = async (filePath, isVideo = false, retries = 3) => {
  const options = {
    folder: 'real-estate',
    resource_type: isVideo ? 'video' : 'image',
    timeout: 60000
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await cloudinary.uploader.upload(filePath, options);
      return {
        url: result.secure_url,
        public_id: result.public_id
      };
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
};

// Safe file deletion
const safeDelete = async (filePath) => {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
  } catch (error) {
    // File doesn't exist or already deleted
  }
};

// Main seeding function with improved error handling
const seedDatabase = async () => {
  try {
    await cleanupTempFiles();
    await Property.deleteMany({});
    console.log('Cleared existing properties');

    for (const property of sampleProperties) {
      const imageUploads = [];
      
      try {
        for (const imageUrl of property.images) {
          const localPath = await downloadImage(imageUrl);
          try {
            const cloudinaryResult = await uploadToCloudinary(localPath);
            imageUploads.push(cloudinaryResult);
          } finally {
            await safeDelete(localPath);
          }
        }

        const newProperty = new Property({
          ...property,
          images: imageUploads
        });

        await newProperty.save();
        console.log(`Added property: ${property.title}`);
      } catch (err) {
        console.error(`Failed to process property ${property.title}:`, err);
        // Cleanup any uploaded images for this property
        await Promise.all(imageUploads.map(async img => {
          try {
            await cloudinary.uploader.destroy(img.public_id);
          } catch (e) {
            console.error('Error cleaning up Cloudinary assets:', e);
          }
        }));
      }
    }
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await cleanupTempFiles();
    mongoose.connection.close();
    process.exit(0);
  }
};

// Execute seeding
seedDatabase();