import User from "../Models/UserSchema.js";
import bcrypt from 'bcrypt';
import { sendEmail, sendRegistrationEmail, sendLoginVerificationEmail, sendForgotPasswordEmail } from "../Utils/Nodemailer.js";
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { uploadImageToCloudinary } from "../Middleware/Uploadmiddleware.js";
import passport from '../Utils/passport.js';

dotenv.config({ quiet: true })


const Createuser = async (req, res) => {

    try {

        const { name, email, phone, password, gender, verifycode, conformpassword } = req.body;

        if (password.length < 4) {

            return res.status(400).json({

                status: "fail",
                message: "password greater than 4 characters"
            })
        }

        // Check if user with same email and local authProvider already exists
        const existuser = await User.findOne({
            email: email,
            authProvider: 'local'
        })

        if (existuser) {
            if (existuser.verifiedstatus) {
                return res.status(400).json({
                    status: "fail",
                    message: "This email is already registered and verified. Please login."
                })
            }
            // If exists but not verified, we will update it below
        }

        if (password != conformpassword) {
            return res.status(400).json({
                status: "fail",
                message: "Passwords do not match"
            })
        }

        const hashpass = await bcrypt.hash(password, 8)
        const code = Math.floor(100000 + Math.random() * 900000);

        let imageUrl = existuser ? existuser.Image : null;
        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "users");
                imageUrl = uploadResult.secure_url;
            } catch (err) {
                console.error("Cloudinary Error:", err);
            }
        }



        // Send premium HTML verification email FIRST (like login logic)
        try {
            await sendRegistrationEmail(email, code);
        } catch (err) {
            console.error("Registration Email Error:", err);
            return res.status(500).json({
                status: "fail",
                message: "Failed to send verification email. " + err.message
            });
        }

        let user;
        if (existuser) {
            // Update existing unverified user
            existuser.name = name;
            existuser.phone = phone;
            existuser.gender = gender;
            existuser.password = hashpass;
            existuser.Image = imageUrl;
            existuser.verifycode = code;
            await existuser.save();
            user = existuser;
        } else {
            // Create new user
            user = await User.create({
                'name': name,
                'email': email,
                'phone': phone,
                'gender': gender,
                'password': hashpass,
                'Image': imageUrl,
                'verifycode': code,
                'authProvider': 'local'
            })
        }

        return res.status(200).json({
            status: "success",
            data: user
        })
    } catch (err) {
        console.error("Registration Error:", err);
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong during registration: " + err.message
        })
    }
}

const verifyLoginCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                status: "fail",
                message: "Email and verification code are required"
            });
        }

        const user = await User.findOne({
            email: email,
            verifiedstatus: true,
            loginCode: parseInt(code),
            loginCodeExpiry: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid or expired verification code"
            });
        }

        // Clear the login code
        user.loginCode = null;
        user.loginCodeExpiry = null;
        await user.save();

        // Generate token
        const token = jwt.sign({ id: user._id }, process.env.jwtkey, {
            expiresIn: process.env.jwtexp
        });

        return res.status(200).json({
            status: "success",
            message: "Login successful",
            data: user,
            token: token,
            redirectTo: user.role === 'admin' ? '/admin' : '/'
        });

    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong during verification"
        });
    }
};

const verifycode = async (req, res) => {

    try {

        const { code } = req.body;


        const user = await User.findOne({ verifycode: code })

        if (!user) {

            return res.status(400).json({
                status: "fail",
                message: "invalid code please reset again"
            })

            user.verifycode = null;
            await user.save()

        }


        user.verifiedstatus = true;
        user.verifycode = null;
        await user.save();

        return res.status(200).json({

            status: "success",
            message: "verified code successfull"
        })


    } catch (err) {

        return res.status(500).json({

            status: "fail",
            message: "something went wrong try later"
        })
    }
}

const getallusers = async (req, res) => {

    try {


        const user = await User.find()


        return res.status(200).json({

            status: "success",
            data:user 
        })

    } catch (err) {

        return res.status(500).json({

            status: "fail",
            message: "something went wrong try later"
        })
    }
}


