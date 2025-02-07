const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth2');
require('dotenv').config();

// Configure transporter with improved settings
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
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

// Temporary storage (replace with database in production)
let alerts = [];
let properties = [];

// Email Templates
const alertConfirmationTemplate = (propertyType) => `
<html>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px;">
            <img src="https://example.com/logo.png" alt="Company Logo" style="height: 60px;">
            <h1 style="color: #2c3e50; margin-top: 20px;">Alert Successfully Created!</h1>
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
            <p style="font-size: 14px; color: #7f8c8d;">You can update your preferences anytime by replying to this email.</p>
        </div>
    </body>
</html>
`;

const propertyAlertTemplate = (property) => `
<html>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px;">
            <img src="https://example.com/logo.png" alt="Company Logo" style="height: 60px;">
            <h1 style="color: #2c3e50; margin-top: 20px;">New ${property.type} Available!</h1>
        </div>
        <div style="padding: 30px 20px;">
            <div style="margin-bottom: 30px;">
                <img src="${property.image || 'https://example.com/placeholder-property.jpg'}" 
                     alt="${property.type}" 
                     style="width: 100%; height: 250px; object-fit: cover; border-radius: 8px;">
            </div>
            <h2 style="color: #2980b9; margin-top: 0;">${property.title || 'Luxury Property'}</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px;">
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <div style="color: #7f8c8d; font-size: 14px;">Price</div>
                    <div style="font-weight: bold; color: #2c3e50;">${property.price || 'Contact for price'}</div>
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
            <p style="margin-top: 25px; font-size: 14px; color: #7f8c8d;">
                This alert was triggered by your saved search for ${property.type} properties.
            </p>
        </div>
    </body>
</html>
`;

// Create new alert
router.post('/create',isLoggedIn, async (req, res) => {
    try {
        const { email, propertyType } = req.body;

        // Validation
        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }
        if (!['Villa', 'Penthouse', 'Mansion'].includes(propertyType)) {
            return res.status(400).json({ error: 'Invalid property type' });
        }

        // Store alert
        alerts.push({ email, propertyType });

        // Send confirmation email
        await transporter.sendMail({
            from: `Real Estate Alerts <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `✅ Alert Created for ${propertyType} Properties`,
            html: alertConfirmationTemplate(propertyType)
        });

        res.json({ message: 'Alert created! Check your email for confirmation.' });
    } catch (error) {
        console.error('Alert creation error:', error);
        res.status(500).json({ error: 'Failed to create alert. Please try again.' });
    }
});

// Add new property (trigger alerts)
router.post('/properties', async (req, res) => {
    try {
        const newProperty = {
            ...req.body,
            createdAt: new Date().toISOString()
        };

        // Basic property validation
        if (!newProperty.type || !newProperty.title) {
            return res.status(400).json({ error: 'Missing required property fields' });
        }

        properties.push(newProperty);

        // Find matching alerts
        const matchingAlerts = alerts.filter(alert => 
            alert.propertyType === newProperty.type
        );

        // Send notifications
        await Promise.all(matchingAlerts.map(async (alert) => {
            try {
                await transporter.sendMail({
                    from: `Real Estate Alerts <${process.env.EMAIL_USER}>`,
                    to: alert.email,
                    subject: `🌟 New ${newProperty.type}: ${newProperty.title}`,
                    html: propertyAlertTemplate(newProperty)
                });
                console.log(`Notification sent to ${alert.email}`);
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



// Helper function
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = router;
