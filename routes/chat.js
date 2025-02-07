// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const router = require('./auth');
const router = express.Router();

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
router.use(bodyParser.json());
router.use(express.static('public'));

// Chat endpoint
router.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "system",
        content: `You are a helpful real estate assistant for LuxuryEstates. 
          Your capabilities include:
          - Answering questions about properties
          - Helping users find listings based on criteria
          - Providing information about neighborhoods
          - Explaining the buying/selling process
          - Scheduling viewings with agents
          - Answering pricing questions
          
          Current listings:
          - 4-bed villa in Beverly Hills ($5.2M)
          - Downtown LA penthouse ($3.8M)
          - Malibu beach house ($8.9M)
          
          Respond concisely and professionally.`
      }, {
        role: "user",
        content: message
      }]
    });

    res.json({
      reply: response.choices[0].message.content
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error processing chat request' });
  }
});


module.exports = router;