import Seller from "../Models/SellerSchema.js";
import Order from "../Models/OrderSchema.js";
import bcrypt from "bcrypt";
import { sendEmail } from "../Utils/Nodemailer.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { uploadImageToCloudinary } from "../Middleware/Uploadmiddleware.js";

dotenv.config({ quiet: true });

const CreateSeller = async (req, res) => {
    try {
        const {
            name, email, phone, password, gender,
            shopName, shopAddress, shopDescription,
            conformpassword
        } = req.body;

        if (password.length < 4) {
            return res.status(400).json({
                status: "fail",
                message: "Password must be greater than 4 characters"
            });
        }

        const existSeller = await Seller.findOne({ email: email, verifiedstatus: true });

        if (existSeller) {
            return res.status(400).json({
                status: "fail",
                message: "Seller already registered"
            });
        }

        if (password !== conformpassword) {
            return res.status(400).json({
                status: "fail",
                message: "Password and confirm password do not match"
            });
        }

        const hashpass = await bcrypt.hash(password, 8);
        const code = Math.floor(100000 + Math.random() * 900000);

        let imageUrl = null;

        // IMAGE UPLOAD
        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "sellers");
                imageUrl = uploadResult.secure_url;
            } catch (error) {
            }
        }

        // Send email in background (non-blocking)
        sendEmail(
            email,
            "Seller Verification Code",
            `Your verification code is ${code}. Please do NOT share it with anyone.`
        ).catch(err => console.error("Seller Reg Email Error:", err));

        const seller = await Seller.create({
            name,
            email,
            phone,
            gender,
            password: hashpass,
            image: imageUrl,
            shopName,
            shopAddress,
            shopDescription,
            verifycode: code
        });

        return res.status(200).json({
            status: "success",
            data: seller
        });

    } catch (error) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};



const verifySellerLoginCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                status: "fail",
                message: "Email and verification code are required"
            });
        }

        const seller = await Seller.findOne({
            email: email,
            verifiedstatus: true,
            loginCode: parseInt(code),
            loginCodeExpiry: { $gt: new Date() }
        });

        if (!seller) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid or expired verification code"
            });
        }

        // Clear the login code
        seller.loginCode = null;
        seller.loginCodeExpiry = null;
        await seller.save();

        // Generate token
        const token = jwt.sign({ id: seller._id }, process.env.jwtkey, {
            expiresIn: process.env.jwtexp
        });

        return res.status(200).json({
            status: "success",
            message: "Login successful",
            data: seller,
            token: token,
            redirectTo: '/seller-admin'
        });

    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong during verification"
        });
    }
};

const verifySellerCode = async (req, res) => {
    try {
        const { code } = req.body;

        const seller = await Seller.findOne({ verifycode: code });

        if (!seller) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid code, please request again"
            });
        }

        seller.verifiedstatus = true;
        seller.verifycode = null;
        await seller.save();

        return res.status(200).json({
            status: "success",
            message: "Seller verified successfully"
        });

    } catch (error) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};



const loginSeller = async (req, res) => {
    try {
        const { email, password } = req.body;

        const seller = await Seller.findOne({ email: email, verifiedstatus: true });

        if (!seller) {
            return res.status(400).json({
                status: "fail",
                message: "Seller not registered"
            });
        }

        const passMatch = await bcrypt.compare(password, seller.password);

        if (!passMatch) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid Credentials"
            });
        }

        // Generate verification code for login
        const code = Math.floor(100000 + Math.random() * 900000);

        // Send email in background (non-blocking)
        sendEmail(
            email,
            "Login Verification Code",
            `Your login verification code is: ${code}. Please use this code to complete your login.`
        ).catch(err => console.error("Seller Login Email Error:", err));

        // Save verification code temporarily
        seller.loginCode = code;
        seller.loginCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
        await seller.save();

        return res.status(200).json({
            status: "success",
            message: "Verification code sent to your email",
            requiresVerification: true,
            email: email
        });

    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};


const verifySellerData = async (req, res) => {
    try {
        const id = req.id; 
        const seller = await Seller.findById(id);
        if (!seller || seller.verifiedstatus !== true || seller.active !== true) {
            return res.status(401).json({ status: "fail", message: "Unauthorized, please login again", data: null });
        }
        return res.status(200).json({ status: "success", data: seller });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "something went wrong", data: null });
    }
};

