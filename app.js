// Load Environment Variables
require('dotenv').config();

// Import Dependencies
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const path = require('path');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

// Import Routes & Models
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const User = require('./model/User');
const Property = require('./model/properties');
const  reviewRoutes = require('./routes/review');
const alertRouter = require('./routes/alert'); 
const Contact = require('./routes/contact');
const Webbook = require('./routes/book');
// Initialize Express App
const app = express();

// Connect to MongoDB
mongoose.connect(process.env.DB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.log("❌ MongoDB Connection Error:", err));

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

// Session Configuration
app.use(session({
  secret: "your_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 3600000 }
}));

// Passport.js Configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({ usernameField: "email", passwordField: "password" },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email });
      if (!user || !user.password) {
        return done(null, false, { message: "Incorrect email or password." });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return done(null, false, { message: "Incorrect email or password." });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Flash Messages Middleware
app.use(flash());

// Global Variables Middleware
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// Chat Page Route
app.get('/api/chat', (req, res) => res.render("real state"));

// Chatbot API using Hugging Face's BlenderBot
// Chatbot API using Hugging Face's BlenderBot
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    const response = await fetch("https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`, 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: message }),
    });

    const data = await response.json();
    
    console.log("Chat response:", data); // Debugging ke liye log

    if (data && Array.isArray(data) && data[0]?.generated_text) {
      res.json({ reply: data[0].generated_text });
    } else {
      res.json({ reply: "Sorry, I couldn't process your request." });
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error processing chat request' });
  }
});


// Routes
app.use("/auth", authRoutes);
app.use("/", propertyRoutes);
app.use('/properties', reviewRoutes); 
app.use('/alert', alertRouter);
app.use('/contact', Contact);
app.use('/webhook', Webbook);

// Home Route
app.get("/", async (req, res) => {
  try {
    const properties = await Property.find(); // Fetch properties from DB
    res.render("real state", { user: req.user, properties });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.render("real state", { user: req.user, properties: [] }); // Empty array if error
  }
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
