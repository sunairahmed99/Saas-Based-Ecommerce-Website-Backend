import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    image: { type: String },
    approved: { type: Boolean, default: false },
    type: { type: String, enum: ["website"], default: "website" }, // For future extensibility
  },
  { timestamps: true }
);

const ProductReviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // Not required, may be guest
    deviceId: { type: String, required: false }, // For guests (non-logged-in users)
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: false }, // Optional: allow reviewing even if not purchased
    name: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    image: { type: String },
    approved: { type: Boolean, default: false },
    type: { type: String, enum: ["product"], default: "product" },
  },
  { timestamps: true }
);

// Add indexes for better performance
// One review per userId/product, or deviceId/product (for guests)
ProductReviewSchema.index({ productId: 1, userId: 1 }, { unique: true, sparse: true });
ProductReviewSchema.index({ productId: 1, deviceId: 1 }, { unique: true, sparse: true });
ProductReviewSchema.index({ approved: 1, productId: 1 });

const Review = mongoose.model("Review", ReviewSchema);
const ProductReview = mongoose.model("ProductReview", ProductReviewSchema);

export { Review as default, ProductReview };

