const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');

// Local Strategy
passport.use(new LocalStrategy({ usernameField: 'email' }, 
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email });
      if (!user) return done(null, false, { message: 'Invalid credentials' });
      if (!(await user.comparePassword(password))) {
        return done(null, false, { message: 'Invalid credentials' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await User.findOrCreate(
      { googleId: profile.id },
      { 
        name: profile.displayName,
        email: profile.emails[0].value 
      }
    );
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// Facebook Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "/auth/facebook/callback",
  profileFields: ['id', 'displayName', 'emails']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await User.findOrCreate(
      { facebookId: profile.id },
      { 
        name: profile.displayName,
        email: profile.emails[0].value 
      }
    );
    done(null, user);
  } catch (err) {
    done(err);
  }
}));