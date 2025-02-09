const express = require('express');
const router = express.Router();
const Property = require('../model/properties');
const Alert = require('../model/alert'); // Import the Alert model for notifications
const multer = require('multer');
const { cloudinary } = require('../utlis/cloudinary');
const fs = require('fs');
const { isLoggedIn, isOwner, validateProperty } = require('../middleware/auth2');
const methodOverride = require('method-override');
const nodemailer = require('nodemailer');

// Use method-override to support PUT and DELETE methods in forms
router.use(methodOverride('_method'));

// Set up multer to store files temporarily in the "uploads" folder.
const upload = multer({ dest: 'uploads/' });

// Helper function to delete local files after upload
const deleteFiles = async (files) => {
  if (files) {
    const fileArray = Array.isArray(files) ? files : [files];
    await Promise.all(
      fileArray.map(file =>
        fs.promises.unlink(file.path).catch(console.error)
      )
    );
  }
};

// ==========================
// Configure Nodemailer
// ==========================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS  // Your app password if using 2FA
  },
  tls: {
    rejectUnauthorized: false // For local testing only (remove in production)
  }
});

transporter.verify((error) => {
  if (error) {
    console.error('Mail transporter error:', error);
  } else {
    console.log('Mail server is ready to send messages');
  }
});

// ==========================
// Email Template for Property Alerts
// ==========================
const propertyAlertTemplate = (recentProperties) => {
  // Create each property “card” as HTML
  const propertyCardsHTML = recentProperties.map(property => `
    <div style="background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; width: calc(50% - 1rem); margin-bottom: 20px;">
      <!-- Image Section -->
      <div style="position: relative; height: 240px;">
        <div style="
          height: 100%;
          width: 100%;
          background-image: url('${property.images[0]?.url || 'https://example.com/placeholder-property.jpg'}');
          background-size: cover;
          background-position: center;
        "></div>
      </div>
      <!-- Content Section -->
      <div style="padding: 1.5rem;">
      <h1 style=" {
        color:  #D4AF37;
        font-size: 1.8rem;
        font-weight: 700;
        letter-spacing: 1px;
    }">LuxuryEstates</h1>
        <h3 style="font-size: 1.1rem; color: #2c3e50; margin-bottom: 8px; font-weight: 600;">
          ${property.title || 'Luxury Property'}
        </h3>
        <p style="color: #717171; font-size: 0.95rem; margin-bottom: 16px;">
          ${property.location || ''}
        </p>
        <div style="display: flex; align-items: baseline; gap: 8px;">
          <span style="font-size: 1.2rem; font-weight: 700; color: #2c3e50;">
            $${property.price ? property.price.toLocaleString() : 'N/A'}
          </span>
          <span style="color: #717171; font-size: 0.9rem;">/ night</span>
          ${property.originalPrice ? `<span style="color: #717171; text-decoration: line-through; font-size: 0.9rem; margin-left: 8px;">$${property.originalPrice.toLocaleString()}</span>` : ''}
        </div>
        <div style="margin-top: 1rem;">
          <a href="${property.link || `${process.env.CLIENT_URL}/properties/${property._id}`}" style="
            display: inline-block;
            background-color: #3498db;
            color: white;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
          ">View Details</a>
        </div>
      </div>
    </div>
  `).join('');

  // Return the complete HTML document with inline styles mimicking your grid layout
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Properties Available</title>
    <style>
      /* Basic styles for email (many email clients require inline or embedded CSS) */
     .logo {
        color:  #D4AF37;
        font-size: 1.8rem;
        font-weight: 700;
        letter-spacing: 1px;
    }
      .property-grid-container {
        display: flex;
        flex-wrap: wrap;
        gap: 2rem;
        padding: 0 5%;
        max-width: 1400px;
        margin: 2rem auto;
        justify-content: center;
      }
      @media (max-width: 768px) {
        .property-card {
          width: 100% !important;
        }
      }
    </style>
  </head>
  <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0;">
    <!-- Header Section -->
    <div style="text-align: center; border-bottom: 2px solid #f0f0f0; padding: 20px;">
     <h1 class="logo">LuxuryEstates</h1>
      <h2 style="color: #2c3e50; margin-top: 20px;">
        New ${recentProperties[0]?.category || ''} Properties Available!
      </h2>
    </div>
    <!-- Properties Grid -->
    <div class="property-grid-container">
      ${propertyCardsHTML}
    </div>
    <!-- Footer Section -->
    <div style="text-align: center; padding: 20px;">
      <p style="font-size: 14px; color: #7f8c8d;">
        You can update your preferences anytime by replying to this email.
      </p>
    </div>
  </body>
  </html>
  `;
};


// ==========================
// NEW PROPERTY ROUTES
// ==========================

// Render Form to Add a New Property
router.get('/property/new', isLoggedIn, (req, res) => {
  // Pass allowed categories to the view (e.g., Villa, Apartment, Mansion)
  res.render('new.ejs', { categories: ['Villa', 'Apartment', 'Mansion'] });
});

// Create a New Property with Email Notification
router.post(
  '/property',
  isLoggedIn,
  upload.array('images', 5),
  // Add owner to req.body before validating
  (req, res, next) => {
    req.body.owner = req.user._id.toString();
    next();
  },
  // Now validate the property data (this runs after multer has parsed the form)
  validateProperty,
  async (req, res) => {
    try {
      // Enforce that exactly 3 or 5 images are uploaded
      if (req.files.length !== 3 && req.files.length !== 5) {
        throw new Error('Please upload exactly 3 or 5 images.');
      }

      const { title, price, description, location, bedrooms, bathrooms, sqft, category } = req.body;

      // Upload images to Cloudinary with a fresh timestamp
      const imageUploads = req.files.map(file =>
        cloudinary.uploader.upload(file.path, { timestamp: Math.floor(Date.now() / 1000) })
      );
      const uploadedImages = await Promise.all(imageUploads);

      // Create new property (note: field "category" is used to store the property type)
      const property = new Property({
        title,
        price,
        description,
        location,
        bedrooms,
        bathrooms,
        sqft,
        category,
        owner: req.user._id, // Provided by isLoggedIn middleware
        images: uploadedImages.map(img => ({
          url: img.secure_url,
          public_id: img.public_id
        }))
      });

      await property.save();
      await deleteFiles(req.files);

      // -------------------------------
      // NEW: Send Notification Emails
      // -------------------------------
      // Here, we assume that the alert's propertyType should match the property category.
      const matchingAlerts = await Alert.find({ propertyType: category });
      console.log('Found matching alerts:', matchingAlerts);

      // Get recent properties for this category to include in the email
      const recentProperties = await Property.find({ category: category })
        .sort({ createdAt: -1 })
        .limit(2)
        .lean();
      console.log('Recent properties:', recentProperties);

      // Send notifications to each matching alert
      await Promise.all(matchingAlerts.map(async (alert) => {
        try {
          const info = await transporter.sendMail({
            from: `Real Estate Alerts <${process.env.EMAIL_USER}>`,
            to: alert.email,
            subject: `🌟 New ${category} Property Added`,
            html: propertyAlertTemplate(recentProperties)
          });
          console.log(`Notification sent to ${alert.email} - Message ID: ${info.messageId}`);
        } catch (error) {
          console.error(`Error sending to ${alert.email}:`, error.message);
        }
      }));

      // Redirect to home (or wherever appropriate)
      res.redirect('/');
    } catch (err) {
      await deleteFiles(req.files);
      res.status(400).json({ error: err.message });
    }
  }
);

/* ===========================
   OTHER PROPERTY ROUTES
   =========================== */

// GET Single Property with Reviews and Owner Details
router.get('/properties/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate({
        path: 'reviews',
        populate: {
          path: 'user',
          model: 'User',
          select: 'name'
        }
      })
      .populate('owner', 'name');

    if (!property) return res.status(404).send('Property not found');

    // Format review creation dates
    property.reviews.forEach(review => {
      review.formattedDate = review.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    res.render('show', { property, currentUser: req.user });
  } catch (err) {
    console.error('Property fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Edit Property Route - Render Edit Form
// (No need to validate here because you're only rendering the form)
router.get('/properties/:id/edit', isLoggedIn, isOwner, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      req.flash("error", "Property not found.");
      return res.redirect("/");
  }
  
  if (!req.user || property.owner.toString() !== req.user._id.toString()) {
      req.flash("error", "You do not have permission to edit this listing.");
      return res.redirect(`/properties/${property._id}`);
  }
    res.render('edit', { property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Property (handling text fields, new image uploads, and virtual tour update)
router.put(
  '/properties/:id',
  isLoggedIn,
  isOwner,
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'virtualTour', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const property = await Property.findById(id);
      if (!property) throw new Error("Property not found");

      // Update text fields
      property.title = req.body.title || property.title;
      if (req.body.price) property.price = req.body.price;
      if (req.body.description) property.description = req.body.description;
      if (req.body.location) property.location = req.body.location;
      if (req.body.bedrooms) property.bedrooms = req.body.bedrooms;
      if (req.body.bathrooms) property.bathrooms = req.body.bathrooms;
      if (req.body.sqft) property.sqft = req.body.sqft;
      if (req.body.category) property.category = req.body.category;

      // Process new images if provided
      if (req.files['images'] && req.files['images'].length > 0) {
        const imageUploads = req.files['images'].map(file =>
          cloudinary.uploader.upload(file.path, { timestamp: Math.floor(Date.now() / 1000) })
        );
        const uploadedImages = await Promise.all(imageUploads);
        // Append new images to existing ones
        property.images = property.images.concat(
          uploadedImages.map(img => ({
            url: img.secure_url,
            public_id: img.public_id
          }))
        );
        await deleteFiles(req.files['images']);
      }

      // Process virtual tour if provided
      if (req.files['virtualTour'] && req.files['virtualTour'].length > 0) {
        // Optionally remove the old virtual tour from Cloudinary
        if (property.virtualTour && property.virtualTour.public_id) {
          await cloudinary.uploader.destroy(property.virtualTour.public_id, { resource_type: 'auto' });
        }
        const vtFile = req.files['virtualTour'][0];
        const vtUpload = await cloudinary.uploader.upload(vtFile.path, {
          resource_type: 'auto',
          timestamp: Math.floor(Date.now() / 1000)
        });
        property.virtualTour = {
          url: vtUpload.secure_url,
          public_id: vtUpload.public_id
        };
        await deleteFiles(req.files['virtualTour']);
      }

      await property.save();
      res.redirect(`/properties/${property._id}`);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete Property
router.delete('/properties/:id', isLoggedIn, isOwner, async (req, res) => {
  try {
    await Property.findByIdAndDelete(req.params.id);
    res.redirect('/property');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a specific image from a property
router.delete('/properties/:propertyId/images/:index', isLoggedIn, isOwner, async (req, res) => {
  try {
    const { propertyId, index } = req.params;
    const property = await Property.findById(propertyId);
    if (!property) throw new Error('Property not found');
    const imageIndex = parseInt(index);
    if (isNaN(imageIndex) || imageIndex < 0 || imageIndex >= property.images.length) {
      throw new Error('Invalid image index');
    }
    const imageToDelete = property.images[imageIndex];
    await cloudinary.uploader.destroy(imageToDelete.public_id);
    property.images.splice(imageIndex, 1);
    await property.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete the virtual tour from a property
router.delete('/properties/:propertyId/virtualTour', isLoggedIn, isOwner, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await Property.findById(propertyId);
    if (!property) throw new Error('Property not found');
    if (property.virtualTour && property.virtualTour.public_id) {
      await cloudinary.uploader.destroy(property.virtualTour.public_id, { resource_type: 'auto' });
      property.virtualTour = undefined;
      await property.save();
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'No virtual tour found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search Properties
router.get('/property/search', async (req, res) => {
  const { location, category, priceRange } = req.query;
  try {
    let query = {};
    if (location) query.location = new RegExp(location, 'i');
    if (category) query.category = category;
    if (priceRange) {
      if (priceRange === '1-3') query.price = { $gte: 1000000, $lte: 3000000 };
      else if (priceRange === '3-5') query.price = { $gte: 3000000, $lte: 5000000 };
      else if (priceRange === '5+') query.price = { $gte: 5000000 };
    }
    const properties = await Property.find(query).sort('-createdAt');
    res.render('real state', { properties, searchParams: req.query });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/contact-agent', async (req, res) => {
  // Destructure all required fields from the request body
  const { agentName, agentEmail, userEmail, message } = req.body;

  // Optional: Log to verify data is coming through correctly
  console.log('Received contact request:', { agentName, agentEmail, userEmail, message });

  // Set up mail options; note that the 'to' field is set using agentEmail
  const mailOptions = {
      from: userEmail, // Sender's email (the user)
      to: agentEmail,  // Recipient: agent's email
      subject: `New Inquiry from ${userEmail}`,
      html: `
          <h3>Agent: ${agentName}</h3>
          <p><strong>User Email:</strong> ${userEmail}</p>
          <p><strong>Message:</strong> ${message}</p>
      `
  };

  try {
      await transporter.sendMail(mailOptions);
      res.json({ message: 'Message sent successfully to the agent!' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to send message. Please try again.' });
  }
});


module.exports = router;
