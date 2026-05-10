import FlashDeal from "../Models/FlashDealSchema.js";
import Product from "../Models/ProductSchema.js";
import Seller from "../Models/SellerSchema.js";

// Add a new flash deal (seller max 3)
const addFlashDeal = async (req, res) => {
  try {
    const { sellerId, productId, startDate, endDate } = req.body;
    const flashDealCount = await FlashDeal.countDocuments({ sellerId });
    if (flashDealCount >= 3) {
      return res.status(400).json({
        success: false,
        message: "Maximum 3 flash deals allowed per seller."
      });
    }
    // Product ownership check
    const product = await Product.findOne({ _id: productId, sellerid: sellerId });
    if (!product) {
      return res.status(400).json({
        success: false,
        message: "Product does not exist or doesn't belong to this seller."
      });
    }
    const duplicate = await FlashDeal.findOne({ productId });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "This product is already in a flash deal."
      });
    }
    const newFlashDeal = new FlashDeal({ sellerId, productId, startDate, endDate, status: "pending" });
    const saved = await newFlashDeal.save();
    return res.status(200).json({ success: true, message: "Flash deal requested (pending approval)", data: saved });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// Remove a flash deal (only seller's own)
const removeFlashDeal = async (req, res) => {
  try {
    const { sellerId, flashDealId } = req.body;
    const deal = await FlashDeal.findOneAndDelete({ _id: flashDealId, sellerId });
    if (!deal) {
      return res.status(404).json({ success: false, message: "Flash deal not found." });
    }
    return res.status(200).json({ success: true, message: "Flash deal removed." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// Seller: Get his own flash deals by status (optional status)
const getSellerFlashDeals = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { status } = req.query;
    const query = { sellerId };
    if (status) query.status = status;
    const deals = await FlashDeal.find(query).limit(3).populate({
      path: "productId",
      populate: [
        { path: "catid", select: "name cname" },
        { path: "subcatid", select: "name scname" }
      ]
    });

    return res.status(200).json({ success: true, message: "Seller flash deals", data: deals });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// Admin: Get all pending flash deals
const getPendingFlashDeals = async (req, res) => {
  try {
    const deals = await FlashDeal.find({ status: "pending" })
      .populate("sellerId")
      .populate({
        path: "productId",
        populate: [
          { path: "catid", select: "name cname" },
          { path: "subcatid", select: "name scname" }
        ]
      });

    return res.status(200).json({ success: true, message: "Pending flash deals", data: deals });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// Admin: Approve/reject flash deal
const approveFlashDeal = async (req, res) => {
  try {
    const { flashDealId, action, adminId } = req.body; // adminId optional, for audit
    const status = action === "approve" ? "approved" : "rejected";
    const updateObj = { status };
    if (adminId && status === "approved") updateObj.approvedBy = adminId;
    const deal = await FlashDeal.findByIdAndUpdate(flashDealId, updateObj, { new: true });
    if (!deal) {
      return res.status(404).json({ success: false, message: "Flash deal not found." });
    }
    return res.status(200).json({ success: true, message: `Flash deal ${status}.`, data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// Admin: Get all approved flash deals
const getApprovedFlashDeals = async (req, res) => {
  try {
    const deals = await FlashDeal.find({ status: "approved" })
      .populate("sellerId")
      .populate({
        path: "productId",
        populate: [
          { path: "catid", select: "name cname" },
          { path: "subcatid", select: "name scname" }
        ]
      });

    return res.status(200).json({ success: true, message: "Approved flash deals", data: deals });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// Home: Get only approved flash deals (optimized)
const getHomeFlashDeals = async (req, res) => {
  try {
    // 1. Fetch all approved flash deals in ONE query
    const allApprovedDeals = await FlashDeal.find({ status: "approved" })
      .populate("sellerId")
      .populate({
        path: "productId",
        populate: [
          { path: "catid", select: "name cname" },
          { path: "subcatid", select: "name scname" }
        ]
      })
      .lean();

    // 2. Group them by seller in memory (JS)
    const groupedMap = new Map();
    
    allApprovedDeals.forEach(deal => {
      const sellerId = deal.sellerId?._id?.toString() || "unknown";
      if (!groupedMap.has(sellerId)) {
        groupedMap.set(sellerId, {
          seller: deal.sellerId,
          deals: []
        });
      }
      // Max 3 deals per seller as per requirement
      if (groupedMap.get(sellerId).deals.length < 3) {
        groupedMap.get(sellerId).deals.push(deal);
      }
    });

    const result = Array.from(groupedMap.values());
    
    return res.status(200).json({ success: true, message: "Home flash deals", data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

export {
  addFlashDeal,
  removeFlashDeal,
  getSellerFlashDeals,
  getHomeFlashDeals,
  getPendingFlashDeals,
  getApprovedFlashDeals,
  approveFlashDeal
};
