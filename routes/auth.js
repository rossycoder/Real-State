const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../model/User");

// Use URL-encoded middleware to parse form data
router.use(express.urlencoded({ extended: true }));

// =====================
// Registration Routes
// =====================

// Render the registration form
router.get("/register", (req, res) => res.render("register"));

// Process the registration form
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Enforce a minimum password length
    if (password.length < 8) {
      req.flash("error", "Password must be at least 8 characters");
      return res.redirect("/auth/register");
    }

    // Check if the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash("error", "Email already registered");
      return res.redirect("/auth/register");
    }

    // Create and save the new user
    const newUser = new User({ name, email, password });
    await newUser.save();

    req.flash("success", "Registration successful! Please login");
    res.redirect("/auth/login");
  } catch (err) {
    console.error("Registration error:", err);
    req.flash("error", "Registration failed");
    res.redirect("/auth/register");
  }
});

// =====================
// Login Routes
// =====================

// Render the login form
router.get("/login", (req, res) => {
  // If the user is trying to access a page that requires login, store that URL
  if (req.session.returnTo) {
    res.locals.returnTo = req.session.returnTo;  // Store return URL for rendering
  }
  res.render("login");
});

// Process the login form with return-to behavior
router.post(
  "/login",
  (req, res, next) => {
    // Store the URL the user originally requested, if they were redirected here
    if (req.headers.referer) {
      req.session.returnTo = req.headers.referer;
    }
    next();
  },
  passport.authenticate("local", {
    failureRedirect: "/auth/login",
    failureFlash: true,
  }),
  (req, res) => {
    // After a successful login, redirect to the URL the user originally requested
    const redirectUrl = req.session.returnTo || "/";
    delete req.session.returnTo; // Clear the stored URL after redirection
    res.redirect(redirectUrl);
  }
);

// =====================
// Social Logins
// =====================

// Google Login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/login", failureFlash: true }),
  (req, res) => {
    const redirectUrl = req.session.returnTo || "/";
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  }
);

// Facebook Login
router.get(
  "/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/auth/login", failureFlash: true }),
  (req, res) => {
    const redirectUrl = req.session.returnTo || "/";
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  }
);

// =====================
// Logout Route
// =====================

router.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.flash("success", "Logged out successfully");
    res.redirect("/auth/login");
  });
});

module.exports = router;
