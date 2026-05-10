import mongoose from "mongoose";
import Wallet from "../Models/WalletSchema.js";
import UserCoupon from "../Models/UserCouponSchema.js";
import User from "../Models/UserSchema.js";
import DelayedPointsAward from "../Models/DelayedPointsAwardSchema.js";

// Points system constants
const POINTS_PER_5000_SPENT = 10; // 10 points per PKR 5000 spent

// Coupon generation thresholds (points required)
const COUPON_THRESHOLDS = {
    10: { discount: 400, description: 'PKR 400 off on orders above PKR 2000' },
    20: { discount: 800, description: 'PKR 800 off on orders above PKR 3000' },
    30: { discount: 1200, description: 'PKR 1200 off on orders above PKR 4000' },
    50: { discount: 2000, description: 'PKR 2000 off on orders above PKR 5000' }
};

// Get user's wallet
const getUserWallet = async (req, res) => {
    try {
        const userId = req.id;

        let wallet = await Wallet.findOne({ user: userId }).populate('transactions.orderId', 'orderId total');

        if (!wallet) {
            wallet = await Wallet.create({ user: userId });
        }

        // Calculate current balance (earned + bonus - spent - refunded back as credit)
        const balance = wallet.transactions.reduce((acc, transaction) => {
            switch (transaction.type) {
                case 'earned':
                case 'bonus':
                    return acc + transaction.amount;
                case 'spent':
                    return acc - transaction.amount;
                case 'refund':
                    return acc + transaction.amount; // Refunds add to balance
                default:
                    return acc;
            }
        }, 0);

        // Get upcoming points information from delayed awards
        const delayedAwards = await DelayedPointsAward.find({
            userId: userId,
            status: 'PENDING'
        });

        // Also check for recent delivered orders that might need points awarded
        const Order = (await import('../Models/OrderSchema.js')).default;
        const recentDeliveredOrders = await Order.find({
            userId: userId,
            status: { $in: ['delivered', 'confirmed', 'ready_for_pickup', 'picked_up', 'out_for_delivery'] },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }).sort({ createdAt: -1 });

        // Check which recent orders don't have points awarded yet
        const ordersWithoutPoints = [];
        for (const order of recentDeliveredOrders) {
            const hasDelayedAward = delayedAwards.some(award => award.orderId.toString() === order._id.toString());
            const hasEarnedTransaction = wallet.transactions.some(tx =>
                tx.orderId && tx.orderId.toString() === order._id.toString() && tx.type === 'earned'
            );

            if (!hasDelayedAward && !hasEarnedTransaction) {
                const orderAge = (new Date() - new Date(order.createdAt)) / (1000 * 60 * 60); // hours
                const pointsToEarn = Math.floor(order.total / 5000) * 10;

                        if (pointsToEarn > 0) {
                    if (orderAge < 1) {
                        // Order is less than 1 hour old - still in refund window
                        ordersWithoutPoints.push({
                            orderId: order._id,
                            orderNumber: order._id.toString().slice(-8).toUpperCase(),
                            orderAmount: order.total,
                            pointsToEarn: pointsToEarn,
                            status: 'refund_window_active',
                            hoursRemaining: Math.max(0, Math.ceil(1 - orderAge)),
                            message: `Points will be awarded in ${Math.max(0, Math.ceil(1 - orderAge))} hour(s) after refund window expires.`
                        });
                    } else {
                        // Order is 1+ hours old - refund window has expired, award points immediately

                        try {
                            // Award points immediately since refund window has expired
                            await addPointsToWallet(userId, order.total, order._id, true);

                            // Add to awarded points (will show as active now)
                            // Note: This order won't appear in pending list anymore since points are awarded

                        } catch (awardError) {
                            console.error(`Failed to award points for order ${order._id}:`, awardError);
                            // Keep in pending list if award failed
                            ordersWithoutPoints.push({
                                orderId: order._id,
                                orderNumber: order._id.toString().slice(-8).toUpperCase(),
                                orderAmount: order.total,
                                pointsToEarn: pointsToEarn,
                                status: 'award_failed',
                                message: `Failed to award ${pointsToEarn} points. Please contact support.`
                            });
                        }
                    }
                }
            }
        }

        // Combine delayed awards and orders without points
        const allUpcomingPoints = [
            ...delayedAwards.map(award => ({
                points: award.pointsToAward,
                orderId: award.orderId,
                type: 'delayed_award',
                awardTime: award.awardTime,
                hoursRemaining: Math.max(0, Math.ceil((new Date(award.awardTime) - new Date()) / (1000 * 60 * 60))),
                message: `${award.pointsToAward} points will be awarded in ${Math.max(0, Math.ceil((new Date(award.awardTime) - new Date()) / (1000 * 60 * 60)))} hour(s) after refund window expires.`
            })),
            ...ordersWithoutPoints.map(order => ({
                points: order.pointsToEarn,
                orderId: order.orderId,
                type: order.status === 'refund_window_active' ? 'refund_window' : 'processing',
                hoursRemaining: order.hoursRemaining || 0,
                message: order.message
            }))
        ];

        const upcomingPointsInfo = allUpcomingPoints.length > 0 ? {
            hasUpcomingPoints: true,
            totalPoints: allUpcomingPoints.reduce((sum, award) => sum + award.points, 0),
            nextAwardIn: Math.min(...allUpcomingPoints.map(award => award.hoursRemaining || 0)),
            pendingOrders: ordersWithoutPoints.length,
            delayedAwards: delayedAwards.length,
            message: `You have ${allUpcomingPoints.reduce((sum, award) => sum + award.points, 0)} points that will be awarded after the refund window.`,
            details: allUpcomingPoints
        } : {
            hasUpcomingPoints: false,
            message: "All your points are ready to use!"
        };


        return res.status(200).json({
            status: "success",
            data: {
                ...wallet.toObject(),
                balance: balance,
                upcomingPoints: upcomingPointsInfo
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};

// Add points to wallet (called after successful order or after delay)
const addPointsToWallet = async (userId, orderAmount, orderId, forceActive = false) => {
    try {
        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            wallet = new Wallet({ user: userId });
        }

        // Calculate points earned (10 points per PKR 5000)
        const pointsEarned = Math.floor(orderAmount / 5000) * POINTS_PER_5000_SPENT;

        if (pointsEarned > 0) {
            // Set refund window expiry (7 days from now)
            const refundWindowExpiry = new Date();
            refundWindowExpiry.setDate(refundWindowExpiry.getDate() + 7);

            // Add transaction
            wallet.transactions.push({
                type: 'earned',
                points: pointsEarned,
                amount: orderAmount,
                description: `Points earned from order #${orderId}`,
                orderId: orderId,
                status: forceActive ? 'ACTIVE' : 'PENDING',
                refundWindowExpiry: refundWindowExpiry
            });

            // Update totals
            wallet.totalPoints += pointsEarned;
            wallet.totalSpent += orderAmount;

            await wallet.save();

            // Note: Coupon generation is disabled for PENDING points
            // await checkAndGenerateCoupon(wallet, userId);
        } else {
        }

        return wallet;
    } catch (err) {
        throw err;
    }
};

// Check and generate coupon based on points threshold (only ACTIVE points)
const checkAndGenerateCoupon = async (wallet, userId) => {
    try {
        // Calculate current ACTIVE points (exclude PENDING and CANCELLED)
        const activePoints = wallet.transactions
            .filter(transaction => transaction.status === 'ACTIVE')
            .reduce((total, transaction) => total + transaction.points, 0);

        let lastGeneratedPoints = wallet.lastCouponGenerated?.points || 0;


        // Generate coupons for all eligible thresholds
        let generatedAny = false;
        for (const [threshold, couponData] of Object.entries(COUPON_THRESHOLDS)) {
            const thresholdPoints = parseInt(threshold);


            if (activePoints >= thresholdPoints && lastGeneratedPoints < thresholdPoints) {

                // Generate coupon
                const expirationDate = new Date();
                expirationDate.setMonth(expirationDate.getMonth() + 3); // 3 months validity

                await UserCoupon.create({
                    user: userId,
                    discountType: 'fixed',
                    discountValue: couponData.discount,
                    minOrderAmount: couponData.discount * 5, // Min order is 5x the discount
                    maxDiscount: couponData.discount,
                    description: couponData.description,
                    generatedFrom: `points_${threshold}`,
                    pointsUsed: thresholdPoints,
                    expiresAt: expirationDate
                });

                // Update wallet's last coupon generation
                wallet.lastCouponGenerated = {
                    points: thresholdPoints,
                    generatedAt: new Date()
                };

                await wallet.save();

                // Update lastGeneratedPoints for next iteration
                lastGeneratedPoints = thresholdPoints;
                generatedAny = true;

            }
        }

        if (!generatedAny) {
        }

    } catch (err) {
        // Don't throw error, just log it
    }
};

// Get user's coupons
const getUserCoupons = async (req, res) => {
    try {
        const userId = req.id;


        const coupons = await UserCoupon.find({
            user: userId,
            isActive: true,
            isUsed: false  // Only show unused coupons
        }).sort({ createdAt: -1 });


        return res.status(200).json({
            status: "success",
            data: coupons
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};

// Validate coupon for user
const validateUserCoupon = async (req, res) => {
    try {
        const userId = req.id;
        const { code, orderAmount } = req.body;



        if (!code) {
            return res.status(400).json({
                status: "fail",
                message: "Coupon code is required"
            });
        }


        // DEBUG: First check if this coupon exists at all
        const anyCouponWithCode = await UserCoupon.findOne({ code: code.toUpperCase() });
        if (anyCouponWithCode) {

        } else {

        }

        // First check if this user already used this coupon (prevent reuse)
        let alreadyUsedByUser = await UserCoupon.findOne({
            code: code.toUpperCase(),
            user: userId,
            isUsed: true
        });

        // If not found, try with ObjectId conversion
        if (!alreadyUsedByUser) {
            const mongoose = (await import('mongoose')).default;
            const objectIdUserId = mongoose.Types.ObjectId.isValid(userId) ? userId : null;

            if (objectIdUserId) {
                alreadyUsedByUser = await UserCoupon.findOne({
                    code: code.toUpperCase(),
                    user: objectIdUserId,
                    isUsed: true
                });
            }
        }



        if (alreadyUsedByUser) {

        }

        if (alreadyUsedByUser) {


            return res.status(400).json({
                status: "fail",
                message: "You have already used this coupon"
            });
        } else {

        }

        // ADDITIONAL SAFETY CHECK: If this coupon exists for this user and is used, block it
        const anyUserCouponForThisUser = await UserCoupon.findOne({
            code: code.toUpperCase(),
            user: userId
        });

        if (anyUserCouponForThisUser && anyUserCouponForThisUser.isUsed) {

            return res.status(400).json({
                status: "fail",
                message: "You have already used this coupon"
            });
        }

        // First try to find user-specific coupon that is available

        let coupon = await UserCoupon.findOne({
            code: code.toUpperCase(),
            user: userId,
            isUsed: false,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });

        // If not found, try with ObjectId conversion (in case of type mismatch)
        if (!coupon) {

            const mongoose = (await import('mongoose')).default;
            const objectIdUserId = mongoose.Types.ObjectId.isValid(userId) ? userId : null;

            if (objectIdUserId) {
                coupon = await UserCoupon.findOne({
                    code: code.toUpperCase(),
                    user: objectIdUserId,
                    isUsed: false,
                    isActive: true,
                    expiresAt: { $gt: new Date() }
                });
            }
        }

        if (coupon) {

        } else {

        }


        // If not found as user-specific, try to find admin/global coupons from Coupon collection
        if (!coupon) {

            coupon = await Coupon.findOne({
                code: code.toUpperCase(),
                isActive: true,
                $or: [
                    { endDate: { $exists: false } },
                    { endDate: { $gt: new Date() } }
                ]
            });

            if (coupon) {

                // Check if this user has already used this admin coupon
                const userRedemptions = coupon.redemptions?.filter(r => r.userId && r.userId.toString() === userId.toString()) || [];
                const maxUsage = coupon.usagePerUser || 1;



                if (userRedemptions.length >= maxUsage) {

                    return res.status(400).json({
                        status: "fail",
                        message: "You have already used this coupon"
                    });
                }

                coupon = {
                    ...coupon.toObject(),
                    generatedFrom: 'admin',
                    redemptions: coupon.redemptions || [],
                    usagePerUser: coupon.usagePerUser || 1
                };
            } else {

            }
        }

        // Debug: Try to find the coupon regardless of other conditions
        if (!coupon) {
            const anyCoupon = await UserCoupon.findOne({ code: code.toUpperCase() });
            if (anyCoupon) {
                // Coupon exists but validation failed above
            }
        }

        if (!coupon) {
            return res.status(404).json({
                status: "fail",
                message: "Invalid or expired coupon code"
            });
        }

        // Check minimum order amount
        if (orderAmount < coupon.minOrderAmount) {
            return res.status(400).json({
                status: "fail",
                message: `Minimum order amount is PKR ${coupon.minOrderAmount}. Your order total is PKR ${orderAmount}.`
            });
        }

        // Calculate discount (ensure it doesn't exceed order amount)
        let discount = coupon.discountValue;
        if (coupon.discountType === 'percentage') {
            discount = (orderAmount * coupon.discountValue) / 100;
            if (coupon.maxDiscount) {
                discount = Math.min(discount, coupon.maxDiscount);
            }
        }
        discount = Math.min(discount, orderAmount); // Don't exceed order total


        return res.status(200).json({
            status: "success",
            data: {
                coupon,
                discount: discount
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};

// Use coupon (called during checkout) - handles both user and admin coupons
const useUserCoupon = async (userId, code, orderId) => {
    try {


        // First check if user already used this coupon
        const alreadyUsed = await UserCoupon.findOne({
            code: code.toUpperCase(),
            user: userId,
            isUsed: true
        });

        if (alreadyUsed) {

        }

        if (alreadyUsed) {

            throw new Error('You have already used this coupon');
        }

        // Find the coupon to use
        let couponToUse = await UserCoupon.findOne({
            code: code.toUpperCase(),
            user: userId,
            isUsed: false,
            isActive: true
        });

        // If not found, try with ObjectId conversion
        if (!couponToUse) {
            const mongoose = (await import('mongoose')).default;
            const objectIdUserId = mongoose.Types.ObjectId.isValid(userId) ? userId : null;

            if (objectIdUserId) {
                couponToUse = await UserCoupon.findOne({
                    code: code.toUpperCase(),
                    user: objectIdUserId,
                    isUsed: false,
                    isActive: true
                });
            }
        }

        if (!couponToUse) {

            throw new Error('Coupon not found or already used');
        }




        // First try to find and use a user-specific coupon (including user-generated ones)


        let coupon = await UserCoupon.findOneAndUpdate(
            {
                code: code.toUpperCase(),
                user: userId,
                isUsed: false,
                isActive: true
            },
            {
                isUsed: true,
                usedAt: new Date(),
                usedOrderId: orderId
            },
            { new: true }
        );

        // If not updated, try with ObjectId conversion
        if (!coupon) {
            const mongoose = (await import('mongoose')).default;
            const objectIdUserId = mongoose.Types.ObjectId.isValid(userId) ? userId : null;

            if (objectIdUserId) {
                coupon = await UserCoupon.findOneAndUpdate(
                    {
                        code: code.toUpperCase(),
                        user: objectIdUserId,
                        isUsed: false,
                        isActive: true
                    },
                    {
                        isUsed: true,
                        usedAt: new Date(),
                        usedOrderId: orderId
                    },
                    { new: true }
                );
            }
        }

        if (coupon) {


            // DOUBLE-CHECK: Verify the coupon was actually saved
            const verifyCoupon = await UserCoupon.findById(coupon._id);
            if (verifyCoupon && verifyCoupon.isUsed) {

            } else {

            }

            return coupon;
        }



        // If no user coupon found, try admin/global coupon from Coupon collection
        const adminCoupon = await Coupon.findOne({
            code: code.toUpperCase(),
            isActive: true
        });

        // Check if user has already used this admin coupon
        if (adminCoupon) {

            const userRedemptions = adminCoupon.redemptions?.filter(r => r.userId && r.userId.toString() === userId.toString()) || [];
            const maxUsage = adminCoupon.usagePerUser || 1;



            if (userRedemptions.length >= maxUsage) {

                throw new Error('You have already used this coupon');
            }

            // Mark as used by this user

            const updatedAdminCoupon = await Coupon.findOneAndUpdate(
                { _id: adminCoupon._id },
                {
                    $inc: { usageCount: 1 },
                    $push: {
                        redemptions: {
                            userId: userId,
                            orderId: orderId,
                            redeemedAt: new Date()
                        }
                    }
                },
                { new: true }
            );


            return updatedAdminCoupon;
        }

        throw new Error('Coupon not found or already used');

    } catch (err) {
        throw err;
    }
};

// User: Generate coupon by spending points
const generateCouponWithPoints = async (req, res) => {
    try {
        const userId = req.id;
        const { pointsToSpend } = req.body;

        if (!pointsToSpend || pointsToSpend < 10) {
            return res.status(400).json({
                status: "fail",
                message: "Minimum 10 points required to generate a coupon"
            });
        }

        // Find user's wallet
        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.status(404).json({
                status: "fail",
                message: "Wallet not found"
            });
        }

        // First, try to activate any expired pending points and process delayed awards
        try {

            await activateAllExpiredPendingPoints(userId);


            // Also process any delayed points awards that are due
            await processDelayedPointsAwards();


            // Reload wallet after activation
            wallet = await Wallet.findOne({ user: userId });

        } catch (activationError) {


            // Continue anyway - don't fail the request
        }

        // Calculate ACTIVE points (exclude PENDING and CANCELLED)
        const activePoints = wallet.transactions
            .filter(transaction => {
                // Include transactions that are explicitly ACTIVE or have no status (default ACTIVE)
                return transaction.status === 'ACTIVE' ||
                       (!transaction.status && transaction.points > 0) ||
                       (transaction.status !== 'PENDING' && transaction.status !== 'CANCELLED');
            })
            .reduce((total, transaction) => total + transaction.points, 0);

        const pendingPoints = wallet.transactions
            .filter(transaction => transaction.status === 'PENDING')
            .reduce((total, transaction) => total + transaction.points, 0);







        // Debug: Show all transaction statuses
        const statusCounts = wallet.transactions.reduce((acc, t) => {
            const status = t.status || 'NO_STATUS';
            acc[status] = (acc[status] || 0) + t.points;
            return acc;
        }, {});


        // Check if user has enough ACTIVE points
        if (activePoints < pointsToSpend) {


            // LAST RESORT: If user has total points but no active points, activate all pending points
            if (wallet.totalPoints >= pointsToSpend && activePoints === 0 && pendingPoints > 0) {

                wallet.transactions.forEach(transaction => {
                    if (transaction.status === 'PENDING') {
                        transaction.status = 'ACTIVE';

                    }
                });

                await wallet.save();


                // Recalculate active points
                const newActivePoints = wallet.transactions
                    .filter(transaction => transaction.status === 'ACTIVE' ||
                           (!transaction.status && transaction.points > 0) ||
                           (transaction.status !== 'PENDING' && transaction.status !== 'CANCELLED'))
                    .reduce((total, transaction) => total + transaction.points, 0);



                if (newActivePoints >= pointsToSpend) {

                    // Continue with coupon generation
                } else {
                    return res.status(400).json({
                        status: "fail",
                        message: `Still insufficient points after activation. You have ${newActivePoints} active points but need ${pointsToSpend}.`
                    });
                }
            } else {
                return res.status(400).json({
                    status: "fail",
                    message: `Insufficient ACTIVE points. You have ${activePoints} active points but need ${pointsToSpend}. Points may still be pending from recent orders.`
                });
            }
        }



        // Check if user has already generated an UNUSED user-generated coupon
        const existingUnusedCoupons = await UserCoupon.countDocuments({
            user: userId,
            generatedFrom: 'user_generated',
            isUsed: false
        });
        
        const existingUsedCoupons = await UserCoupon.countDocuments({
            user: userId,
            generatedFrom: 'user_generated',
            isUsed: true
        });

        if (existingUnusedCoupons > 0) {

            return res.status(400).json({
                status: "fail",
                message: "You already have an active point-generated coupon. Please use it before generating a new one."
            });
        }
        
        if (existingUsedCoupons > 0) {
            // If you want a STRICT 1-coupon-per-lifetime limit, uncomment this block
            /*
            return res.status(400).json({
                status: "fail",
                message: "You have already reached the limit of one point-generated coupon per account."
            });
            */
        }

        // Validate points amount (must be exactly 10 points for PKR 400 coupon)
        if (pointsToSpend !== 10) {
            return res.status(400).json({
                status: "fail",
                message: "You must spend exactly 10 points to generate a PKR 400 coupon"
            });
        }

        // Fixed coupon value: PKR 400 for 10 points
        const couponValue = 400; // Fixed PKR 400 coupon
        const minOrderAmount = 500; // Minimum order PKR 500


        // Generate unique coupon code manually (since pre-save hook might not work reliably)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let couponCode;
        let isUnique = false;
        let attempts = 0;

        do {
            couponCode = '';
            for (let i = 0; i < 8; i++) {
                couponCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            // Check if code already exists
            const existing = await UserCoupon.findOne({ code: couponCode });
            isUnique = !existing;
            attempts++;

            // Safety check to prevent infinite loop
            if (attempts > 10) {
                couponCode = `C${Date.now().toString().slice(-7)}`;
                break;
            }
        } while (!isUnique);

        // Create coupon with manually generated code
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + 1); // 1 month validity

        const coupon = await UserCoupon.create({
            user: userId,
            code: couponCode,
            discountType: 'fixed',
            discountValue: couponValue,
            minOrderAmount: minOrderAmount,
            maxDiscount: couponValue,
            description: `PKR ${couponValue} off on orders above PKR ${minOrderAmount} (Generated with ${pointsToSpend} points)`,
            generatedFrom: 'user_generated',
            pointsUsed: pointsToSpend,
            expiresAt: expirationDate,
            isActive: true,
            isUsed: false
        });

        // Deduct points from wallet total (this maintains consistency with existing logic)
        wallet.totalPoints -= pointsToSpend;

        // Add transaction record
        wallet.transactions.push({
            type: 'spent',
            points: -pointsToSpend,
            amount: 0,
            description: `Points spent to generate PKR ${couponValue} coupon`,
            orderId: null
        });

        await wallet.save();

        res.status(200).json({
            status: "success",
            message: `Successfully generated PKR ${couponValue} coupon using ${pointsToSpend} points!`,
            data: {
                coupon: coupon,
                pointsSpent: pointsToSpend,
                pointsRemaining: activePoints - pointsToSpend,
                couponValue: couponValue,
                couponCode: coupon.code,
                expiresAt: expirationDate
            }
        });

    } catch (error) {
        console.error('Error generating coupon with points:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to generate coupon",
            error: error.message
        });
    }
};

// ADMIN FUNCTIONS

// Get all wallets for admin
const getAllWallets = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const wallets = await Wallet.find()
            .populate('user', 'name email')
            .sort({ totalPoints: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const total = await Wallet.countDocuments();

        return res.status(200).json({
            status: "success",
            data: wallets,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalWallets: total
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};

// Get all user coupons for admin
const getAllUserCoupons = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status; // used, unused, expired

        let query = {};

        if (status === 'used') {
            query.isUsed = true;
        } else if (status === 'unused') {
            query.isUsed = false;
            query.expiresAt = { $gt: new Date() };
        } else if (status === 'expired') {
            query.isUsed = false;
            query.expiresAt = { $lt: new Date() };
        }

        const coupons = await UserCoupon.find(query)
            .populate('user', 'name email')
            .populate('usedOrderId', 'orderId totalAmount')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const total = await UserCoupon.countDocuments(query);

        return res.status(200).json({
            status: "success",
            data: coupons,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalCoupons: total
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};

// Admin: Add bonus points to user
const addBonusPoints = async (req, res) => {
    try {
        const { userId, points, description } = req.body;

        if (!userId || !points || points <= 0) {
            return res.status(400).json({
                status: "fail",
                message: "User ID and positive points amount are required"
            });
        }

        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            wallet = new Wallet({ user: userId });
        }

        wallet.transactions.push({
            type: 'bonus',
            points: points,
            description: description || 'Bonus points from admin',
            createdAt: new Date()
        });

        wallet.totalPoints += points;
        await wallet.save();

        // Check if coupon should be generated
        await checkAndGenerateCoupon(wallet, userId);

        return res.status(200).json({
            status: "success",
            data: wallet
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};

// Process refund for order
const processRefund = async (userId, orderId, refundAmount, reason = 'Order refund') => {
    try {
        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            wallet = new Wallet({ user: userId });
        }

        // Add refund transaction
        wallet.transactions.push({
            type: 'refund',
            points: 0, // Refunds don't affect points
            amount: refundAmount,
            description: reason,
            orderId: orderId // This can be string, schema allows ObjectId but not required
        });

        await wallet.save();
        return wallet;
    } catch (error) {
        console.error('Error processing refund:', error);
        throw error;
    }
};

// Activate points after refund window expires
const activatePendingPoints = async (userId, orderId) => {
    try {

        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            return null;
        }

        // Find and update PENDING transactions for this order that have expired refund window
        const now = new Date();
        let pointsActivated = 0;

        wallet.transactions.forEach(transaction => {
            if (transaction.orderId &&
                transaction.orderId.toString() === orderId.toString() &&
                transaction.status === 'PENDING' &&
                transaction.refundWindowExpiry &&
                transaction.refundWindowExpiry <= now) {

                transaction.status = 'ACTIVE';
                pointsActivated += transaction.points;
            }
        });

        if (pointsActivated > 0) {
            await wallet.save();

            // Now check if coupons should be generated with the newly activated points
            await checkAndGenerateCoupon(wallet, userId);
        } else {
        }

        return wallet;
    } catch (error) {
        console.error('Error activating pending points:', error);
        throw error;
    }
};

// Activate ALL expired pending points for a specific user
const activateAllExpiredPendingPoints = async (userId) => {
    try {

        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {

            return null;
        }




        // Find and update ALL PENDING transactions that have expired refund window
        const now = new Date();
        let pointsActivated = 0;
        let pendingCount = 0;

        wallet.transactions.forEach(transaction => {
            if (transaction.status === 'PENDING') {
                pendingCount++;


                if (transaction.refundWindowExpiry && transaction.refundWindowExpiry <= now) {

                    transaction.status = 'ACTIVE';
                    pointsActivated += transaction.points;
                } else if (!transaction.refundWindowExpiry) {
                    // If no refund window expiry, assume it's from old data and should be active

                    transaction.status = 'ACTIVE';
                    pointsActivated += transaction.points;
                } else {
                    // Check if transaction is very old (>7 days) even if refund window not expired
                    const transactionAge = (now - new Date(transaction.createdAt)) / (1000 * 60 * 60 * 24); // days
                    if (transactionAge > 7) {

                        transaction.status = 'ACTIVE';
                        pointsActivated += transaction.points;
                    } else {

                    }
                }
            }
        });




        if (pointsActivated > 0) {

            await wallet.save();


            // Now check if coupons should be generated with the newly activated points
            await checkAndGenerateCoupon(wallet, userId);

        } else {

        }

        return wallet;
    } catch (error) {
        console.error('❌ Error activating all expired pending points:', error);
        throw error;
    }
};

// Cancel points when refund occurs
const cancelPendingPoints = async (userId, orderId, reason = 'Order refunded') => {
    try {

        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            return null;
        }

        // Find and cancel PENDING transactions for this order
        let pointsCancelled = 0;

        wallet.transactions.forEach(transaction => {
            if (transaction.orderId &&
                transaction.orderId.toString() === orderId.toString() &&
                transaction.status === 'PENDING') {

                transaction.status = 'CANCELLED';
                pointsCancelled += transaction.points;
                transaction.description += ` - ${reason}`;
            }
        });

        if (pointsCancelled > 0) {
            // Deduct cancelled points from total
            wallet.totalPoints -= pointsCancelled;
            await wallet.save();
        } else {
        }

        return wallet;
    } catch (error) {
        console.error('Error cancelling pending points:', error);
        throw error;
    }
};

// Process expired refund windows for all users (can be called by a scheduled job)
const processExpiredRefundWindows = async () => {
    try {

        const now = new Date();

        // Find all wallets with PENDING transactions that have expired refund windows
        const wallets = await Wallet.find({
            'transactions.status': 'PENDING',
            'transactions.refundWindowExpiry': { $lte: now }
        });


        let totalPointsActivated = 0;

        for (const wallet of wallets) {
            let walletPointsActivated = 0;

            wallet.transactions.forEach(transaction => {
                if (transaction.status === 'PENDING' &&
                    transaction.refundWindowExpiry &&
                    transaction.refundWindowExpiry <= now) {

                    transaction.status = 'ACTIVE';
                    walletPointsActivated += transaction.points;
                }
            });

            if (walletPointsActivated > 0) {
                await wallet.save();
                totalPointsActivated += walletPointsActivated;

                // Check if coupons should be generated
                await checkAndGenerateCoupon(wallet, wallet.user);

            }
        }

        return { totalPointsActivated, walletsProcessed: wallets.length };

    } catch (error) {
        console.error('Error processing expired refund windows:', error);
        throw error;
    }
};

// Schedule delayed points award after 1 hour refund window
const scheduleDelayedPointsAward = async (userId, orderId, orderAmount) => {
    try {

        // Calculate points to be awarded
        const pointsToAward = Math.floor(orderAmount / 5000) * POINTS_PER_5000_SPENT;

        if (pointsToAward <= 0) {
            return null;
        }

        // Create delayed award record
        const delayedAward = await DelayedPointsAward.create({
            userId,
            orderId,
            orderAmount,
            pointsToAward,
            awardTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            refundWindowExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        });

        return delayedAward;

    } catch (error) {
        console.error('Error scheduling delayed points award:', error);
        throw error;
    }
};

// Process delayed points awards (can be called by a scheduled job every few minutes)
const processDelayedPointsAwards = async () => {
    try {

        const now = new Date();

        // Find all PENDING delayed awards that are due
        const dueAwards = await DelayedPointsAward.find({
            status: 'PENDING',
            awardTime: { $lte: now }
        });


        let totalPointsAwarded = 0;

        for (const award of dueAwards) {
            try {
                // Check if order still exists and is not refunded
                const Order = (await import('../Models/OrderSchema.js')).default;
                const order = await Order.findById(award.orderId);

                if (!order) {
                    await DelayedPointsAward.findByIdAndUpdate(award._id, { status: 'CANCELLED' });
                    continue;
                }

                if (order.status === 'refunded' || order.status === 'cancelled_by_seller') {
                    await DelayedPointsAward.findByIdAndUpdate(award._id, { status: 'CANCELLED' });
                    continue;
                }

                // Check if refund window has actually expired (1 hour from order creation)
                const orderAge = (new Date() - new Date(order.createdAt)) / (1000 * 60 * 60);
                if (orderAge < 1) {
                    continue;
                }

                // Award points as ACTIVE status immediately after the 1-hour window
                const wallet = await addPointsToWallet(award.userId, award.orderAmount, award.orderId, true);

                if (wallet) {
                    // Mark delayed award as completed
                    await DelayedPointsAward.findByIdAndUpdate(award._id, { status: 'AWARDED' });
                    totalPointsAwarded += award.pointsToAward;

                }

            } catch (awardError) {
                console.error(`Error processing delayed award ${award._id}:`, awardError);
                // Continue with other awards
            }
        }

        return { totalPointsAwarded, awardsProcessed: dueAwards.length };

    } catch (error) {
        console.error('Error processing delayed points awards:', error);
        throw error;
    }
};

// Cancel delayed points award when refund occurs
const cancelDelayedPointsAward = async (orderId) => {
    try {

        const result = await DelayedPointsAward.findOneAndUpdate(
            { orderId: orderId, status: 'PENDING' },
            { status: 'CANCELLED' },
            { new: true }
        );

        if (result) {
        } else {
        }

        return result;

    } catch (error) {
        console.error('Error cancelling delayed points award:', error);
        throw error;
    }
};

// Test coupon generation (for debugging)
const testGenerateCoupon = async (req, res) => {
    try {
        const userId = req.id;


        // Generate test coupon
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let couponCode;
        let isUnique = false;
        let attempts = 0;

        do {
            couponCode = '';
            for (let i = 0; i < 8; i++) {
                couponCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            // Check if code already exists
            const existing = await UserCoupon.findOne({ code: couponCode });
            isUnique = !existing;
            attempts++;

            if (attempts > 10) {
                couponCode = `TEST${Date.now().toString().slice(-4)}`;
                break;
            }
        } while (!isUnique);

        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7); // 7 days for testing

        const coupon = await UserCoupon.create({
            user: userId,
            code: couponCode,
            discountType: 'fixed',
            discountValue: 100, // Test PKR 100 coupon
            minOrderAmount: 200, // Test min order PKR 200
            maxDiscount: 100,
            description: 'Test coupon - PKR 100 off on orders above PKR 200',
            generatedFrom: 'admin',
            pointsUsed: 0,
            expiresAt: expirationDate,
            isActive: true,
            isUsed: false
        });


        res.status(200).json({
            status: "success",
            message: "Test coupon generated successfully",
            data: {
                couponCode: coupon.code,
                discountValue: 100,
                minOrderAmount: 200,
                expiresAt: expirationDate
            }
        });

    } catch (error) {
        console.error('Error in test coupon generation:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to generate test coupon",
            error: error.message
        });
    }
};

// Admin: Process points for existing delivered orders that don't have points yet
const processPointsForExistingOrders = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                status: "fail",
                message: "User ID is required"
            });
        }


        // Get user's wallet
        const wallet = await Wallet.findOne({ user: userId });

        // Get recent delivered orders
        const Order = (await import('../Models/OrderSchema.js')).default;
        const recentDeliveredOrders = await Order.find({
            userId: userId,
            status: { $in: ['delivered', 'confirmed', 'ready_for_pickup', 'picked_up', 'out_for_delivery'] },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }).sort({ createdAt: -1 });

        let totalPointsAwarded = 0;
        const processedOrders = [];

        for (const order of recentDeliveredOrders) {
            // Check if order already has points
            const hasDelayedAward = await DelayedPointsAward.findOne({
                userId: userId,
                orderId: order._id,
                status: { $ne: 'CANCELLED' }
            });

            const hasEarnedTransaction = wallet && wallet.transactions.some(tx =>
                tx.orderId && tx.orderId.toString() === order._id.toString() && tx.type === 'earned'
            );

            if (!hasDelayedAward && !hasEarnedTransaction) {
                const orderAge = (new Date() - new Date(order.createdAt)) / (1000 * 60 * 60); // hours
                const pointsToEarn = Math.floor(order.total / 5000) * 10;

                if (pointsToEarn > 0) {
                    if (orderAge >= 1) {
                        // Order is 1+ hours old, award points now
                        await addPointsToWallet(userId, order.total, order._id, true);
                        totalPointsAwarded += pointsToEarn;
                        processedOrders.push({
                            orderId: order._id,
                            orderNumber: order._id.toString().slice(-8).toUpperCase(),
                            pointsAwarded: pointsToEarn
                        });
                    } else {
                        // Order is still within 1 hour, create delayed award
                        await scheduleDelayedPointsAward(userId, order._id, order.total);
                        processedOrders.push({
                            orderId: order._id,
                            orderNumber: order._id.toString().slice(-8).toUpperCase(),
                            status: 'delayed_award_created',
                            pointsScheduled: pointsToEarn
                        });
                    }
                }
            }
        }

        res.status(200).json({
            status: "success",
            message: `Processed points for existing orders. Total points awarded: ${totalPointsAwarded}`,
            data: {
                totalPointsAwarded,
                ordersProcessed: processedOrders.length,
                processedOrders
            }
        });

    } catch (error) {
        console.error('Error processing points for existing orders:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to process points for existing orders",
            error: error.message
        });
    }
};

// Admin: Manually generate coupons for user based on their current points
const regenerateUserCoupons = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                status: "fail",
                message: "User ID is required"
            });
        }

        // Find the user's wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.status(404).json({
                status: "fail",
                message: "Wallet not found for this user"
            });
        }


        // Temporarily reset lastCouponGenerated to force regeneration of all eligible coupons
        const originalLastGenerated = wallet.lastCouponGenerated;
        wallet.lastCouponGenerated = { points: 0 };
        await wallet.save();

        // Generate all eligible coupons
        await checkAndGenerateCoupon(wallet, userId);

        // Reload wallet to get updated data
        wallet = await Wallet.findOne({ user: userId });

        // Get user's coupons to show what was generated
        const userCoupons = await UserCoupon.find({
            user: userId,
            generatedFrom: { $regex: '^points_' },
            isActive: true
        }).sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            message: "Coupons regenerated successfully",
            data: {
                wallet: wallet,
                couponsGenerated: userCoupons.length,
                coupons: userCoupons,
                previousLastGenerated: originalLastGenerated
            }
        });

    } catch (error) {
        console.error('Error regenerating coupons:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to regenerate coupons",
            error: error.message
        });
    }
};

