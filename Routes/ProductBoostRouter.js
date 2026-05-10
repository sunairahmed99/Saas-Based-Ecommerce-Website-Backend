import express from "express";
import {
    requestProductBoost,
    getSellerBoostRequests,
    cancelBoostRequest,
    getPendingBoostRequests,
    approveBoostRequest,
    getAllBoostRequests,
    getActiveBoosts,
    expireOldBoosts,
    addProductsToBoostRequest
} from "../Controllers/ProductBoostController.js";
import verifyuser, { verifyAdmin } from "../Middleware/VerifyUser.js";

const ProductBoostRouter = express.Router();

// Seller routes (require authentication)
ProductBoostRouter.post("/request", verifyuser, requestProductBoost);
ProductBoostRouter.patch("/request/add-products", verifyuser, addProductsToBoostRequest);
ProductBoostRouter.get("/seller/:sellerId", verifyuser, getSellerBoostRequests); // ?status=pending|approved|etc
ProductBoostRouter.patch("/cancel", verifyuser, cancelBoostRequest);

// Admin routes
ProductBoostRouter.get("/admin/pending", verifyAdmin, getPendingBoostRequests);
ProductBoostRouter.get("/admin/all", verifyAdmin, getAllBoostRequests); // ?status=pending|approved|etc
ProductBoostRouter.patch("/admin/approve", verifyAdmin, approveBoostRequest);

// Public routes (for displaying active boosts)
ProductBoostRouter.get("/active", getActiveBoosts);

// Utility route (for cron jobs)
ProductBoostRouter.post("/admin/expire-old", verifyAdmin, expireOldBoosts);

export default ProductBoostRouter;
