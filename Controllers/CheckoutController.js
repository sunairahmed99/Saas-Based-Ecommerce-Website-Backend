import mongoose from "mongoose";
import Address from "../Models/AddressSchema.js";
import Cart from "../Models/CartSchema.js";
import Coupon from "../Models/CouponSchema.js";
import Order from "../Models/OrderSchema.js";
import Product from "../Models/ProductSchema.js";
import ProductVariation from "../Models/ProductVariationSchema.js";
import InventoryLog from "../Models/InventoryLogSchema.js";
import InventoryAlert from "../Models/InventoryAlertSchema.js";
import { enqueueNotification } from "./NotificationController.js";
import { buildDiscount } from "./CouponController.js";
import { addPointsToWallet, useUserCoupon, validateUserCoupon, scheduleDelayedPointsAward } from "./WalletController.js";
import UserCoupon from "../Models/UserCouponSchema.js";
import User from "../Models/UserSchema.js";

const ALLOWED_STATUSES = [
  "placed",
  "pending",
  "processing",
  "confirmed",
  "cancelled_by_seller",
  "ready_for_pickup",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "returned",
  "refunded"
];

const normalizeStatus = (status) =>
  status?.toString().trim().toLowerCase().replace(/[\s-]+/g, "_");

const normalizeAddress = (addressDoc) => ({
  addressId: addressDoc._id,
  fullName: addressDoc.fullName,
  phone: addressDoc.phone,
  line1: addressDoc.line1,
  line2: addressDoc.line2 || "",
  city: addressDoc.city,
  state: addressDoc.state,
  postalCode: addressDoc.postalCode,
  country: addressDoc.country,
  label: addressDoc.label
});

const ensureAddress = async (userId, payload) => {
  const { addressId, address } = payload;

  // Require explicit address selection - no fallback to default
  if (!addressId && !address) {
    throw new Error("ADDRESS_REQUIRED");
  }

  if (addressId) {
    const addr = await Address.findOne({ _id: addressId, userId });
    if (!addr) {
      throw new Error("ADDRESS_NOT_FOUND");
    }
    return addr;
  }

  if (address) {
    const count = await Address.countDocuments({ userId });
    if (count >= 3) {
      throw new Error("ADDRESS_LIMIT");
    }
    const required = ["fullName", "phone", "line1", "city", "state", "postalCode"];
    const missing = required.filter((key) => !address[key]);
    if (missing.length) {
      const err = new Error("ADDRESS_FIELDS");
      err.details = missing;
      throw err;
    }
    const created = await Address.create({
      ...address,
      userId,
      isDefault: count === 0 ? true : Boolean(address.isDefault)
    });
    return created;
  }

  // This should never be reached due to the check above, but keeping as fallback
  throw new Error("ADDRESS_REQUIRED");
};

const validateCouponForUser = (coupon, userId, subtotal) => {
  const now = new Date();
  if (coupon.startDate && now < coupon.startDate) {
    return "Coupon not started yet";
  }
  if (coupon.endDate && now > coupon.endDate) {
    return "Coupon expired";
  }
  if (coupon.totalUsageLimit && coupon.usageCount >= coupon.totalUsageLimit) {
    return "Coupon usage limit reached";
  }
  if (subtotal < coupon.minOrderAmount) {
    return `Minimum order amount is ${coupon.minOrderAmount}`;
  }
  const userUses = coupon.redemptions.filter(
    (r) => r.userId && r.userId.toString() === userId
  );
  if (userUses.length >= coupon.usagePerUser) {
    return "You have already redeemed this coupon";
  }
  return null;
};