// Fix existing user-generated coupon
const fixUserCoupon = async (req, res) => {
    try {
        const userId = req.id;
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                status: "fail",
                message: "Coupon code is required"
            });
        }


        // Find the coupon
        const coupon = await UserCoupon.findOne({
            code: code.toUpperCase()
        });

        if (!coupon) {
            return res.status(404).json({
                status: "fail",
                message: "Coupon not found"
            });
        }

        // Check if it belongs to the user
        if (coupon.user.toString() !== userId) {
            return res.status(403).json({
                status: "fail",
                message: "Coupon does not belong to you"
            });
        }

        // Update the coupon to ensure it's valid
        coupon.isActive = true;
        coupon.isUsed = false;
        coupon.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        coupon.minOrderAmount = 500; // Ensure correct min order
        coupon.discountValue = 400; // Ensure correct discount
        coupon.maxDiscount = 400;

        await coupon.save();


        res.status(200).json({
            status: "success",
            message: "Coupon fixed successfully",
            data: {
                coupon: coupon
            }
        });

    } catch (error) {
        console.error('Error fixing coupon:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to fix coupon",
            error: error.message
        });
    }
};

// Get user's wallet with point status breakdown
const getWalletWithPointStatus = async (req, res) => {
    try {
        const userId = req.id;

        let wallet = await Wallet.findOne({ user: userId }).populate('transactions.orderId', 'orderId total status');

        if (!wallet) {
            wallet = await Wallet.create({ user: userId });
        }

        // Calculate points by status
        const pointBreakdown = wallet.transactions.reduce((acc, transaction) => {
            const status = transaction.status || 'ACTIVE';
            acc[status] = (acc[status] || 0) + transaction.points;
            return acc;
        }, { PENDING: 0, ACTIVE: 0, CANCELLED: 0 });

        // Get pending transactions with refund window info
        const pendingTransactions = wallet.transactions
            .filter(t => t.status === 'PENDING')
            .map(t => ({
                points: t.points,
                orderId: t.orderId,
                refundWindowExpiry: t.refundWindowExpiry,
                daysRemaining: t.refundWindowExpiry ?
                    Math.ceil((new Date(t.refundWindowExpiry) - new Date()) / (1000 * 60 * 60 * 24)) : null
            }));

        // Get delayed points awards
        const delayedAwards = await DelayedPointsAward.find({
            userId: userId,
            status: 'PENDING'
        }).populate('orderId', 'orderId total status createdAt');

        // Also check for recent delivered orders that might need points awarded
        const Order = (await import('../Models/OrderSchema.js')).default;
        const recentDeliveredOrders = await Order.find({
            userId: userId,
            status: { $in: ['delivered', 'confirmed', 'ready_for_pickup', 'picked_up', 'out_for_delivery'] },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }).sort({ createdAt: -1 });

        // Check which recent orders don't have points awarded yet
        const ordersWithoutPoints = [];
        for (const order of recentDeliveredOrders) {
            const hasDelayedAward = delayedAwards.some(award => award.orderId.toString() === order._id.toString());
            const hasEarnedTransaction = wallet.transactions.some(tx =>
                tx.orderId && tx.orderId.toString() === order._id.toString() && tx.type === 'earned'
            );

            if (!hasDelayedAward && !hasEarnedTransaction) {
                const orderAge = (new Date() - new Date(order.createdAt)) / (1000 * 60 * 60); // hours
                const pointsToEarn = Math.floor(order.total / 5000) * 10;

                if (pointsToEarn > 0) {
                    if (orderAge < 1) {
                        // Order is less than 1 hour old - still in refund window
                        ordersWithoutPoints.push({
                            points: pointsToEarn,
                            orderId: order._id,
                            orderNumber: order._id.toString().slice(-8).toUpperCase(),
                            orderAmount: order.total,
                            type: 'refund_window',
                            status: 'refund_window_active',
                            hoursRemaining: Math.max(0, Math.ceil(1 - orderAge)),
                            canRefund: true,
                            refundExpiryTime: new Date(order.createdAt.getTime() + 60 * 60 * 1000),
                            message: `Refund available for ${Math.max(0, Math.ceil(1 - orderAge))} more hour(s). ${pointsToEarn} points will be awarded after refund window expires.`,
                            awardTime: new Date(order.createdAt.getTime() + 60 * 60 * 1000)
                        });
                    } else if (orderAge >= 1 && orderAge < 24) {
                        // Order is 1+ hours old but less than 24 hours - should have points by now
                        ordersWithoutPoints.push({
                            points: pointsToEarn,
                            orderId: order._id,
                            orderNumber: order._id.toString().slice(-8).toUpperCase(),
                            orderAmount: order.total,
                            type: 'processing',
                            status: 'points_pending_award',
                            hoursRemaining: 0,
                            canRefund: false,
                            message: `${pointsToEarn} points should have been awarded. Processing...`,
                            awardTime: null
                        });
                    }
                }
            }
        }

        const upcomingPoints = [
            ...delayedAwards.map(award => {
                const now = new Date();
                const awardTime = new Date(award.awardTime);
                const hoursRemaining = Math.max(0, Math.ceil((awardTime - now) / (1000 * 60 * 60)));
                const canRefund = awardTime > now;

                return {
                    points: award.pointsToAward,
                    orderId: award.orderId?._id || award.orderId,
                    orderNumber: award.orderId?.orderId || `Order-${award.orderId?.toString().slice(-8)}`,
                    orderAmount: award.orderAmount,
                    type: 'delayed_award',
                    status: canRefund ? 'refund_window_active' : 'processing',
                    awardTime: award.awardTime,
                    hoursRemaining,
                    canRefund,
                    refundExpiryTime: award.awardTime,
                    message: canRefund
                        ? `${award.pointsToAward} points will be added in ${hoursRemaining} hour(s) after refund window expires`
                        : `${award.pointsToAward} points are being processed and will be available soon`
                };
            }),
            ...ordersWithoutPoints
        ];

        // Create notifications for user
        const notifications = [];

        if (upcomingPoints.length > 0) {
            const totalUpcoming = upcomingPoints.reduce((sum, award) => sum + award.points, 0);
            const refundableOrders = upcomingPoints.filter(award => award.canRefund);
            const processingOrders = upcomingPoints.filter(award => !award.canRefund);

            if (refundableOrders.length > 0) {
                notifications.push({
                    type: 'refund_available',
                    title: 'Refund Window Active',
                    message: `You have ${refundableOrders.length} order(s) eligible for refund within the next hour. ${totalUpcoming} points will be awarded after refund window expires.`,
                    icon: 'ðŸ”„',
                    priority: 'warning'
                });
            }

            if (processingOrders.length > 0) {
                const processingPoints = processingOrders.reduce((sum, order) => sum + order.points, 0);
                notifications.push({
                    type: 'points_processing',
                    title: 'Points Being Processed',
                    message: `${processingPoints} points from your recent orders are being processed and will be available soon.`,
                    icon: 'â³',
                    priority: 'info'
                });
            }

            if (notifications.length === 0) {
                notifications.push({
                    type: 'points_pending',
                    title: 'Points Pending Award',
                    message: `You have ${totalUpcoming} points that will be awarded after the refund window expires.`,
                    icon: 'â°',
                    priority: 'info'
                });
            }
        }

        return res.status(200).json({
            status: "success",
            data: {
                ...wallet.toObject(),
                pointBreakdown,
                pendingTransactions,
                upcomingPoints,
                notifications,
                activePoints: pointBreakdown.ACTIVE,
                pendingPoints: pointBreakdown.PENDING,
                cancelledPoints: pointBreakdown.CANCELLED,
                totalUpcomingPoints: upcomingPoints.reduce((sum, award) => sum + award.points, 0),
                summary: {
                    message: upcomingPoints.length > 0
                        ? `You have ${upcomingPoints.reduce((sum, award) => sum + award.points, 0)} points pending from recent orders. Points will be awarded after the 1-hour refund window.`
                        : "All your points are ready to use!",
                    refundWindowActive: upcomingPoints.some(award => award.canRefund),
                    nextAwardIn: upcomingPoints.length > 0
                        ? Math.min(...upcomingPoints.filter(award => award.hoursRemaining > 0).map(award => award.hoursRemaining))
                        : null,
                    totalPendingPoints: upcomingPoints.reduce((sum, award) => sum + award.points, 0),
                    refundableOrdersCount: upcomingPoints.filter(award => award.canRefund).length,
                    processingOrdersCount: upcomingPoints.filter(award => !award.canRefund).length
                }
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};

// Debug endpoint for wallet issues
const debugWalletData = async (req, res) => {
    try {
        const userId = req.id;

        // Get wallet
        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            wallet = await Wallet.create({ user: userId });
        }

        // Get delayed awards
        const delayedAwards = await DelayedPointsAward.find({
            userId: userId
        });

        // Get recent orders
        const Order = (await import('../Models/OrderSchema.js')).default;
        const recentDeliveredOrders = await Order.find({
            userId: userId,
            status: { $in: ['delivered', 'confirmed', 'ready_for_pickup', 'picked_up', 'out_for_delivery'] },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).sort({ createdAt: -1 });

        // Analyze each order
        const orderAnalysis = [];
        for (const order of recentDeliveredOrders) {
            const hasDelayedAward = delayedAwards.some(award => award.orderId.toString() === order._id.toString());
            const hasEarnedTransaction = wallet.transactions.some(tx =>
                tx.orderId && tx.orderId.toString() === order._id.toString() && tx.type === 'earned'
            );

            const orderAge = (new Date() - new Date(order.createdAt)) / (1000 * 60 * 60);
            const pointsToEarn = Math.floor(order.total / 5000) * 10;

            orderAnalysis.push({
                orderId: order._id.toString(),
                orderNumber: order._id.toString().slice(-8).toUpperCase(),
                status: order.status,
                age: `${orderAge.toFixed(1)} hours`,
                total: order.total,
                expectedPoints: pointsToEarn,
                hasDelayedAward,
                hasEarnedTransaction,
                needsPoints: !hasDelayedAward && !hasEarnedTransaction && pointsToEarn > 0,
                inRefundWindow: orderAge < 1
            });
        }

        return res.status(200).json({
            status: "success",
            debug: {
                userId,
                walletExists: !!wallet,
                totalPoints: wallet.totalPoints,
                transactionsCount: wallet.transactions.length,
                delayedAwardsCount: delayedAwards.length,
                recentOrdersCount: recentDeliveredOrders.length,
                orderAnalysis
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Debug failed",
            error: err.message
        });
    }
};

// Get user's refund and points status (for dashboard/homepage display)
const getRefundAndPointsStatus = async (req, res) => {
    try {
        const userId = req.id;

        // Get delayed points awards
        const delayedAwards = await DelayedPointsAward.find({
            userId: userId,
            status: 'PENDING'
        }).populate('orderId', 'orderId total createdAt status').sort({ awardTime: 1 });

        // Also check for recent delivered orders that might need points awarded
        const Order = (await import('../Models/OrderSchema.js')).default;
        const recentDeliveredOrders = await Order.find({
            userId: userId,
            status: { $in: ['delivered', 'confirmed', 'ready_for_pickup', 'picked_up', 'out_for_delivery'] },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }).sort({ createdAt: -1 });

        // Get user's wallet to check existing transactions
        const wallet = await Wallet.findOne({ user: userId });

        // Check which recent orders don't have points awarded yet
        const ordersWithoutPoints = [];
        for (const order of recentDeliveredOrders) {
            const hasDelayedAward = delayedAwards.some(award => award.orderId.toString() === order._id.toString());
            const hasEarnedTransaction = wallet && wallet.transactions.some(tx =>
                tx.orderId && tx.orderId.toString() === order._id.toString() && tx.type === 'earned'
            );

            if (!hasDelayedAward && !hasEarnedTransaction) {
                const orderAge = (new Date() - new Date(order.createdAt)) / (1000 * 60 * 60); // hours
                const pointsToEarn = Math.floor(order.total / 5000) * 10;

                if (pointsToEarn > 0) {
                    if (orderAge < 1) {
                        // Order is less than 1 hour old - still in refund window
                        ordersWithoutPoints.push({
                            orderId: order._id,
                            orderNumber: order._id.toString().slice(-8).toUpperCase(),
                            orderAmount: order.total,
                            pointsToEarn: pointsToEarn,
                            refundExpiryTime: new Date(order.createdAt.getTime() + 60 * 60 * 1000),
                            hoursRemaining: Math.max(0, Math.ceil(1 - orderAge)),
                            status: 'refund_available',
                            message: `Refund available for ${Math.max(0, Math.ceil(1 - orderAge))} more hour(s). ${pointsToEarn} points will be awarded after refund window expires.`,
                            type: 'recent_order'
                        });
                    } else if (orderAge >= 1 && orderAge < 24) {
                        // Order is 1+ hours old but less than 24 hours - should have points by now
                        ordersWithoutPoints.push({
                            orderId: order._id,
                            orderNumber: order._id.toString().slice(-8).toUpperCase(),
                            orderAmount: order.total,
                            pointsToEarn: pointsToEarn,
                            status: 'points_pending',
                            message: `${pointsToEarn} points should have been awarded. Processing...`,
                            type: 'processing_order'
                        });
                    }
                }
            }
        }

        const now = new Date();
        const refundableOrders = [];
        const upcomingAwards = [];

        // Process delayed awards
        delayedAwards.forEach(award => {
            const awardTime = new Date(award.awardTime);
            const hoursRemaining = Math.max(0, Math.ceil((awardTime - now) / (1000 * 60 * 60)));
            const canRefund = awardTime > now;

            if (canRefund) {
                refundableOrders.push({
                    orderId: award.orderId?._id || award.orderId,
                    orderNumber: award.orderId?.orderId || `Order-${award.orderId?.toString().slice(-8)}`,
                    orderAmount: award.orderAmount,
                    pointsToEarn: award.pointsToAward,
                    refundExpiryTime: award.awardTime,
                    hoursRemaining,
                    message: `Refund available for ${hoursRemaining} more hour(s). ${award.pointsToAward} points will be awarded after refund window expires.`,
                    type: 'delayed_award'
                });
            } else {
                upcomingAwards.push({
                    orderId: award.orderId?._id || award.orderId,
                    orderNumber: award.orderId?.orderId || `Order-${award.orderId?.toString().slice(-8)}`,
                    pointsToEarn: award.pointsToAward,
                    awardTime: award.awardTime,
                    status: 'processing',
                    message: `${award.pointsToAward} points are being processed and will be available soon.`,
                    type: 'delayed_award'
                });
            }
        });

        // Add orders without points to appropriate arrays
        ordersWithoutPoints.forEach(order => {
            if (order.status === 'refund_available') {
                refundableOrders.push(order);
            } else {
                upcomingAwards.push({
                    ...order,
                    awardTime: null,
                    status: 'processing'
                });
            }
        });

        return res.status(200).json({
            status: "success",
            data: {
                refundableOrders,
                upcomingAwards,
                summary: {
                    canRefund: refundableOrders.length > 0,
                    totalRefundablePoints: refundableOrders.reduce((sum, order) => sum + order.pointsToEarn, 0),
                    totalUpcomingPoints: upcomingAwards.reduce((sum, award) => sum + award.pointsToEarn, 0),
                    nextRefundExpiry: refundableOrders.length > 0
                        ? refundableOrders[0].refundExpiryTime
                        : null,
                    message: refundableOrders.length > 0
                        ? `You have ${refundableOrders.length} order(s) eligible for refund within the next hour. Points will be awarded after refund window expires.`
                        : upcomingAwards.length > 0
                        ? `${upcomingAwards.reduce((sum, award) => sum + award.pointsToEarn, 0)} points are being processed.`
                        : "All your points are ready to use!"
                }
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
};

// Debug: Check coupon status by code
const debugCouponStatus = async (req, res) => {
    try {
        const { code } = req.params;
        const userId = req.id; // Optional, for user-specific check

        if (!code) {
            return res.status(400).json({
                status: "fail",
                message: "Coupon code is required"
            });
        }


        // Find coupon by code (ignore user filter for debugging)
        const coupon = await UserCoupon.findOne({
            code: code.toUpperCase()
        });

        if (!coupon) {
            return res.status(404).json({
                status: "fail",
                message: "Coupon not found in database"
            });
        }

        // Check various conditions
        const now = new Date();
        const isExpired = coupon.expiresAt <= now;
        const belongsToUser = coupon.user.toString() === userId;
        const isActive = coupon.isActive;
        const isUsed = coupon.isUsed;

        const issues = [];
        if (isExpired) issues.push("Expired");
        if (!belongsToUser) issues.push(`Belongs to different user (${coupon.user})`);
        if (!isActive) issues.push("Not active");
        if (isUsed) issues.push("Already used");

        return res.status(200).json({
            status: "success",
            data: {
                coupon: {
                    _id: coupon._id,
                    code: coupon.code,
                    user: coupon.user,
                    discountValue: coupon.discountValue,
                    minOrderAmount: coupon.minOrderAmount,
                    expiresAt: coupon.expiresAt,
                    isActive: coupon.isActive,
                    isUsed: coupon.isUsed,
                    generatedFrom: coupon.generatedFrom,
                    createdAt: coupon.createdAt
                },
                validation: {
                    belongsToCurrentUser: belongsToUser,
                    isExpired,
                    isActive,
                    isUsed,
                    canBeUsed: belongsToUser && !isExpired && isActive && !isUsed
                },
                issues: issues.length > 0 ? issues : ["No issues found"]
            }
        });

    } catch (error) {
        console.error('Error debugging coupon:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to debug coupon",
            error: error.message
        });
    }
};

// Admin: Process all pending points immediately (both delayed awards and expired refunds)
const processAllPendingPoints = async (req, res) => {
    try {


        // Process delayed points awards
        const delayedResult = await processDelayedPointsAwards();


        // Process expired refund windows
        const refundResult = await processExpiredRefundWindows();


        res.status(200).json({
            status: "success",
            message: "All pending points processed successfully",
            data: {
                delayedPointsAwards: delayedResult,
                expiredRefundWindows: refundResult,
                totalPointsProcessed: delayedResult.totalPointsAwarded + refundResult.totalPointsActivated
            }
        });

    } catch (error) {
        console.error('Error in manual points processing:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to process pending points",
            error: error.message
        });
    }
};

// Admin: Regenerate coupons for all users who have points but missing coupons
const regenerateAllMissingCoupons = async (req, res) => {
    try {

        // Find all wallets with points
        const wallets = await Wallet.find({ totalPoints: { $gt: 0 } });

        let totalCouponsGenerated = 0;
        const results = [];

        for (const wallet of wallets) {
            try {
                // Check current coupons for this user
                const existingCoupons = await UserCoupon.countDocuments({
                    user: wallet.user,
                    generatedFrom: { $regex: '^points_' },
                    isActive: true
                });

                // Temporarily reset to regenerate all eligible
                wallet.lastCouponGenerated = { points: 0 };
                await wallet.save();

                // Regenerate coupons
                await checkAndGenerateCoupon(wallet, wallet.user);

                // Check how many new coupons were generated
                const newCoupons = await UserCoupon.countDocuments({
                    user: wallet.user,
                    generatedFrom: { $regex: '^points_' },
                    isActive: true
                });

                const couponsGenerated = newCoupons - existingCoupons;

                if (couponsGenerated > 0) {
                    totalCouponsGenerated += couponsGenerated;
                    results.push({
                        userId: wallet.user,
                        points: wallet.totalPoints,
                        couponsGenerated: couponsGenerated,
                        success: true
                    });
                }

            } catch (userError) {
                console.error(`Error processing user ${wallet.user}:`, userError);
                results.push({
                    userId: wallet.user,
                    points: wallet.totalPoints,
                    error: userError.message,
                    success: false
                });
            }
        }

        res.status(200).json({
            status: "success",
            message: `Coupon regeneration completed. Generated ${totalCouponsGenerated} coupons total.`,
            data: {
                totalWalletsProcessed: wallets.length,
                totalCouponsGenerated: totalCouponsGenerated,
                results: results
            }
        });

    } catch (error) {
        console.error('Error in bulk coupon regeneration:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to regenerate coupons",
            error: error.message
        });
    }
};

// Admin: Manually process awaiting points for a specific user
const processUserAwaitingPoints = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                status: "fail",
                message: "User ID is required"
            });
        }



        // Get user's wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId });
        }

        // Get delayed awards for this user
        const delayedAwards = await DelayedPointsAward.find({
            userId: userId,
            status: 'PENDING'
        });

        // Get recent delivered orders that might need points
        const Order = (await import('../Models/OrderSchema.js')).default;
        const recentDeliveredOrders = await Order.find({
            userId: userId,
            status: { $in: ['delivered', 'confirmed', 'ready_for_pickup', 'picked_up', 'out_for_delivery'] },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).sort({ createdAt: -1 });

        let totalPointsAwarded = 0;
        const processedItems = [];

        // Process delayed awards (award them immediately)
        for (const award of delayedAwards) {
            try {
                // Check if order still exists and valid
                const order = await Order.findById(award.orderId);
                if (!order || order.status === 'refunded' || order.status === 'cancelled_by_seller') {
                    await DelayedPointsAward.findByIdAndUpdate(award._id, { status: 'CANCELLED' });
                    continue;
                }

                // Award points immediately
                await addPointsToWallet(award.userId, award.orderAmount, award.orderId, true);
                await DelayedPointsAward.findByIdAndUpdate(award._id, { status: 'AWARDED' });

                totalPointsAwarded += award.pointsToAward;
                processedItems.push({
                    type: 'delayed_award',
                    orderId: award.orderId,
                    pointsAwarded: award.pointsToAward
                });

            } catch (error) {
                console.error(`Error processing delayed award ${award._id}:`, error);
            }
        }

        // Process orders without points (award immediately if past refund window)
        for (const order of recentDeliveredOrders) {
            // Check if order already has points
            const hasDelayedAward = delayedAwards.some(award => award.orderId.toString() === order._id.toString());
            const hasEarnedTransaction = wallet.transactions.some(tx =>
                tx.orderId && tx.orderId.toString() === order._id.toString() && tx.type === 'earned'
            );

            if (!hasDelayedAward && !hasEarnedTransaction) {
                const orderAge = (new Date() - new Date(order.createdAt)) / (1000 * 60 * 60);
                const pointsToEarn = Math.floor(order.total / 5000) * 10;

                if (pointsToEarn > 0) {
                    // Award points immediately regardless of refund window
                    await addPointsToWallet(userId, order.total, order._id, true);

                    totalPointsAwarded += pointsToEarn;
                    processedItems.push({
                        type: 'immediate_award',
                        orderId: order._id,
                        orderNumber: order._id.toString().slice(-8).toUpperCase(),
                        pointsAwarded: pointsToEarn,
                        orderAge: `${orderAge.toFixed(1)} hours`
                    });
                }
            }
        }

        // Check and generate coupons if points became active
        await checkAndGenerateCoupon(wallet, userId);

        res.status(200).json({
            status: "success",
            message: `Successfully processed awaiting points for user ${userId}`,
            data: {
                userId,
                totalPointsAwarded,
                itemsProcessed: processedItems.length,
                processedItems,
                delayedAwardsProcessed: delayedAwards.length,
                ordersProcessed: recentDeliveredOrders.length
            }
        });

    } catch (error) {
        console.error('Error in manual user points processing:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to process awaiting points",
            error: error.message
        });
    }
};

