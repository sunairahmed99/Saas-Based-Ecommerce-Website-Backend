import express from "express";
import { createCoupon, getCoupons, validateCoupon, updateCoupon, deleteCoupon, toggleCouponStatus, getAvailableCoupons } from "../Controllers/CouponController.js";
import verifyuser, { verifyAdmin } from "../Middleware/VerifyUser.js";

const CouponRouter = express.Router();

// Admin routes
CouponRouter.post("/", verifyAdmin, createCoupon);
CouponRouter.get("/", verifyAdmin, getCoupons);
CouponRouter.put("/:id", verifyAdmin, updateCoupon);
CouponRouter.delete("/:id", verifyAdmin, deleteCoupon);
CouponRouter.patch("/:id/toggle", verifyAdmin, toggleCouponStatus);

// User routes
CouponRouter.post("/validate", verifyuser, validateCoupon);
CouponRouter.get("/available", verifyuser, getAvailableCoupons);

export default CouponRouter;