const createOrder = async (req, res) => {
  try {
    const userId = req.id || req.body?.userId || req.headers["user_id"];
    const { addressId, address, coupon, paymentMethod, useWallet, items: clientItems } = req.body;
    const couponCode = coupon?.code;
    const useClientCart = Array.isArray(clientItems) && clientItems.length > 0;





    if (!userId) {
      return res.status(401).json({ status: "fail", message: "Login required" });
    }

    const customer = await User.findById(userId).select("_id");
    if (!customer) {
      return res.status(403).json({
        status: "fail",
        message: "Please login with a customer account to place orders.",
      });
    }

    // Check database connection
    try {
      await mongoose.connection.db.admin().ping();
    } catch (dbError) {
      throw dbError;
    }

    const normalizedPaymentMethod = (paymentMethod || "cod").toLowerCase();

    // Validate payment method
    if (!["cod", "wallet"].includes(normalizedPaymentMethod)) {
      return res.status(400).json({ status: "fail", message: "Invalid payment method" });
    }

    let cartItems;
    try {
      if (useClientCart) {
        cartItems = clientItems.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity) || 1,
          color: item.color ?? null,
          size: item.size ?? null,
          sellerId: item.sellerId,
        }));
      } else {
        cartItems = await Cart.find({ userId }).populate("productId");
      }

      if (!cartItems.length) {
        return res.status(400).json({ status: "fail", message: "Cart is empty" });
      }
    } catch (cartError) {
      throw cartError;
    }

    let selectedAddress;
    try {
      selectedAddress = await ensureAddress(userId, { addressId, address });
    } catch (err) {
      const map = {
        ADDRESS_NOT_FOUND: { code: 404, message: "Address not found" },
        ADDRESS_LIMIT: { code: 400, message: "You can only save up to 3 addresses" },
        ADDRESS_REQUIRED: { code: 400, message: "Please add or select an address" },
        ADDRESS_FIELDS: {
          code: 400,
          message: "Full name, phone, line1, city, state and postal code are required"
        }
      };
      const resp = map[err.message] || { code: 500, message: "Something went wrong" };
      return res.status(resp.code).json({ status: "fail", message: resp.message });
    }

    const items = [];
    let subtotal = 0;

    for (const cartItem of cartItems) {
      let product = cartItem.productId || (await Product.findById(cartItem.productId));
      if (!product) {
        return res.status(404).json({ status: "fail", message: "Product not found" });
      }
      if (product.pstatus === "outofstock" || product.pstatus === "inactive") {
        return res.status(400).json({ status: "fail", message: `${product.pname} is not available` });
      }

      // Check stock based on variations or main product stock
      // Fix negative stock values in database
      if (product.totalStock < 0 || product.pqty < 0) {
        await Product.findByIdAndUpdate(product._id, {
          totalStock: Math.max(0, product.totalStock),
          pqty: Math.max(0, product.pqty)
        });
        // Refresh product data
        product = await Product.findById(product._id);
      }

      let availableStock = 0;
      let variation = null;

      if (cartItem.size || cartItem.color) {
        // First try to find variation stock
        variation = await ProductVariation.findOne({
          productId: product._id,
          size: cartItem.size || null,
          color: cartItem.color || null,
          isActive: true,
        });

        if (variation) {
          // Use variation stock if variation exists
          availableStock = variation.variationStock;
        } else {
          // Fallback: Check if color/size are valid for the product, then use main stock
          const isValidColor = !cartItem.color || (product.pcolor && product.pcolor.includes(cartItem.color));
          const isValidSize = !cartItem.size || (product.psize && product.psize.includes(cartItem.size));

          if (!isValidColor || !isValidSize) {
            return res.status(400).json({
              status: "fail",
              message: `${product.pname} has invalid color/size combination: ${cartItem.size || ''} ${cartItem.color || ''}`
            });
          }

          // Use main product stock as fallback
          availableStock = Math.max(0, product.totalStock || product.pqty || 0); // Ensure non-negative
        }
      } else {
        // Check main product stock
        availableStock = Math.max(0, product.totalStock || product.pqty || 0); // Ensure non-negative
      }

      if (availableStock < cartItem.quantity) {
        const variationDesc = (variation || cartItem.size || cartItem.color)
          ? ` (${cartItem.size || ''} ${cartItem.color || ''})`.trim()
          : '';
        return res.status(400).json({
          status: "fail",
          message: `${product.pname}${variationDesc} has only ${availableStock} left`
        });
      }

      const unitPrice =
        product.prodisprice > 0
          ? product.prodisprice
          : product.pactualprice > 0
          ? product.pactualprice
          : product.pprice;

      const total = unitPrice * cartItem.quantity;
      subtotal += total;

      const sellerId =
        product.sellerid ||
        product.sellerId ||
        product.seller?._id ||
        cartItem.sellerId;

      if (!sellerId) {
        return res
          .status(400)
          .json({ status: "fail", message: "Seller missing for product" });
      }

      items.push({
        productId: product._id,
        name: product.pname,
        quantity: cartItem.quantity,
        price: unitPrice,
        total,
        color: cartItem.color || null,
        size: cartItem.size || null,
        sellerId
      });
    }

    let discount = 0;
    let appliedCoupon;
    let couponDoc;

    if (couponCode) {
      // First check for admin/global coupons
      couponDoc = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });

      if (couponDoc) {
        // Admin coupon found
        const invalidReason = validateCouponForUser(couponDoc, userId, subtotal);
        if (invalidReason) {
          return res.status(400).json({ status: "fail", message: invalidReason });
        }

        discount = buildDiscount(couponDoc, subtotal);
        appliedCoupon = {
          code: couponDoc.code,
          discountType: couponDoc.discountType,
          discountValue: couponDoc.discountValue,
          couponType: 'admin'
        };
      } else {
        // Check for user-specific coupons
        const userCoupon = await UserCoupon.findOne({
          code: couponCode.toUpperCase(),
          user: userId,
          isUsed: false,
          isActive: true,
          expiresAt: { $gt: new Date() }
        });

        if (!userCoupon) {
          return res.status(404).json({ status: "fail", message: "Invalid or expired coupon code" });
        }

        // Validate minimum order amount
        if (subtotal < userCoupon.minOrderAmount) {
          return res.status(400).json({
            status: "fail",
            message: `Minimum order amount is PKR ${userCoupon.minOrderAmount}`
          });
        }

        // Calculate discount for user coupon
        if (userCoupon.discountType === 'fixed') {
          discount = userCoupon.discountValue;
        } else {
          discount = (subtotal * userCoupon.discountValue) / 100;
          if (userCoupon.maxDiscount) {
            discount = Math.min(discount, userCoupon.maxDiscount);
          }
        }

        discount = Math.min(discount, subtotal); // Don't exceed order amount

        appliedCoupon = {
          code: userCoupon.code,
          discountType: userCoupon.discountType,
          discountValue: userCoupon.discountValue,
          couponType: 'user'
        };
      }
    }

    const total = Math.max(subtotal - discount, 0);

    // Handle wallet payment
    let walletDeduction = 0;
    let finalAmount = total;

    if (normalizedPaymentMethod === "wallet") {
      const Wallet = (await import('../Models/WalletSchema.js')).default;
      const wallet = await Wallet.findOne({ user: userId });

      if (!wallet) {
        return res.status(400).json({
          status: "fail",
          message: "Wallet not found. Please set up your wallet first."
        });
      }

      // Calculate current wallet balance
      const balance = wallet.transactions.reduce((acc, transaction) => {
        switch (transaction.type) {
          case 'earned':
          case 'bonus':
          case 'refund':
            return acc + transaction.amount;
          case 'spent':
            return acc - transaction.amount;
          default:
            return acc;
        }
      }, 0);

      if (balance < total) {
        return res.status(400).json({
          status: "fail",
          message: `Insufficient wallet balance. Available: PKR ${balance}, Required: PKR ${total}`
        });
      }

      walletDeduction = total;
      finalAmount = 0; // Fully paid by wallet

      // Deduct from wallet
      wallet.transactions.push({
        type: 'spent',
        points: 0,
        amount: walletDeduction,
        description: `Payment for order`,
        orderId: null // Will be updated after order creation
      });

      await wallet.save();
    }

    const now = new Date();

    // Pre-mark only user-wallet coupons (admin/global coupons are redeemed after order save)
    if (appliedCoupon?.code && appliedCoupon.couponType === "user") {
      try {




        // CRITICAL: Check if this coupon belongs to this user before marking
        const UserCoupon = (await import('../Models/UserCouponSchema.js')).default;
        const couponCheck = await UserCoupon.findOne({
          code: appliedCoupon.code.toUpperCase(),
          user: userId
        });

        if (!couponCheck) {

          throw new Error(`Coupon ${appliedCoupon.code} does not belong to this user`);
        }



        const markedCoupon = await useUserCoupon(userId, appliedCoupon.code, null); // orderId will be set later

        if (markedCoupon) {



          // IMMEDIATE VERIFICATION: Check database immediately
          const verifyMarked = await UserCoupon.findOne({
            code: appliedCoupon.code.toUpperCase(),
            user: userId
          });

          if (verifyMarked && verifyMarked.isUsed) {

          } else {

            throw new Error('Coupon marking verification failed');
          }
        } else {

          throw new Error('Failed to mark coupon as used - null result');
        }
      } catch (couponError) {
        console.error(`💥 COUPON MARKING FAILED: ${appliedCoupon.code}`, couponError.message);
        console.error(`💥 Error stack:`, couponError.stack);

        return res.status(400).json({
          status: "fail",
          message: couponError.message || "Could not apply coupon to this order",
        });
      }
    }

    // Calculate profit for the order (SIMPLIFIED: 10% admin, 90% seller from revenue)
    let orderProfit = {
      totalRevenue: subtotal,
      totalCost: 0, // Not used in simplified calculation
      totalProfit: subtotal, // Total revenue = total profit
      sellerProfit: subtotal * 0.90, // 90% to seller
      adminProfit: subtotal * 0.10, // 10% to admin
      calculatedAt: now
    };

    // Adjust for discount (reduce revenue and profit proportionally)
    if (discount > 0) {
      const discountRatio = discount / subtotal;
      orderProfit.totalRevenue = subtotal - discount;
      orderProfit.totalProfit = orderProfit.totalRevenue; // Profit = revenue after discount
      orderProfit.sellerProfit = orderProfit.totalRevenue * 0.90;
      orderProfit.adminProfit = orderProfit.totalRevenue * 0.10;
    }



    const order = await Order.create({
      userId,
      items,
      address: normalizeAddress(selectedAddress),
      subtotal,
      discount,
      total: finalAmount,
      coupon: appliedCoupon,
      profit: orderProfit,
      payment: {
        method: normalizedPaymentMethod,
        status: normalizedPaymentMethod === "wallet" ? "paid" : "pending"
      },
      paymentMethod: normalizedPaymentMethod,
      status: "pending",
      statusTimestamps: {
        pending: now
      }
    });

    // Deduct stock from products/variations, create inventory logs, and bump soldCount
    const stockUpdatePromises = items.map(async (item) => {
      const product = await Product.findById(item.productId);
      if (!product) return;

      const sellerId = product.sellerid;

      // Find corresponding cart item to get variation details
      const cartItem = cartItems.find(cart =>
        cart.productId.toString() === item.productId.toString() &&
        cart.size === item.size &&
        cart.color === item.color
      );

      if (cartItem && (cartItem.size || cartItem.color)) {
        // Try to deduct from variation stock first
        const variation = await ProductVariation.findOneAndUpdate(
          {
            productId: product._id,
            size: cartItem.size || null,
            color: cartItem.color || null,
            isActive: true,
          },
          { $inc: { variationStock: -item.quantity } },
          { new: true }
        );

        if (variation) {
          // Successfully deducted from variation stock
          await InventoryLog.create({
            productId: product._id,
            variationId: variation._id,
            sellerId: sellerId,
            actionType: "order_placed",
            previousStock: variation.variationStock + item.quantity,
            newStock: variation.variationStock,
            quantityChanged: -item.quantity,
            orderId: order._id,
            orderItemId: item._id,
            performedBy: {
              userType: "system",
              name: "Order System",
            },
            variationDetails: {
              size: variation.size,
              color: variation.color,
              variationSku: variation.variationSku,
            },
            notes: `Stock deducted for order ${order._id} (variation)`,
          });
        } else {
          // No variation found, deduct from main product stock
          const previousStock = product.totalStock || product.pqty || 0;
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { totalStock: -item.quantity, pqty: -item.quantity }
          });

          // Create inventory log for main product
          await InventoryLog.create({
            productId: product._id,
            sellerId: sellerId,
            actionType: "order_placed",
            previousStock: previousStock,
            newStock: previousStock - item.quantity,
            quantityChanged: -item.quantity,
            orderId: order._id,
            orderItemId: item._id,
            performedBy: {
              userType: "system",
              name: "Order System",
            },
            variationDetails: {
              size: cartItem.size,
              color: cartItem.color,
            },
            notes: `Stock deducted for order ${order._id} (main stock, variation not found)`,
          });
        }
      } else {
        // No size/color specified, deduct from main product stock
        const previousStock = product.totalStock || product.pqty || 0;
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalStock: -item.quantity, pqty: -item.quantity }
        });

        // Create inventory log for main product
        await InventoryLog.create({
          productId: product._id,
          sellerId: sellerId,
          actionType: "order_placed",
          previousStock: previousStock,
          newStock: previousStock - item.quantity,
          quantityChanged: -item.quantity,
          orderId: order._id,
          orderItemId: item._id,
          performedBy: {
            userType: "system",
            name: "Order System",
          },
          notes: `Stock deducted for order ${order._id}`,
        });
      }

      // Increment total units sold for this product
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { soldCount: item.quantity }
      });
    });

    await Promise.all(stockUpdatePromises);

    if (couponDoc) {
      await Coupon.findByIdAndUpdate(couponDoc._id, {
        $inc: { usageCount: 1 },
        $push: { redemptions: { userId, orderId: order._id, redeemedAt: new Date() } }
      });
    }

    if (!useClientCart) {
      await Cart.deleteMany({ userId });
    }

    // Update wallet transaction with order ID if wallet payment was used
    if (normalizedPaymentMethod === "wallet" && walletDeduction > 0) {
      const Wallet = (await import('../Models/WalletSchema.js')).default;
      await Wallet.findOneAndUpdate(
        { user: userId, "transactions.orderId": null },
        {
          $set: {
            "transactions.$.orderId": order._id,
            "transactions.$.description": `Payment for order #${order._id}`
          }
        },
        { sort: { "transactions.createdAt": -1 } }
      );
    }

    // Points are now scheduled only when the order is delivered

    // Update coupon with order ID now that order is created
    if (appliedCoupon && appliedCoupon.code) {
      try {


        // Update the coupon's usedOrderId since we set it to null during initial marking
        const UserCoupon = (await import('../Models/UserCouponSchema.js')).default;
        const Coupon = (await import('../Models/CouponSchema.js')).default;

        // Try updating user coupon first
        let updateResult = await UserCoupon.findOneAndUpdate(
          { code: appliedCoupon.code.toUpperCase(), user: userId, isUsed: true },
          { usedOrderId: order._id },
          { new: true }
        );

        if (!updateResult) {
          // Try updating admin coupon
          updateResult = await Coupon.findOneAndUpdate(
            { code: appliedCoupon.code.toUpperCase() },
            {
              $set: {
                'redemptions.$[elem].orderId': order._id
              }
            },
            {
              arrayFilters: [{ 'elem.userId': userId }],
              new: true
            }
          );
        }

        if (updateResult) {

        } else {

        }
      } catch (updateError) {
        console.error(`❌ Failed to update coupon order ID:`, updateError.message);
        // Don't fail the order for this
      }
    }

    // Debug: Verify coupon was marked as used
    if (appliedCoupon && appliedCoupon.code) {
      const UserCoupon = (await import('../Models/UserCouponSchema.js')).default;
      const Coupon = (await import('../Models/CouponSchema.js')).default;

      // Check UserCoupon collection
      const userCoupon = await UserCoupon.findOne({ code: appliedCoupon.code.toUpperCase() });
      if (userCoupon) {

      }

      // Check Coupon collection (admin coupons)
      const adminCoupon = await Coupon.findOne({ code: appliedCoupon.code.toUpperCase() });
      if (adminCoupon) {
        const userRedemptions = adminCoupon.redemptions?.filter(r => r.userId.toString() === userId.toString()) || [];

      }
    }

    return res.status(201).json({
      status: "success",
      data: order,
      message: "Order placed successfully! You have 1 hour to request a refund if needed. Points will be awarded after the refund window expires.",
      refundWindow: {
        available: true,
        hoursRemaining: 1,
        expiryTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      },
      points: {
        willBeAwarded: true,
        awardTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        estimatedPoints: Math.floor(finalAmount / 5000) * 10
      }
    });
  } catch (error) {
    console.error("Error creating order:", error.message);
    return res.status(500).json({
      status: "fail",
      message: "Something went wrong"
    });
  }
};

