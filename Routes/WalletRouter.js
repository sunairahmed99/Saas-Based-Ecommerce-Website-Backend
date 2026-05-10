import express from "express";
import {
    getUserWallet,
    getWalletWithPointStatus,
    getRefundAndPointsStatus,
    debugWalletData,
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
    refundOrder,
    requestRefund,
    regenerateUserCoupons,
    regenerateAllMissingCoupons,
    processPointsForExistingOrders,
    activatePendingPoints,
    cancelPendingPoints,
    processExpiredRefundWindows,
    processDelayedPointsAwards,
    processAllPendingPoints,
    processUserAwaitingPoints
} from "../Controllers/WalletController.js";
import { verifyAdmin } from "../Middleware/VerifyUser.js";
import verifyuser from "../Middleware/VerifyUser.js";

const WalletRouter = express.Router();

// User routes (require authentication)
WalletRouter.get("/user", verifyuser, getUserWallet);
WalletRouter.get("/user/detailed", verifyuser, getWalletWithPointStatus);
WalletRouter.get("/user/refund-status", verifyuser, getRefundAndPointsStatus);
WalletRouter.get("/user/debug", verifyuser, debugWalletData);
WalletRouter.get("/user/coupons", verifyuser, getUserCoupons);
WalletRouter.post("/user/validate-coupon", verifyuser, validateUserCoupon);
WalletRouter.post("/user/generate-coupon", verifyuser, generateCouponWithPoints);
WalletRouter.post("/user/test-generate-coupon", verifyuser, testGenerateCoupon);
WalletRouter.post("/user/fix-coupon", verifyuser, fixUserCoupon);
WalletRouter.get("/debug-coupon/:code", verifyuser, debugCouponStatus);
WalletRouter.post("/user/check-coupon/:code", verifyuser, debugCouponStatus);
WalletRouter.post("/user/request-refund", verifyuser, requestRefund);

// Admin routes
WalletRouter.get("/admin/all", verifyAdmin, getAllWallets);
WalletRouter.get("/admin/coupons", verifyAdmin, getAllUserCoupons);
WalletRouter.post("/admin/add-bonus", verifyAdmin, addBonusPoints);
WalletRouter.post("/admin/refund", verifyAdmin, refundOrder);
WalletRouter.post("/admin/regenerate-coupons", verifyAdmin, regenerateUserCoupons);
WalletRouter.post("/admin/regenerate-all-coupons", verifyAdmin, regenerateAllMissingCoupons);
WalletRouter.post("/admin/process-existing-orders", verifyAdmin, processPointsForExistingOrders);
WalletRouter.post("/admin/activate-points", verifyAdmin, activatePendingPoints);
WalletRouter.post("/admin/cancel-points", verifyAdmin, cancelPendingPoints);
WalletRouter.post("/admin/process-expired-refunds", verifyAdmin, processExpiredRefundWindows);
WalletRouter.post("/admin/process-delayed-points", verifyAdmin, processDelayedPointsAwards);
WalletRouter.post("/admin/process-all-pending-points", verifyAdmin, processAllPendingPoints);
WalletRouter.post("/admin/process-user-awaiting-points", verifyAdmin, processUserAwaitingPoints);

export default WalletRouter;