// Admin: Process refund for an order
const refundOrder = async (req, res) => {
    try {
        const { orderId, refundAmount, reason } = req.body;


        if (!orderId || !refundAmount) {
            return res.status(400).json({
                status: "fail",
                message: "Order ID and refund amount are required"
            });
        }

        // Find the order
        const Order = (await import('../Models/OrderSchema.js')).default;

        let order;
        // Try finding by _id first (ObjectId)
        if (mongoose.Types.ObjectId.isValid(orderId)) {
            order = await Order.findById(orderId);
        }

        // If not found by _id, try finding by orderId field (string)
        if (!order) {
            order = await Order.findOne({ orderId: orderId });
        }


        if (!order) {
            return res.status(404).json({
                status: "fail",
                message: `Order not found with ID: ${orderId}`
            });
        }

        // Update order status to refunded
        order.status = 'refunded';
        order.statusTimestamps.set('refunded', new Date());
        await order.save();

        // Check if user exists
        const userExists = await User.findById(order.userId);
        if (!userExists) {
            return res.status(404).json({
                status: "fail",
                message: "User not found"
            });
        }

        // Cancel any pending points and delayed awards for this order before processing refund
        try {
            await cancelPendingPoints(order.userId, order._id, 'Order refunded');
            await cancelDelayedPointsAward(order._id);
        } catch (cancelError) {
            // Continue with refund even if cancellation fails
        }

        // Process refund to wallet
        const wallet = await processRefund(
            order.userId,
            order._id, // Use the actual ObjectId from the order document
            refundAmount,
            reason || `Refund for order #${orderId}`
        );

        res.status(200).json({
            status: "success",
            message: "Refund processed successfully",
            data: {
                order: order,
                wallet: wallet,
                refundAmount: refundAmount
            }
        });

    } catch (error) {
        console.error('Refund order error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            status: "fail",
            message: "Failed to process refund",
            error: error.message
        });
    }
};