const formatOrderResponse = (order) => {
  const obj = order?.toObject ? order.toObject() : order;
  if (obj && !obj.paymentMethod && obj.payment?.method) {
    obj.paymentMethod = obj.payment.method;
  }
  return obj;
};

const getOrders = async (req, res) => {
  try {
    const userId = req.id || req.query?.userId || req.headers["user_id"];
    const { sellerId: querySellerId } = req.query;

    if (!userId) {
      return res.status(401).json({ status: "fail", message: "Login required" });
    }

    if (querySellerId) {


      const sellerFilter = mongoose.Types.ObjectId.isValid(querySellerId)
        ? new mongoose.Types.ObjectId(querySellerId)
        : querySellerId;



      const orders = await Order.find({
        items: { $elemMatch: { sellerId: sellerFilter } }
      })
        .sort({ createdAt: -1 })
        .populate("userId", "name email")
        .populate("items.sellerId", "name image")
        .populate("items.productId", "pname pimage1 image sku");


      orders.forEach((order, index) => {

      });

      return res.status(200).json({ status: "success", data: orders.map(formatOrderResponse) });
    }

    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const criteria = { userId: userObjectId };

    const orders = await Order.find(criteria)
      .sort({ createdAt: -1 })
      .populate("userId", "name email")
      .populate("items.sellerId", "name image")
      .populate("items.productId", "pname pimage1 image sku");


    const formattedOrders = orders.map(formatOrderResponse);

    return res.status(200).json({ status: "success", data: formattedOrders });
  } catch (error) {
    console.error("getOrders error:", error?.message || error);
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

const getOrderById = async (req, res) => {
  try {
    const userId = req.id || req.headers["user_id"] || req.query?.userId;
    const orderId = req.params.id;

    // Temporarily allow admin/public access without user restriction.
    const order = await Order.findOne(
      userId ? { _id: orderId, userId } : { _id: orderId }
    ).populate("items.sellerId", "name image")
    .populate("items.productId", "pname pimage1 image");
    if (!order) {
      return res.status(404).json({ status: "fail", message: "Order not found" });
    }

    return res.status(200).json({ status: "success", data: formatOrderResponse(order) });
  } catch (error) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

const getAdminOrders = async (req, res) => {
    try {

      // Bypass role restriction: allow all access
      const orders = await Order.find({})
        .sort({ createdAt: -1 })
        .populate("items.sellerId", "name image")
        .populate("items.productId", "pname pimage1 image");


      const formattedOrders = orders.map(formatOrderResponse);

      return res.status(200).json({ status: "success", data: formattedOrders });
    } catch (error) {
      console.error("Error fetching admin orders:", error);
      console.error("Error stack:", error.stack);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);

      // Check if it's a database connection error
      if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
        console.error("Database connection error detected");
        return res.status(500).json({
          status: "fail",
          message: "Database connection error. Please check MongoDB connection.",
          error: error.message
        });
      }

      return res.status(500).json({
        status: "fail",
        message: "Something went wrong",
        error: error.message
      });
    }
};

// Helper function to restore stock for cancelled/returned orders
const restoreOrderStock = async (order, actionType, reason = "") => {
  const stockRestorePromises = order.items.map(async (item) => {
    const product = await Product.findById(item.productId);
    if (!product) return;

    const sellerId = product.sellerid;

    if (item.size || item.color) {
      // Try to restore variation stock first
      const variation = await ProductVariation.findOneAndUpdate(
        {
          productId: product._id,
          size: item.size || null,
          color: item.color || null,
          isActive: true,
        },
        { $inc: { variationStock: item.quantity } },
        { new: true }
      );

      if (variation) {
        // Successfully restored variation stock
        await InventoryLog.create({
          productId: product._id,
          variationId: variation._id,
          sellerId: sellerId,
          actionType: actionType,
          previousStock: variation.variationStock - item.quantity,
          newStock: variation.variationStock,
          quantityChanged: item.quantity,
          orderId: order._id,
          orderItemId: item._id,
          reason: reason,
          performedBy: {
            userType: "system",
            name: "Order System",
          },
          variationDetails: {
            size: variation.size,
            color: variation.color,
            variationSku: variation.variationSku,
          },
          notes: `Stock restored for ${actionType} order ${order._id} (variation)`,
        });
      } else {
        // No variation found, restore to main product stock
        const previousStock = product.totalStock || product.pqty || 0;
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalStock: item.quantity, pqty: item.quantity }
        });

        // Create inventory log for main product
        await InventoryLog.create({
          productId: product._id,
          sellerId: sellerId,
          actionType: actionType,
          previousStock: previousStock,
          newStock: previousStock + item.quantity,
          quantityChanged: item.quantity,
          orderId: order._id,
          orderItemId: item._id,
          reason: reason,
          performedBy: {
            userType: "system",
            name: "Order System",
          },
          variationDetails: {
            size: item.size,
            color: item.color,
          },
          notes: `Stock restored for ${actionType} order ${order._id} (main stock, variation not found)`,
        });
      }
    } else {
      // No size/color specified, restore to main product stock
      const previousStock = product.totalStock || product.pqty || 0;
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { totalStock: item.quantity, pqty: item.quantity }
      });

      // Create inventory log for main product
      await InventoryLog.create({
        productId: product._id,
        sellerId: sellerId,
        actionType: actionType,
        previousStock: previousStock,
        newStock: previousStock + item.quantity,
        quantityChanged: item.quantity,
        orderId: order._id,
        orderItemId: item._id,
        reason: reason,
        performedBy: {
          userType: "system",
          name: "Order System",
        },
        notes: `Stock restored for ${actionType} order ${order._id}`,
      });
    }
  });

  await Promise.all(stockRestorePromises);
};

