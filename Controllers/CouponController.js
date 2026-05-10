import Coupon from "../Models/CouponSchema.js";
import User from "../Models/UserSchema.js";

const ensureAdmin = async (userId) => {
  if (!userId) return false;
  const user = await User.findById(userId);
  return user && user.role === "admin";
};

const buildDiscount = (coupon, subtotal) => {
  const base =
    coupon.discountType === "percentage"
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;
  const capped =
    coupon.maxDiscount && coupon.maxDiscount > 0
      ? Math.min(base, coupon.maxDiscount)
      : base;
  return Math.min(capped, subtotal);
};

const createCoupon = async (req, res) => {
  try {
    const userId = req.id;
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      startDate,
      endDate,
      totalUsageLimit,
      usagePerUser
    } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({
        status: "fail",
        message: "Code, discountType and discountValue are required"
      });
    }

    if (discountType === "percentage" && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({
        status: "fail",
        message: "Percentage discount must be between 1 and 100"
      });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      startDate,
      endDate,
      totalUsageLimit,
      usagePerUser,
      createdBy: userId
    });

    return res.status(201).json({ status: "success", data: coupon });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ status: "fail", message: "Coupon code already exists" });
    }
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return res.status(200).json({ status: "success", data: coupons });
  } catch (error) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

const validateCoupon = async (req, res) => {
  try {
    const userId = req.id;
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({ status: "fail", message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      return res.status(404).json({ status: "fail", message: "Coupon not found" });
    }

    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
      return res.status(400).json({ status: "fail", message: "Coupon not started yet" });
    }
    if (coupon.endDate && now > coupon.endDate) {
      return res.status(400).json({ status: "fail", message: "Coupon expired" });
    }
    if (coupon.totalUsageLimit && coupon.usageCount >= coupon.totalUsageLimit) {
      return res.status(400).json({ status: "fail", message: "Coupon usage limit reached" });
    }

    if (subtotal !== undefined && subtotal < coupon.minOrderAmount) {
      return res.status(400).json({
        status: "fail",
        message: `Minimum order amount is ${coupon.minOrderAmount}`
      });
    }

    if (userId) {
      const userUses = coupon.redemptions.filter(
        (r) => r.userId && r.userId.toString() === userId
      );
      if (userUses.length >= coupon.usagePerUser) {
        return res.status(400).json({
          status: "fail",
          message: "You have already redeemed this coupon"
        });
      }
    }

    const calculatedDiscount =
      subtotal !== undefined ? buildDiscount(coupon, subtotal) : coupon.discountValue;

    return res.status(200).json({
      status: "success",
      data: {
        coupon,
        discount: calculatedDiscount
      }
    });
  } catch (error) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Update coupon
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating the code if it's being used
    if (updates.code) {
      const existingCoupon = await Coupon.findOne({
        code: updates.code.toUpperCase(),
        _id: { $ne: id }
      });
      if (existingCoupon) {
        return res.status(400).json({
          status: "fail",
          message: "Coupon code already exists"
        });
      }
      updates.code = updates.code.toUpperCase();
    }

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!coupon) {
      return res.status(404).json({
        status: "fail",
        message: "Coupon not found"
      });
    }

    res.status(200).json({
      status: "success",
      message: "Coupon updated successfully",
      data: coupon
    });

  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to update coupon"
    });
  }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if coupon has been used
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        status: "fail",
        message: "Coupon not found"
      });
    }

    if (coupon.usageCount > 0) {
      return res.status(400).json({
        status: "fail",
        message: "Cannot delete coupon that has been used"
      });
    }

    await Coupon.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
      message: "Coupon deleted successfully"
    });

  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to delete coupon"
    });
  }
};

// Toggle coupon active status
const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        status: "fail",
        message: "Coupon not found"
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({
      status: "success",
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      data: coupon
    });

  } catch (error) {
    console.error("Toggle coupon status error:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to toggle coupon status"
    });
  }
};

// Get available coupons for user
const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.id;

    const coupons = await Coupon.find({
      isActive: true,
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gte: new Date() } }
      ]
    }).select('code description discountType discountValue minOrderAmount maxDiscount startDate endDate');

    // Filter out coupons user has already used up
    const availableCoupons = coupons.filter(coupon => {
      const userUsage = coupon.redemptions.filter(
        redemption => redemption.userId.toString() === userId.toString()
      );
      return userUsage.length < coupon.usagePerUser;
    });

    res.status(200).json({
      status: "success",
      data: availableCoupons
    });

  } catch (error) {
    console.error("Get available coupons error:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch coupons"
    });
  }
};

export { createCoupon, getCoupons, validateCoupon, updateCoupon, deleteCoupon, toggleCouponStatus, getAvailableCoupons, buildDiscount };

