import express from "express";
import { addFlashDeal, removeFlashDeal, getSellerFlashDeals, getHomeFlashDeals, getPendingFlashDeals, getApprovedFlashDeals, approveFlashDeal } from "../Controllers/FlashDealController.js";
import { verifyAdmin } from "../Middleware/VerifyUser.js";

const FlashDealRouter = express.Router();

FlashDealRouter.post("/add", addFlashDeal);
FlashDealRouter.delete("/remove", removeFlashDeal);
FlashDealRouter.get("/seller/:sellerId", getSellerFlashDeals); // ?status=pending|approved|rejected
FlashDealRouter.get("/home", getHomeFlashDeals);
// Admin routes
FlashDealRouter.get("/admin/pending", verifyAdmin, getPendingFlashDeals);
FlashDealRouter.get("/admin/approved", verifyAdmin, getApprovedFlashDeals);
FlashDealRouter.patch("/approve", verifyAdmin, approveFlashDeal);

export default FlashDealRouter;