const updateOrderStatus = async (req, res) => {
  try {

    const { id: orderId } = req.params;
    const { status, reason } = req.body;

    const nextStatus = normalizeStatus(status);

    if (!nextStatus || !ALLOWED_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ status: "fail", message: "Invalid status" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ status: "fail", message: "Order not found" });
    }

    const currentNormalized = normalizeStatus(order.status);
    const normalizedCurrent = ALLOWED_STATUSES.includes(currentNormalized)
      ? currentNormalized
      : "pending";

    // Bypass: treat everyone as admin
    const currentIdx = ALLOWED_STATUSES.indexOf(normalizedCurrent);
    const nextIdx = ALLOWED_STATUSES.indexOf(nextStatus);

    // Check if status change requires stock restoration
    const stockRestoringStatuses = ["cancelled_by_seller", "returned"];
    const needsStockRestore = stockRestoringStatuses.includes(nextStatus) &&
                             !stockRestoringStatuses.includes(normalizedCurrent);

    if (needsStockRestore) {
      const actionType = nextStatus === "cancelled_by_seller" ? "order_cancelled" : "order_returned";
      await restoreOrderStock(order, actionType, reason);
    }

    if (currentIdx > -1 && nextIdx > -1 && nextIdx < currentIdx && !needsStockRestore) {
      return res.status(400).json({ status: "fail", message: "Status cannot move backwards in the flow" });
    }
    order.status = nextStatus;

    // Track the timestamp for the new status in a flexible map structure.
    if (!order.statusTimestamps || typeof order.statusTimestamps.set !== "function") {
      order.statusTimestamps = new Map(Object.entries(order.statusTimestamps || {}));
    }
    order.statusTimestamps.set(nextStatus, new Date());

    if (!order.paymentMethod && order.payment?.method) {
      order.paymentMethod = order.payment.method;
    }

    await order.save();

    // Schedule points award ONLY if status is delivered
    if (nextStatus === "delivered") {
      try {
        await scheduleDelayedPointsAward(order.userId, order._id, order.total);
      } catch (pointsError) {
        console.error("Failed to schedule points award on delivery:", pointsError);
      }
    }

    // Note: Coupon is marked as used immediately when order is created, not when delivered
    // This ensures one-time use even if order status changes

    return res.status(200).json({ status: "success", data: formatOrderResponse(order) });
  } catch (error) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Generate order receipt/slip
