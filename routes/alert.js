const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth2');
require('dotenv').config();

// Import your models (ensure these file paths match your project structure)
const Property = require('../model/properties');  // Adjust the file name if needed
const Alert = require('../model/alert');           // Make sure this file exists

// Configure transporter with improved settings
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS  // Your app password (if using 2FA)
  },
  tls: {
    rejectUnauthorized: false // For local testing only (remove in production)
  }
});

// Verify transporter connection
transporter.verify((error) => {
  if (error) {
    console.error('Mail transporter error:', error);
  } else {
    console.log('Mail server is ready to send messages');
  }
});

// ============================================
// Email Templates
// ============================================

// Alert Confirmation Template (sent when an alert is created)
const alertConfirmationTemplate = (propertyType, recentProperties) => {
  const propertyListHTML = recentProperties
    .map((property) => `
      <div style="margin-bottom: 30px;">
          <h2 style="color: #2980b9; margin-top: 0;">${property.title || 'Luxury Property'}</h2>
          <img src="${property.image || 'https://example.com/placeholder-property.jpg'}" 
               alt="${property.propertyType}" 
               style="width: 100%; height: 250px; object-fit: cover; border-radius: 8px;">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px;">
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                  <div style="color: #7f8c8d; font-size: 14px;">Price</div>
                  <div style="font-weight: bold; color: #2c3e50;">${property.price ? `$${property.price}` : 'Contact for price'}</div>
              </div>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                  <div style="color: #7f8c8d; font-size: 14px;">Bedrooms</div>
                  <div style="font-weight: bold; color: #2c3e50;">${property.bedrooms || 'N/A'}</div>
              </div>
          </div>
          <a href="${property.link || process.env.CLIENT_URL}" 
             style="display: inline-block; width: 100%; 
                    background-color: #3498db; color: white; 
                    padding: 15px; text-align: center; 
                    text-decoration: none; border-radius: 8px; 
                    font-weight: bold; font-size: 16px;">
              View Property Details
          </a>
      </div>
    `)
    .join('');

  return `
  <html>
      <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px;">
              <h1 class="logo">LuxuryEstates</h1>
              <h2 style="color: #2c3e50; margin-top: 20px;">Alert Successfully Created!</h2>
          </div>
          <div style="padding: 30px 20px;">
              <p style="font-size: 16px;">Hello there,</p>
              <p style="font-size: 16px;">We've successfully created your alert for <strong>${propertyType}</strong> properties.</p>
              <p style="font-size: 16px;">You'll be the first to know when new properties matching your criteria become available!</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
                  <h3 style="color: #2980b9; margin-top: 0;">What's Next?</h3>
                  <ul style="padding-left: 20px;">
                      <li>Instant email notifications for new properties</li>
                      <li>Exclusive early access to listings</li>
                      <li>Personalized property recommendations</li>
                  </ul>
              </div>

              <h3 style="color: #2980b9; margin-top: 30px;">New Properties Available:</h3>
              ${propertyListHTML}

              <p style="font-size: 14px; color: #7f8c8d;">You can update your preferences anytime by replying to this email.</p>
          </div>
      </body>
  </html>
  `;
};

