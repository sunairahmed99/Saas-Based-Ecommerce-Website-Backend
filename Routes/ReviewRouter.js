import express from "express";
import {
  createReview,
  getAllReviews,
  getApprovedReviews,
  approveReview,
  deleteReview,
  createProductReview,
  getProductReviews,
  getAllProductReviews,
  approveProductReview,
  deleteProductReview,
  getUserOrderedProducts,
} from "../Controllers/ReviewController.js";

const ReviewRouter = express.Router();

// Public approved list
ReviewRouter.get("/approved", getApprovedReviews);

// User: create review (must be logged in)
import verifyuser, { verifyAdmin } from "../Middleware/VerifyUser.js";
ReviewRouter.post("/create", verifyuser, createReview);

// Product review routes (specific paths before :productId)
ReviewRouter.get("/user-ordered-products", verifyuser, getUserOrderedProducts);
ReviewRouter.post("/product/create", verifyuser, createProductReview);

// Admin routes - protected with admin authentication
ReviewRouter.get("/getall", verifyAdmin, getAllReviews);
ReviewRouter.patch("/approve/:id", verifyAdmin, approveReview);
ReviewRouter.delete("/:id", verifyAdmin, deleteReview);

// Admin product review routes (must be before /product/:productId)
ReviewRouter.get("/product/getall", verifyAdmin, getAllProductReviews);
ReviewRouter.patch("/product/approve/:id", verifyAdmin, approveProductReview);
ReviewRouter.delete("/product/:id", verifyAdmin, deleteProductReview);

ReviewRouter.get("/product/:productId", getProductReviews);

export default ReviewRouter;