// User: Request refund for order
const requestRefund = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        const userId = req.id;

        if (!orderId) {
            return res.status(400).json({
                status: "fail",
                message: "Order ID is required"
            });
        }

        // Find the order
        const Order = (await import('../Models/OrderSchema.js')).default;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                status: "fail",
                message: "Order not found"
            });
        }

        if (order.userId.toString() !== userId) {
            return res.status(403).json({
                status: "fail",
                message: "Access denied"
            });
        }

        // Check if refund can be requested (order should be delivered or in valid state)
        if (!['delivered', 'confirmed', 'ready_for_pickup'].includes(order.status)) {
            return res.status(400).json({
                status: "fail",
                message: "Refund cannot be requested for this order status"
            });
        }

        // Check if order was placed within the last 1 hour
        const orderCreatedAt = new Date(order.createdAt);
        const now = new Date();
        const timeDiff = now - orderCreatedAt;
        const oneHourInMs = 60 * 60 * 1000; // 1 hour in milliseconds

        if (timeDiff > oneHourInMs) {
            return res.status(400).json({
                status: "fail",
                message: "Refund can only be requested within 1 hour of order placement"
            });
        }

        // Update order status to return_requested
        order.status = 'return_requested';
        order.statusTimestamps.set('return_requested', new Date());
        await order.save();

        res.status(200).json({
            status: "success",
            message: "Refund request submitted successfully",
            data: order
        });

    } catch (error) {
        console.error('Request refund error:', error);
        res.status(500).json({
            status: "fail",
            message: "Failed to submit refund request"
        });
    }
};

export {
    getUserWallet,
    getWalletWithPointStatus,
    getRefundAndPointsStatus,
    debugWalletData,
    addPointsToWallet,
    getUserCoupons,
    validateUserCoupon,
    useUserCoupon,
    generateCouponWithPoints,
    testGenerateCoupon,
    fixUserCoupon,
    debugCouponStatus,
    getAllWallets,
    getAllUserCoupons,
    addBonusPoints,
    checkAndGenerateCoupon,
    processRefund,
    refundOrder,
    requestRefund,
    regenerateUserCoupons,
    regenerateAllMissingCoupons,
    processPointsForExistingOrders,
    activatePendingPoints,
    activateAllExpiredPendingPoints,
    cancelPendingPoints,
    processExpiredRefundWindows,
    scheduleDelayedPointsAward,
    processDelayedPointsAwards,
    cancelDelayedPointsAward,
    processAllPendingPoints,
    processUserAwaitingPoints
};