const generateOrderSlip = async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = req.get("seller_id") || req.sellerId || req.id;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const order = await Order.findById(orderId)
      .populate("userId", "name email")
      .populate("items.productId", "pname sku")
      .populate("items.sellerId", "name shopName");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if seller owns any items in this order
    const hasSellerItems = order.items.some(item => item.sellerId._id.toString() === sellerId.toString());
    if (!hasSellerItems) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only view receipts for your own orders",
      });
    }

    // Filter items to only show seller's items
    const sellerItems = order.items.filter(item => item.sellerId._id.toString() === sellerId.toString());

    // Calculate seller's subtotal
    const sellerSubtotal = sellerItems.reduce((total, item) => total + item.total, 0);

    const orderSlip = {
      orderId: order._id,
      orderNumber: order._id.toString().slice(-8).toUpperCase(),
      orderDate: order.createdAt,
      status: order.status,
      customer: {
        name: order.address?.fullName || "N/A",
        phone: order.address?.phone || "N/A",
        address: `${order.address?.line1 || ""}, ${order.address?.city || ""}, ${order.address?.state || ""} ${order.address?.postalCode || ""}`,
      },
      seller: {
        name: sellerItems[0]?.sellerId?.name || "N/A",
        shopName: sellerItems[0]?.sellerId?.shopName || "N/A",
      },
      items: sellerItems.map(item => ({
        productName: item.productId?.pname || item.name,
        sku: item.productId?.sku || "N/A",
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        color: item.color,
        size: item.size,
      })),
      summary: {
        subtotal: sellerSubtotal,
        discount: order.coupon ? (order.subtotal - order.total) : 0,
        total: sellerSubtotal, // Seller's portion
      },
      payment: {
        method: order.payment?.method || "COD",
        status: order.payment?.status || "pending",
      },
    };

    res.status(200).json({
      success: true,
      message: "Order slip generated successfully",
      data: orderSlip,
    });
  } catch (error) {
    console.error("Error generating order slip:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Export order slip as PDF/HTML
const exportOrderSlip = async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = req.get("seller_id") || req.sellerId || req.id;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const order = await Order.findById(orderId)
      .populate("userId", "name email")
      .populate("items.productId", "pname sku")
      .populate("items.sellerId", "name shopName");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if seller owns any items in this order
    const hasSellerItems = order.items.some(item => item.sellerId._id.toString() === sellerId.toString());
    if (!hasSellerItems) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only view receipts for your own orders",
      });
    }

    // Filter items to only show seller's items
    const sellerItems = order.items.filter(item => item.sellerId._id.toString() === sellerId.toString());

    // Calculate seller's subtotal
    const sellerSubtotal = sellerItems.reduce((total, item) => total + item.total, 0);

    const orderSlip = {
      orderId: order._id,
      orderNumber: order._id.toString().slice(-8).toUpperCase(),
      orderDate: order.createdAt,
      status: order.status,
      customer: {
        name: order.address?.fullName || "N/A",
        phone: order.address?.phone || "N/A",
        address: `${order.address?.line1 || ""}, ${order.address?.city || ""}, ${order.address?.state || ""} ${order.address?.postalCode || ""}`,
      },
      seller: {
        name: sellerItems[0]?.sellerId?.name || "N/A",
        shopName: sellerItems[0]?.sellerId?.shopName || "N/A",
      },
      items: sellerItems.map(item => ({
        productName: item.productId?.pname || item.name,
        sku: item.productId?.sku || "N/A",
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        color: item.color,
        size: item.size,
      })),
      summary: {
        subtotal: sellerSubtotal,
        discount: order.coupon ? (order.subtotal - order.total) : 0,
        total: sellerSubtotal, // Seller's portion
      },
      payment: {
        method: order.payment?.method || "COD",
        status: order.payment?.status || "pending",
      },
    };

    // Generate HTML receipt
    const htmlReceipt = generateHTMLReceipt(orderSlip);

    // Set headers for file download
    const filename = `order_slip_${orderSlip.orderNumber}.html`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.status(200).send(htmlReceipt);
  } catch (error) {
    console.error("Error exporting order slip:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message || "Unknown error occurred",
    });
  }
};