const loginuser = async (req, res) => {

    try {

        const { email, password } = req.body


        if (!email || !password) {

            return res.status(400).json({
                status: "fail",
                message: "please enter email or password"
            })
        }

        // Find user with email and verified status
        const existuser = await User.findOne({
            email: email,
            verifiedstatus: true
        })

        if (!existuser) {

            return res.status(400).json({
                status: "fail",
                message: "user not registered"
            })
        }

        // Check if user has a password (should always be true for non-Google users)
        if (!existuser.password) {
            return res.status(400).json({
                status: "fail",
                message: "Account setup incomplete. Please contact support."
            })
        }

        const passcheck = await bcrypt.compare(password, existuser.password);

        if (!passcheck) {

            return res.status(400).json({
                status: "fail",
                message: "invalid credentials"
            })
        }

        // Check if user is admin - only admins need verification
        if (existuser.role === 'admin') {
            // Generate verification code for admin login
            const code = Math.floor(100000 + Math.random() * 900000);

            // Send premium HTML admin login verification email
            await sendLoginVerificationEmail(email, code).catch(err => console.error("Admin Login Email Error:", err));

            // Save verification code temporarily
            existuser.loginCode = code;
            existuser.loginCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
            await existuser.save();

            return res.status(200).json({
                status: "success",
                message: "Verification code sent to your email",
                requiresVerification: true,
                email: email
            });
        } else {
            // Regular user - direct login without verification
            const token = jwt.sign({ id: existuser._id }, process.env.jwtkey, {
                expiresIn: process.env.jwtexp
            })

            return res.status(200).json({
                status: "success",
                data: existuser,
                token: token,
                redirectTo: '/'
            });
        }


    } catch (err) {

        return res.status(500).json({
            status: "fail",
            message: "something went wrong"
        })




    }
}


const verifyuserdata = async (req, res) => {
    try {
        const id = req.id;
        const userdata = await User.findById(id);
        if (!userdata || userdata.verifiedstatus !== true || userdata.active === false) {
            return res.status(401).json({ status: "fail", message: "Unauthorized, please login again", data: null });
        }
        return res.status(200).json({ status: "success", data: userdata });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "something went wrong", data: null });
    }
};

const forgotpassword = async (req, res) => {

    try {

        const { email } = req.body;


        const existuser = await User.findOne({ email: email, verifiedstatus: true })

        if (!existuser) {

            return res.status(400).json({
                status: "fail",
                message: "user not registered"
            })
        }

        const code = Math.floor(100000 + Math.random() * 900000);


        const date = Date.now();
        const fiveMinsLater = date + 5 * 60 * 1000;


        // Send premium HTML forgot password email
        await sendForgotPasswordEmail(email, code).catch(err => console.error("Forgot Password Email Error:", err));

        existuser.forgotpasscode = code;
        existuser.forgotpassexp = fiveMinsLater;
        await existuser.save()

        return res.status(200).json({

            status: "success",
            message: "forgot code sent successfully",
            data: existuser
        })

    } catch (err) {

        return res.status(500).json({

            status: "error",
            message: "something went wrong"
        })
    }
}


const resetpassword = async (req, res) => {

    try {

        const { code, password, cpassword } = req.body;

        if (!code || !password || !cpassword) {

            return res.status(400).json({

                status: "fail",
                message: "please enter code or password or cpassword"
            })
        }

        const user = await User.findOne({ forgotpasscode: code, forgotpassexp: { $gt: Date.now() } });



        if (!user) {


            return res.status(400).json({

                status: "fail",
                message: "invalid code or code expire"
            })
        }


        if (password != cpassword) {
            return res.status(400).json({

                status: "fail",
                message: "password conformpassword not match"
            })
        }


        const hashpass = await bcrypt.hash(password, 8)

        user.password = hashpass
        user.forgotpasscode = null;
        user.forgotpassexp = null;

        await user.save();


        return res.status(200).json({
            status: "success",
            messege: "password changed successfully",
            data: user
        })


    } catch (err) {

        return res.status(500).json({

            status: "error",
            message: "something went wrong"
        })
    }
}

const updateProfile = async (req, res) => {
    try {
        const id = req.id;
        const { name, phone, gender } = req.body;
        let imageUrl;
        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "users");
                imageUrl = uploadResult.secure_url;
            } catch (err) {
                return res.status(400).json({ status: "fail", message: "Cloudinary upload failed" });
            }
        }
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ status: "fail", message: "User not found" });
        }
        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (gender) user.gender = gender;
        if (imageUrl) user.Image = imageUrl;
        await user.save();
        return res.status(200).json({ status: "success", data: user });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "Something went wrong" });
    }
}

const changePassword = async (req, res) => {
    try {
        const id = req.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                status: "fail",
                message: "Current password and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                status: "fail",
                message: "New password must be at least 6 characters long"
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ status: "fail", message: "User not found" });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                status: "fail",
                message: "Current password is incorrect"
            });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 8);
        user.password = hashedNewPassword;
        await user.save();

        return res.status(200).json({
            status: "success",
            message: "Password changed successfully"
        });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "Something went wrong" });
    }
}


