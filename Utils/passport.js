import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../Models/UserSchema.js';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.Google_Clientid,
            clientSecret: process.env.Gogle_ClientSecret,
            callbackURL:
                process.env.GOOGLE_CALLBACK_URL ||
                `${process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`}/user/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user already exists with this Google ID
                let existingUser = await User.findOne({ googleId: profile.id });

                if (existingUser) {
                    return done(null, existingUser);
                }

                // Check if there is an existing user with this email but no googleId
                // This happens if they registered with email/password first
                let userWithEmail = await User.findOne({ email: profile.emails[0].value });

                if (userWithEmail) {
                    // Link the Google account to the existing account
                    userWithEmail.googleId = profile.id;
                    userWithEmail.googleEmail = profile.emails[0].value;
                    userWithEmail.authProvider = 'google';
                    userWithEmail.isGoogleLogin = true;
                    userWithEmail.role = 'user'; // Force user role as requested
                    if (!userWithEmail.Image) {
                        userWithEmail.Image = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;
                    }
                    await userWithEmail.save();
                    return done(null, userWithEmail);
                }

                // Create new user if not found by ID or Email
                const newUser = new User({
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    googleId: profile.id,
                    googleEmail: profile.emails[0].value,
                    authProvider: 'google',
                    isGoogleLogin: true,
                    verifiedstatus: true,
                    Image: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
                    role: 'user',
                    active: true
                });

                await newUser.save();
                return done(null, newUser);

            } catch (error) {
                console.error('Google OAuth error:', error);
                return done(error, null);
            }
        }
    )
);

export default passport;
