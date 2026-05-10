import ProductBoostRequest from "../Models/ProductBoostRequestSchema.js";
import BoostPackage from "../Models/BoostPackageSchema.js";
import Product from "../Models/ProductSchema.js";

// Seller: Request product boost
const requestProductBoost = async (req, res) => {
    try {
        const { sellerId, packageId, productIds, paymentScreenshot } = req.body;

        // Validate package exists and is active
        const boostPackage = await BoostPackage.findOne({ _id: packageId, isActive: true });
        if (!boostPackage) {
            return res.status(404).json({
                success: false,
                message: "Boost package not found or inactive"
            });
        }

        // Check for existing pending request from this seller for this package
        const existingPending = await ProductBoostRequest.findOne({
            sellerId,
            packageId,
            status: "pending"
        });
        if (existingPending) {
            const currentCount = existingPending.productIds.length;
            if (currentCount < boostPackage.productLimit) {
                return res.status(409).json({
                    success: false,
                    message: `You already have a pending boost request with this package. You can add more products (limit: ${boostPackage.productLimit}).`,
                    requestId: existingPending._id,
                    productsAdded: currentCount,
                    limit: boostPackage.productLimit
                });
            }
        }

        // Validate product count doesn't exceed package limit
        if (productIds.length > boostPackage.productLimit) {
            return res.status(400).json({
                success: false,
                message: `Maximum ${boostPackage.productLimit} products allowed for this package`
            });
        }

        // Validate all products belong to the seller and are active
        for (const productId of productIds) {
            const product = await Product.findOne({
                _id: productId,
                sellerid: sellerId,
                pstatus: "active"
            });
            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: `Product ${productId} does not exist, doesn't belong to you, or is not active`
                });
            }
        }

        // Check if any of these products are already in another active/pending/approved boost (any request, any seller)
        const duplicateBoost = await ProductBoostRequest.findOne({
            productIds: { $in: productIds },
            status: { $in: ["pending", "approved", "active"] },
            endDate: { $gt: new Date() }
        });
        if (duplicateBoost) {
            return res.status(400).json({
                success: false,
                message: "One or more products are already in a boost request."
            });
        }

        // Calculate total amount
        const totalAmount = boostPackage.price;

        // Create boost request
        const boostRequest = new ProductBoostRequest({
            sellerId,
            packageId,
            productIds,
            totalAmount,
            paymentScreenshot,
            status: "pending"
        });

        const savedRequest = await boostRequest.save();
        const populatedRequest = await ProductBoostRequest.findById(savedRequest._id)
            .populate('packageId')
            .populate('productIds')
            .populate('sellerId');

        return res.status(201).json({
            success: true,
            message: "Product boost request submitted successfully",
            data: populatedRequest
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Seller: Get his own boost requests
const getSellerBoostRequests = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const { status } = req.query;

        const query = { sellerId };
        if (status) {
            query.status = status;
        }

        const requests = await ProductBoostRequest.find(query)
            .populate('packageId')
            .populate('productIds')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Seller boost requests retrieved successfully",
            data: requests
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Seller: Cancel boost request (only if pending)
const cancelBoostRequest = async (req, res) => {
    try {
        const { requestId, sellerId } = req.body;

        const request = await ProductBoostRequest.findOneAndUpdate(
            { _id: requestId, sellerId, status: "pending" },
            { status: "cancelled" },
            { new: true }
        ).populate('packageId').populate('productIds');

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Boost request not found or cannot be cancelled"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Boost request cancelled successfully",
            data: request
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Admin: Get all pending boost requests
const getPendingBoostRequests = async (req, res) => {
    try {
        const requests = await ProductBoostRequest.find({ status: "pending" })
            .populate('packageId')
            .populate('productIds')
            .populate('sellerId')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Pending boost requests retrieved successfully",
            data: requests
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Admin: Approve or reject boost request
const approveBoostRequest = async (req, res) => {
    try {
        const { requestId, action, notes } = req.body;

        const normalized = (action || "").toLowerCase();
        const isApprove = normalized === "approve" || normalized === "approved";
        const status = isApprove ? "approved" : "rejected";
        const updateData = { status, notes };

        if (status === "approved") {
            updateData.approvedBy = null; // No admin auth for now
            updateData.approvedAt = new Date();

            // Get the request to calculate dates
            const request = await ProductBoostRequest.findById(requestId).populate('packageId');
            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: "Boost request not found"
                });
            }

            const packageData = request.packageId;
            const startDate = new Date();
            let endDate = new Date(startDate);

            // Calculate end date based on duration type
            switch (packageData.durationType) {
                case 'days':
                    endDate.setDate(startDate.getDate() + packageData.duration);
                    break;
                case 'weeks':
                    endDate.setDate(startDate.getDate() + (packageData.duration * 7));
                    break;
                case 'months':
                    endDate.setMonth(startDate.getMonth() + packageData.duration);
                    break;
                default:
                    endDate.setDate(startDate.getDate() + packageData.duration);
            }

            updateData.startDate = startDate;
            updateData.endDate = endDate;
            updateData.status = "active"; // Set to active immediately after approval
        }

        const updatedRequest = await ProductBoostRequest.findByIdAndUpdate(
            requestId,
            updateData,
            { new: true }
        ).populate('packageId').populate('productIds').populate('sellerId');

        if (!updatedRequest) {
            return res.status(404).json({
                success: false,
                message: "Boost request not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: `Boost request ${status} successfully`,
            data: updatedRequest
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Admin: Get all boost requests (with optional status filter)
const getAllBoostRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status) {
            query.status = status;
        }

        const requests = await ProductBoostRequest.find(query)
            .populate('packageId')
            .populate('productIds')
            .populate('sellerId')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "All boost requests retrieved successfully",
            data: requests
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get active boosts (for displaying boosted products)
const getActiveBoosts = async (req, res) => {
    try {
        const currentDate = new Date();
        const activeBoosts = await ProductBoostRequest.find({
            status: "active",
            endDate: { $gt: currentDate }
        })
        .populate('packageId')
        .populate('productIds')
        .populate('sellerId')
        .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Active boosts retrieved successfully",
            data: activeBoosts
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Cron job function to expire old boosts (can be called by a scheduler)
const expireOldBoosts = async () => {
    try {
        const currentDate = new Date();
        const expiredBoosts = await ProductBoostRequest.deleteMany(
            {
                status: "active",
                endDate: { $lte: currentDate }
            }
        );

        return expiredBoosts.deletedCount;
    } catch (error) {
        console.error("Error expiring old boosts:", error);
        return 0;
    }
};

// PATCH: Add products to an existing pending boost request
const addProductsToBoostRequest = async (req, res) => {
    try {
        const { requestId, sellerId, newProductIds } = req.body;
        if (!requestId || !sellerId || !Array.isArray(newProductIds) || newProductIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Missing or invalid parameters."
            });
        }

        // Find the request
        const boostRequest = await ProductBoostRequest.findOne({ _id: requestId, sellerId, status: "pending" }).populate('packageId');
        if (!boostRequest) {
            return res.status(404).json({
                success: false,
                message: "Pending boost request not found."
            });
        }

        const boostPackage = boostRequest.packageId;
        const currentProducts = boostRequest.productIds.map(id => id.toString());
        
        // Validate the new total does not exceed limit
        const finalProducts = [...new Set([...currentProducts, ...newProductIds.map(id => id.toString())])];
        if (finalProducts.length > boostPackage.productLimit) {
            return res.status(400).json({
                success: false,
                message: `Cannot add: Limit for this package is ${boostPackage.productLimit}`
            });
        }
        // Validate all new products
        for (const productId of newProductIds) {
            // Check not already in the list
            if (currentProducts.includes(productId.toString())) continue;
            // Must belong to seller and be active
            const product = await Product.findOne({
                _id: productId,
                sellerid: sellerId,
                pstatus: "active"
            });
            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: `Product ${productId} does not exist, doesn't belong to you, or is not active`
                });
            }
            // Cannot be part of any other "pending"/"approved"/"active" request
            const alreadyBoosted = await ProductBoostRequest.findOne({
                _id: { $ne: requestId },
                productIds: productId,
                status: { $in: ["pending", "approved", "active"] },
                endDate: { $gt: new Date() }
            });
            if (alreadyBoosted) {
                return res.status(400).json({
                    success: false,
                    message: `Product ${productId} is already in another boost request.`
                });
            }
        }

        boostRequest.productIds = finalProducts;
        await boostRequest.save();
        const populated = await ProductBoostRequest.findById(boostRequest._id)
            .populate('packageId')
            .populate('productIds')
            .populate('sellerId');
        return res.status(200).json({
            success: true,
            message: "Products added to boost request successfully",
            data: populated
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export {
    requestProductBoost,
    getSellerBoostRequests,
    cancelBoostRequest,
    getPendingBoostRequests,
    approveBoostRequest,
    getAllBoostRequests,
    getActiveBoosts,
    expireOldBoosts,
    addProductsToBoostRequest
};