// Property Alert Template (sent when a new property is added)
const propertyAlertTemplate = (recentProperties) => {
  const propertyListHTML = recentProperties
    .map((property) => `
      <div style="margin-bottom: 30px;">
          <h2 style="color: #2980b9; margin-top: 0;">${property.title || 'Luxury Property'}</h2>
          <img src="${property.image || 'https://example.com/placeholder-property.jpg'}" 
               alt="${property.propertyType}" 
               style="width: 100%; height: 250px; object-fit: cover; border-radius: 8px;">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px;">
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                  <div style="color: #7f8c8d; font-size: 14px;">Price</div>
                  <div style="font-weight: bold; color: #2c3e50;">${property.price ? `$${property.price}` : 'Contact for price'}</div>
              </div>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                  <div style="color: #7f8c8d; font-size: 14px;">Bedrooms</div>
                  <div style="font-weight: bold; color: #2c3e50;">${property.bedrooms || 'N/A'}</div>
              </div>
          </div>
          <a href="${property.link || process.env.CLIENT_URL}" 
             style="display: inline-block; width: 100%; 
                    background-color: #3498db; color: white; 
                    padding: 15px; text-align: center; 
                    text-decoration: none; border-radius: 8px; 
                    font-weight: bold; font-size: 16px;">
              View Property Details
          </a>
      </div>
    `)
    .join('');

  return `
  <html>
      <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px;">
              <img src="https://example.com/logo.png" alt="Company Logo" style="height: 60px;">
              <h1 style="color: #2c3e50; margin-top: 20px;">New Properties Available!</h1>
          </div>
          <div style="padding: 30px 20px;">
              ${propertyListHTML}
              <p style="font-size: 14px; color: #7f8c8d;">You can update your preferences anytime by replying to this email.</p>
          </div>
      </body>
  </html>
  `;
};

// ============================================
// Routes
// ============================================

// Create new alert (when a user subscribes for alerts)
router.post('/create', isLoggedIn, async (req, res) => {
  try {
    const { email, propertyType } = req.body;

    // Validation
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!['Villa', 'Apartment', 'Mansion'].includes(propertyType)) {
      return res.status(400).json({ error: 'Invalid property type' });
    }

    // Create the alert in the database
    const newAlert = await Alert.create({ email, propertyType });

    // Find recent properties (if any) matching the alert's propertyType
    const recentProperties = await Property.find({ propertyType: propertyType })
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();

    // Send confirmation email for alert creation
    const info = await transporter.sendMail({
      from: `Real Estate Alerts <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `✅ Alert Created for ${propertyType} Properties`,
      html: alertConfirmationTemplate(propertyType, recentProperties)
    });
    console.log('Alert confirmation email sent:', info.messageId);

    res.json({ message: 'Alert created! Check your email for confirmation.' });
  } catch (error) {
    console.error('Alert creation error:', error);
    res.status(500).json({ error: 'Failed to create alert. Please try again.' });
  }
});

// Add new property (when a new property is added to the system)
router.post('/properties', async (req, res) => {
  try {
    console.log('POST /properties route hit.');
    // Create the property in the database.
    // Make sure that the property creation form sends a field named "propertyType"
    const newProperty = await Property.create({
      ...req.body,
      createdAt: new Date()
    });
  
    // Use propertyType to find matching alerts
    const matchingAlerts = await Alert.find({ 
      propertyType: newProperty.propertyType
    });
  
    // Get recent properties for this propertyType
    const recentProperties = await Property.find({ propertyType: newProperty.propertyType })
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();
      
    console.log('New property type:', newProperty.propertyType);
    console.log('Found matching alerts:', matchingAlerts);
    console.log('Recent properties:', recentProperties);
  
    // Send notifications to all matching alerts
    await Promise.all(matchingAlerts.map(async (alert) => {
      try {
        const info = await transporter.sendMail({
          from: `Real Estate Alerts <${process.env.EMAIL_USER}>`,
          to: alert.email,
          subject: `🌟 New ${newProperty.propertyType} Properties Available`,
          html: propertyAlertTemplate(recentProperties)
        });
        console.log(`Notification sent to ${alert.email} - Message ID: ${info.messageId}`);
      } catch (error) {
        console.error(`Error sending to ${alert.email}:`, error.message);
      }
    }));
  
    res.json({ 
      message: `Property added and ${matchingAlerts.length} notifications sent`,
      property: newProperty
    });
  } catch (error) {
    console.error('Property addition error:', error);
    res.status(500).json({ error: 'Failed to add property' });
  }
});

// ============================================
// Helper Functions
// ============================================
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = router;
