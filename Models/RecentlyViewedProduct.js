import mongoose from "mongoose";

const RecentlyViewedProductSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  // For guests (non-logged-in users), we track by deviceId string
  deviceId: {
    type: String,
    required: false,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  viewedAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure only one record per (user, product) OR (device, product)
RecentlyViewedProductSchema.index(
  { userId: 1, productId: 1 },
  { unique: true, sparse: true }
);
RecentlyViewedProductSchema.index(
  { deviceId: 1, productId: 1 },
  { unique: true, sparse: true }
);

export default mongoose.model("RecentlyViewedProduct", RecentlyViewedProductSchema);
