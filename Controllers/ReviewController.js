import Review, { ProductReview } from "../Models/ReviewSchema.js";
import User from "../Models/UserSchema.js";
import Order from "../Models/OrderSchema.js";
import Product from "../Models/ProductSchema.js";
import mongoose from "mongoose";
import { updateRatingOnReviewChange } from "../Utils/ProductRatingService.js";

const toIdString = (id) => {
  if (!id) return null;
  if (typeof id === "object" && id._id) return String(id._id);
  return String(id);
};

// User can create review
const createReview = async (req, res) => {
  try {
    const userId = req.id;
    const { message, rating } = req.body;
    if (!message) {
      return res.status(400).json({ status: "fail", message: "Message is required" });
    }
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ status: "fail", message: "User not found" });
    }
    const review = await Review.create({
      userId,
      name: user.name || "User",
      message,
      rating: rating || 5,
      approved: false,
      image: user.Image || user.image || null,
    });
    return res.status(200).json({ status: "success", data: review });
  } catch (err) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Admin: list all reviews
const getAllReviews = async (_req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 }).lean();
    const userIds = [
      ...new Set(
        reviews
          .map((r) => toIdString(r.userId))
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      ),
    ];

    const users =
      userIds.length > 0
        ? await User.find({ _id: { $in: userIds } }).select("Image image name").lean()
        : [];

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const withImages = reviews.map((r) => {
      const uid = toIdString(r.userId);
      if (!r.image && uid && userMap.has(uid)) {
        const u = userMap.get(uid);
        return { ...r, image: u.Image || u.image || null, name: r.name || u.name };
      }
      return r;
    });
    return res.status(200).json({ status: "success", data: withImages });
  } catch (err) {
    console.error("Error fetching all reviews:", err);
    return res.status(500).json({ status: "fail", message: err.message || "Something went wrong" });
  }
};

// Public: approved reviews for homepage
const getApprovedReviews = async (_req, res) => {
  try {
    const reviews = await Review.find({ approved: true }).sort({ createdAt: -1 }).lean();
    const userIds = [...new Set(reviews.filter(r => r.userId).map(r => r.userId.toString()))];
    const users = await User.find({ _id: { $in: userIds } }).select("Image image name").lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));
    const withImages = reviews.map(r => {
      if (!r.image && r.userId && userMap.has(r.userId.toString())) {
        const u = userMap.get(r.userId.toString());
        return { ...r, image: u.Image || u.image || null, name: r.name || u.name };
      }
      return r;
    });
    return res.status(200).json({ status: "success", data: withImages });
  } catch (err) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Admin: approve a review
const approveReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ status: "fail", message: "Review not found" });
    }
    review.approved = true;
    await review.save();
    return res.status(200).json({ status: "success", data: review });
  } catch (err) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Admin: delete a review
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findByIdAndDelete(id);
    if (!review) {
      return res.status(404).json({ status: "fail", message: "Review not found" });
    }
    return res.status(200).json({ status: "success", data: review });
  } catch (err) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Get user's ordered products that they can review