// Google OAuth Login Initiation
const googleLogin = (req, res, next) => {
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })(req, res, next);
};

// Google OAuth Callback Handler
// Google OAuth Callback Handler
const googleCallback = (req, res, next) => {
    passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login` }, async (err, user) => {
        if (err) {
            console.error('Google OAuth error:', err);
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_auth_failed`);
        }

        if (!user) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=user_not_found`);
        }

        try {
            // Generate JWT token for the authenticated user
            const token = jwt.sign({ id: user._id }, process.env.jwtkey, {
                expiresIn: process.env.jwtexp
            });

            // For API responses, return JSON with token
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(200).json({
                    status: "success",
                    message: "Google login successful",
                    data: user,
                    token: token,
                    redirectTo: user.role === 'admin' ? '/admin' : '/'
                });
            }

            // For web redirects, set token in cookie and redirect with token as URL param
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });

            // Redirect based on user role with token as URL parameter for frontend to store
            const redirectUrl = '/auth/google/callback';
            const loginType = user.authProvider === 'google' ? 'google' : 'user';
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const fullRedirectUrl = `${frontendUrl}${redirectUrl}?token=${token}&loginType=${loginType}`;

            res.redirect(fullRedirectUrl);

        } catch (error) {
            console.error('Token generation error:', error);
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=token_generation_failed`);
        }
    })(req, res, next);
};

// Get Google OAuth URL for frontend
const getGoogleAuthUrl = (req, res) => {
    try {
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${process.env.Google_Clientid}&` +
            `redirect_uri=${encodeURIComponent('http://localhost:5000/user/auth/google/callback')}&` +
            `scope=${encodeURIComponent('openid profile email')}&` +
            `response_type=code&` +
            `access_type=offline&` +
            `prompt=consent`;

        res.status(200).json({
            status: "success",
            authUrl: authUrl
        });
    } catch (error) {
        console.error('Error generating Google auth URL:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to generate Google auth URL"
        });
    }
};

// Exchange Google authorization code for user data (called from frontend callback)
const exchangeGoogleCode = async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                status: "fail",
                message: "Authorization code is required"
            });
        }

        // Here you would typically use the Google OAuth2 client to exchange the code for tokens
        // For now, we'll use a simplified approach - in production, use proper OAuth2 flow

        // This is a placeholder - you need to implement proper code exchange
        // using Google's OAuth2 client library
        return res.status(400).json({
            status: "fail",
            message: "Code exchange not implemented - please use backend callback approach"
        });

    } catch (error) {
        console.error('Google code exchange error:', error);
        return res.status(500).json({
            status: "fail",
            message: "Failed to exchange authorization code"
        });
    }
};

// Update user role (admin only)
const updateRole = async (req, res) => {
    try {
        const { userId, role } = req.body;
        const adminId = req.id;

        // Check if requester is admin
        const adminUser = await User.findById(adminId);
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({
                status: "fail",
                message: "Only admins can update user roles"
            });
        }

        // Validate role
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid role. Must be 'user' or 'admin'"
            });
        }

        // Update user role
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { role: role },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                status: "fail",
                message: "User not found"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "User role updated successfully",
            data: updatedUser
        });

    } catch (error) {
        console.error('Update role error:', error);
        return res.status(500).json({
            status: "fail",
            message: "Failed to update user role"
        });
    }
};

const toggleUserActive = async (req, res) => {
    try {
        const { userId } = req.body;
        const adminId = req.id;

        // Check if requester is admin
        const adminUser = await User.findById(adminId);
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({
                status: "fail",
                message: "Only admins can change user status"
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: "fail",
                message: "User not found"
            });
        }

        user.active = user.active === false ? true : false;
        await user.save();

        return res.status(200).json({
            status: "success",
            message: `User status updated to ${user.active ? 'Active' : 'Inactive'}`,
            data: user
        });
    } catch (error) {
        console.error('Toggle user active status error:', error);
        return res.status(500).json({
            status: "fail",
            message: "Failed to toggle user status"
        });
    }
};

export { Createuser, verifycode, loginuser, verifyLoginCode, verifyuserdata, forgotpassword, resetpassword, getallusers, updateProfile, changePassword, googleLogin, googleCallback, getGoogleAuthUrl, exchangeGoogleCode, updateRole, toggleUserActive }
