import express from "express";
import { getProfitAnalytics, getSellerProfitAnalytics, getDashboardStats } from "../Controllers/AnalyticsController.js";
import { verifyAdmin } from "../Middleware/VerifyUser.js";

const AnalyticsRouter = express.Router();

// Admin-only routes for analytics
AnalyticsRouter.get("/dashboard", verifyAdmin, getDashboardStats);
AnalyticsRouter.get("/profit", verifyAdmin, getProfitAnalytics);
AnalyticsRouter.get("/seller/:sellerId", verifyAdmin, getSellerProfitAnalytics);

export default AnalyticsRouter;
