const express = require('express');
const router = express.Router();
const Property = require('../model/properties');
const multer = require('multer');
const { cloudinary } = require('../utlis/cloudinary');
const fs = require('fs');
const { isLoggedIn, isOwner, validateProperty } = require('../middleware/auth2');
const methodOverride = require('method-override');

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

/* ===========================
   NEW PROPERTY ROUTES
   =========================== */

// Render Form to Add a New Property
// (NOTE: We have removed the validateProperty middleware here because GET requests have no body)
router.get('/property/new', isLoggedIn, (req, res) => {
  // Pass allowed categories to the view (e.g., Villa, Apartment, Mansion)
  res.render('new.ejs', { categories: ['Villa', 'Apartment', 'Mansion'] });
});

// Create a New Property
router.post(
  '/property',
  isLoggedIn,
  upload.array('images', 5),
  // Add owner to req.body before validating
  (req, res, next) => {
    req.body.owner = req.user._id;
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

      // Create new property
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
      res.redirect('/property');
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

module.exports = router;