const getallSellerData = async (req, res) => {
    try {
      

        const seller = await Seller.find();

        return res.status(200).json({
            status: "success",
            data: seller
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};



const sellerForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const seller = await Seller.findOne({ email: email, verifiedstatus: true });

        if (!seller) {
            return res.status(400).json({
                status: "fail",
                message: "Seller not registered"
            });
        }

        const code = Math.floor(100000 + Math.random() * 900000);
        const expiry = Date.now() + 5 * 60 * 1000;

        // Send email in background (non-blocking)
        sendEmail(
            email,
            "Seller Forgot Password Code",
            `Your reset code is ${code}. Expiry time: 5 minutes.`
        ).catch(err => console.error("Seller Forgot Pass Email Error:", err));

        seller.forgotpasscode = code;
        seller.forgotpassexp = expiry;
        await seller.save();

        return res.status(200).json({
            status: "success",
            message: "Reset code sent",
            data: seller
        });

    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};


const sellerResetPassword = async (req, res) => {
    try {
        const { code, password, cpassword } = req.body;

        const seller = await Seller.findOne({
            forgotpasscode: code,
            forgotpassexp: { $gt: Date.now() }
        });

        if (!seller) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid or expired code"
            });
        }

        if (password !== cpassword) {
            return res.status(400).json({
                status: "fail",
                message: "Password and confirm password do not match"
            });
        }

        const hashpass = await bcrypt.hash(password, 8);

        seller.password = hashpass;
        seller.forgotpasscode = null;
        seller.forgotpassexp = null;

        await seller.save();

        return res.status(200).json({
            status: "success",
            message: "Password reset successful",
            data: seller
        });

    } catch (err) {


        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};

const updateSellerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;
        const seller = await Seller.findById(id);
        if (!seller) {
            return res.status(404).json({ status: "fail", message: "Seller not found" });
        }
        seller.active = active;
        await seller.save();
        return res.status(200).json({ status: "success", data: seller });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "Something went wrong" });
    }
};

const updateSellerProfile = async (req, res) => {
    try {
        const id = req.id;
        const { name, phone, gender, shopName, shopDescription, shopAddress } = req.body;
        let imageUrl;
        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "sellers");
                imageUrl = uploadResult.secure_url;
            } catch (err) {
                return res.status(400).json({ status: "fail", message: "Cloudinary upload failed" });
            }
        }
        const seller = await Seller.findById(id);
        if (!seller) {
            return res.status(404).json({ status: "fail", message: "Seller not found" });
        }
        if (name) seller.name = name;
        if (phone) seller.phone = phone;
        if (gender) seller.gender = gender;
        if (shopName) seller.shopName = shopName;
        if (shopDescription) seller.shopDescription = shopDescription;
        if (shopAddress) seller.shopAddress = shopAddress;
        if (imageUrl) seller.image = imageUrl;
        await seller.save();
        return res.status(200).json({ status: "success", data: seller });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "Something went wrong" });
    }
};

const changeSellerPassword = async (req, res) => {
    try {
        const id = req.id;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ status: 'fail', message: 'Current and new password required' });
        }
        const seller = await Seller.findById(id);
        if (!seller) {
            return res.status(404).json({ status: 'fail', message: 'Seller not found' });
        }
        const valid = await bcrypt.compare(currentPassword, seller.password);
        if (!valid) {
            return res.status(403).json({ status: 'fail', message: 'Current password incorrect' });
        }
        if (newPassword.length < 4) {
            return res.status(400).json({ status: 'fail', message: 'Password must be at least 4 characters' });
        }
        seller.password = await bcrypt.hash(newPassword, 8);
        await seller.save();
        return res.status(200).json({ status: 'success', message: 'Password changed' });
    } catch (err) {
        return res.status(500).json({ status: 'fail', message: 'Something went wrong' });
    }
};

// Get top performing sellers based on total items sold
const getTopPerformingSellers = async (req, res) => {
    try {
        // Aggregate order data to calculate total items sold by each seller
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Aggregate order data (limited to last 30 days for speed)
        const sellerSales = await Order.aggregate([
            {
                $match: {
                    status: { $in: ["delivered", "confirmed", "picked_up", "out_for_delivery"] },
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $unwind: "$items"
            },
            {
                $group: {
                    _id: "$items.sellerId",
                    totalItemsSold: { $sum: "$items.quantity" }
                }
            },
            {
                $sort: { totalItemsSold: -1 }
            },
            {
                $limit: 20 // Only need top 20 for ranking
            }
        ]);

        // Get top active sellers
        const allActiveSellers = await Seller.find({ active: true })
            .select('name shopName image active createdAt')
            .limit(20) // Limit to 20 sellers total for home page
            .lean();

        const sellersWithSalesMap = new Map();
        sellerSales.forEach(sale => {
            if (sale._id) sellersWithSalesMap.set(sale._id.toString(), sale.totalItemsSold);
        });

        const allSellers = allActiveSellers.map(seller => ({
            ...seller,
            totalItemsSold: sellersWithSalesMap.get(seller._id.toString()) || 0
        })).sort((a, b) => b.totalItemsSold - a.totalItemsSold);

        return res.status(200).json({
            status: "success",
            data: allSellers
        });

    } catch (error) {
        console.error("Error fetching top performing sellers:", error);
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};

export { CreateSeller, verifySellerCode, loginSeller, verifySellerLoginCode, verifySellerData, sellerForgotPassword, sellerResetPassword, getallSellerData, updateSellerStatus, updateSellerProfile, changeSellerPassword, getTopPerformingSellers };