const getUserOrderedProducts = async (req, res) => {
  try {
    const userId = req.id;

    // Find all delivered orders for this user
    const orders = await Order.find({
      userId,
      status: "delivered"
    }).populate({
      path: 'items.productId',
      select: 'pname pimage1 prodisprice pprice _id'
    }).sort({ createdAt: -1 });

    // Extract unique products from orders
    const productMap = new Map();
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.productId && item.productId._id) {
          const productId = item.productId._id.toString();
          if (!productMap.has(productId)) {
            productMap.set(productId, {
              _id: item.productId._id,
              name: item.productId.pname,
              image: item.productId.pimage1,
              price: item.productId.prodisprice || item.productId.pprice,
              orderId: order._id,
              orderedAt: order.createdAt
            });
          }
        }
      });
    });

    const products = Array.from(productMap.values());

    return res.status(200).json({
      status: "success",
      data: products,
      count: products.length
    });
  } catch (err) {
    console.error("Error fetching user ordered products:", err);
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Create product review
const createProductReview = async (req, res) => {
  try {
    const userId = req.id;
    const { productId, orderId, message, rating } = req.body;

    if (!productId || !orderId || !message) {
      return res.status(400).json({
        status: "fail",
        message: "Product ID, Order ID, and message are required"
      });
    }

    // Validate that the user has ordered this product
    const order = await Order.findOne({
      _id: orderId,
      userId,
      status: "delivered",
      "items.productId": productId
    });

    if (!order) {
      return res.status(403).json({
        status: "fail",
        message: "You can only review products you have purchased and received"
      });
    }

    // Check if user already reviewed this product
    const existingReview = await ProductReview.findOne({
      userId,
      productId,
      orderId
    });

    if (existingReview) {
      return res.status(400).json({
        status: "fail",
        message: "You have already reviewed this product"
      });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ status: "fail", message: "User not found" });
    }

    const review = await ProductReview.create({
      userId,
      productId,
      orderId,
      name: user.name || "User",
      message,
      rating: rating || 5,
      approved: false,
      image: user.Image || user.image || null,
      type: "product"
    });

    // Update product rating (will be updated when review is approved)
    updateRatingOnReviewChange(productId);

    return res.status(200).json({ status: "success", data: review });
  } catch (err) {
    console.error("Error creating product review:", err);
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Get approved product reviews for a specific product
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await ProductReview.find({
      productId,
      approved: true
    }).populate({
      path: 'userId',
      select: 'name Image image'
    }).sort({ createdAt: -1 }).lean();

    // Format reviews for frontend - also expose userId/deviceId for uniqueness checks
    const formattedReviews = reviews.map(review => ({
      _id: review._id,
      userId: review.userId ? review.userId._id : null,
      deviceId: review.deviceId || null,
      name: review.name || (review.userId ? review.userId.name : "User"),
      message: review.message,
      rating: review.rating,
      image: review.image || (review.userId ? (review.userId.Image || review.userId.image) : null),
      createdAt: review.createdAt
    }));

    return res.status(200).json({
      status: "success",
      data: formattedReviews,
      count: formattedReviews.length
    });
  } catch (err) {
    console.error("Error fetching product reviews:", err);
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Admin: Get all product reviews
const getAllProductReviews = async (req, res) => {
  try {
    const reviews = await ProductReview.find().sort({ createdAt: -1 }).lean();

    const productIds = [
      ...new Set(
        reviews
          .map((r) => toIdString(r.productId))
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      ),
    ];
    const userIds = [
      ...new Set(
        reviews
          .map((r) => toIdString(r.userId))
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      ),
    ];

    const [products, users] = await Promise.all([
      productIds.length > 0
        ? Product.find({ _id: { $in: productIds } }).select("pname pimage1").lean()
        : [],
      userIds.length > 0
        ? User.find({ _id: { $in: userIds } }).select("name Image image").lean()
        : [],
    ]);

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const formatted = reviews.map((review) => {
      const pid = toIdString(review.productId);
      const uid = toIdString(review.userId);
      return {
        ...review,
        productId: pid && productMap.has(pid) ? productMap.get(pid) : review.productId,
        userId: uid && userMap.has(uid) ? userMap.get(uid) : review.userId,
        image:
          review.image ||
          (uid && userMap.has(uid)
            ? userMap.get(uid).Image || userMap.get(uid).image
            : null),
      };
    });

    return res.status(200).json({ status: "success", data: formatted });
  } catch (err) {
    console.error("Error fetching all product reviews:", err);
    return res.status(500).json({ status: "fail", message: err.message || "Something went wrong" });
  }
};

// Admin: Approve product review
const approveProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await ProductReview.findById(id);
    if (!review) {
      return res.status(404).json({ status: "fail", message: "Review not found" });
    }
    review.approved = true;
    await review.save();

    // Update product rating when review is approved
    updateRatingOnReviewChange(review.productId);

    return res.status(200).json({ status: "success", data: review });
  } catch (err) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Admin: Delete product review
const deleteProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await ProductReview.findByIdAndDelete(id);
    if (!review) {
      return res.status(404).json({ status: "fail", message: "Review not found" });
    }

    // Update product rating when review is deleted
    updateRatingOnReviewChange(review.productId);

    return res.status(200).json({ status: "success", data: review });
  } catch (err) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

export {
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
  getUserOrderedProducts
};

