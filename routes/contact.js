const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth2');
require('dotenv').config();

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',  // Gmail service
    auth: {
        user: process.env.EMAIL_USER,  // Email address (e.g. your-email@gmail.com)
        pass: process.env.EMAIL_PASS,  // App password if 2FA is enabled
    },
    tls: {
        rejectUnauthorized: false,  // Set to false only for local testing
    },
});

// Verify connection to the mail server
transporter.verify((error) => {
    if (error) {
        console.error('Mail transporter error:', error);
    } else {
        console.log('Mail server is ready to send messages');
    }
});

// Contact route to handle the contact form submission
router.post('/contact-agent',isLoggedIn, (req, res) => {
    const { agentName, userEmail, message } = req.body;

    // Prepare email content
    const mailOptions = {
        from: userEmail,
        to: 'rozeena031@gmail.com',  // Agent's email
        subject: `Message from ${userEmail} regarding ${agentName}`,
        text: `Message: ${message}\n\nFrom: ${userEmail}`,
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            console.error('Error response:', error.response);  // Log the error response for debugging
            return res.status(500).json({ error: `Failed to send message: ${error.message}` });
        }

        console.log('Email sent:', info.response);  // Log successful send
        return res.status(200).json({ message: 'Message sent successfully!' });
    });
});

module.exports = router;