// Generate HTML receipt
const generateHTMLReceipt = (orderSlip) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Order Receipt - ${orderSlip.orderNumber}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
            .order-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .customer-info, .seller-info { width: 48%; }
            .items { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .items th, .items td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .items th { background-color: #f2f2f2; }
            .summary { float: right; width: 300px; border: 1px solid #ddd; padding: 15px; }
            .total { font-weight: bold; font-size: 18px; }
            .status { padding: 10px; background: #e9ecef; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Order Receipt</h1>
            <h2>Order #${orderSlip.orderNumber}</h2>
        </div>

        <div class="status">
            <strong>Order Status:</strong> ${orderSlip.status.toUpperCase()}<br>
            <strong>Order Date:</strong> ${new Date(orderSlip.orderDate).toLocaleString()}<br>
            <strong>Payment Method:</strong> ${orderSlip.payment.method.toUpperCase()}<br>
            <strong>Payment Status:</strong> ${orderSlip.payment.status.toUpperCase()}
        </div>

        <div class="order-info">
            <div class="customer-info">
                <h3>Customer Information</h3>
                <p><strong>Name:</strong> ${orderSlip.customer.name}</p>
                <p><strong>Phone:</strong> ${orderSlip.customer.phone}</p>
                <p><strong>Address:</strong> ${orderSlip.customer.address}</p>
            </div>
            <div class="seller-info">
                <h3>Seller Information</h3>
                <p><strong>Seller:</strong> ${orderSlip.seller.name}</p>
                <p><strong>Shop:</strong> ${orderSlip.seller.shopName}</p>
            </div>
        </div>

        <h3>Order Items</h3>
        <table class="items">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Variant</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${orderSlip.items.map(item => `
                    <tr>
                        <td>${item.productName}</td>
                        <td>${item.sku}</td>
                        <td>${item.size || ''} ${item.color || ''}</td>
                        <td>${item.quantity}</td>
                        <td>PKR ${item.price}</td>
                        <td>PKR ${item.total}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="summary">
            <h4>Order Summary</h4>
            <p><strong>Subtotal:</strong> PKR ${orderSlip.summary.subtotal}</p>
            ${orderSlip.summary.discount > 0 ? `<p><strong>Discount:</strong> -PKR ${orderSlip.summary.discount}</p>` : ''}
            <p class="total"><strong>Total:</strong> PKR ${orderSlip.summary.total}</p>
        </div>

        <div style="clear: both; margin-top: 50px; text-align: center; color: #666;">
            <p>Thank you for your business!</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    </body>
    </html>
  `;
};

export { createOrder, getOrders, getOrderById, getAdminOrders, updateOrderStatus, generateOrderSlip, exportOrderSlip };

