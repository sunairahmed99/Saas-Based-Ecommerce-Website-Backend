import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../Models/UserSchema.js";
import Seller from "../Models/SellerSchema.js";

dotenv.config({ quiet: true });

const extractToken = (req) => {
  let token =
    req.header("auth_token") ||
    req.header("admin_auth_token") ||
    req.header("seller_auth_token");

  if (!token) {
    const authHeader = req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }
  if (token && /^Bearer\s+/i.test(token)) {
    token = token.replace(/^Bearer\s+/i, "").trim();
  }
  return token || null;
};

const normalizeRole = (role) => String(role || "user").toLowerCase().trim();

const verifyuser = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(400).json({
        status: "fail",
        message: "invalid token or please login again"
      });
    }

    const payload = await jwt.verify(token, process.env.jwtkey);

    const accountId = payload.id;


    // Try to resolve the account either as a customer/admin or as a seller.
    let account = await User.findById(accountId).lean();
    let role = normalizeRole(account?.role);
    let sellerId;



    if (!account) {

      const seller = await Seller.findById(accountId).lean();

      if (!seller) {
        return res.status(401).json({
          status: "fail",
          message: "invalid token or account not found"
        });
      }
      account = seller;
      role = normalizeRole(seller.role || "seller");
      sellerId = seller._id;

    }

    req.id = accountId;
    req.role = role;
    if (sellerId) {
      req.sellerId = sellerId;
    }

    next();
  } catch (err) {
    // Most common case: invalid/expired token
    return res.status(401).json({
      status: "fail",
      message: "invalid or expired token, please login again"
    });
  }
};

const verifyAdmin = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(400).json({
        status: "fail",
        message: "Authentication token is missing. Please login again as admin."
      });
    }

    const payload = await jwt.verify(token, process.env.jwtkey);
    const accountId = payload.id;

    // Try to resolve the account either as a customer/admin or as a seller.
    let account = await User.findById(accountId).lean();
    let role = normalizeRole(account?.role);
    let sellerId;

    if (!account) {
      const seller = await Seller.findById(accountId).lean();
      if (!seller) {
        return res.status(401).json({
          status: "fail",
          message: "invalid token or account not found"
        });
      }
      account = seller;
      role = normalizeRole(seller.role || "seller");
      sellerId = seller._id;
    }

    // Check if user has admin role
    if (role !== "admin") {
      return res.status(403).json({
        status: "fail",
        message: "Access denied. Admin role required."
      });
    }

    req.id = accountId;
    req.role = role;
    if (sellerId) {
      req.sellerId = sellerId;
    }

    next();
  } catch (err) {
    // Most common case: invalid/expired token
    return res.status(401).json({
      status: "fail",
      message: "invalid or expired token, please login again"
    });
  }
};

const verifySellerOrAdmin = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(400).json({
        status: "fail",
        message: "invalid token or please login again"
      });
    }

    const payload = await jwt.verify(token, process.env.jwtkey);
    const accountId = payload.id;

    // Try to resolve the account either as a customer/admin or as a seller.
    let account = await User.findById(accountId).lean();
    let role = normalizeRole(account?.role);
    let sellerId;

    if (!account) {
      const seller = await Seller.findById(accountId).lean();
      if (!seller) {
        return res.status(401).json({
          status: "fail",
          message: "invalid token or account not found"
        });
      }
      account = seller;
      role = normalizeRole(seller.role || "seller");
      sellerId = seller._id;
    }

    // Allow if user is admin
    if (role === "admin") {
      req.id = accountId;
      req.role = role;
      if (sellerId) {
        req.sellerId = sellerId;
      }
      return next();
    }

    // For sellers, check if they own the product
    if (role === "seller") {
      const productId = req.params.id;
      if (!productId) {
        return res.status(400).json({
          status: "fail",
          message: "Product ID is required"
        });
      }

      // Import Product here to avoid circular dependency
      const Product = (await import("../Models/ProductSchema.js")).default;
      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          status: "fail",
          message: "Product not found"
        });
      }

      // Check if the seller owns this product
      if (product.sellerid.toString() !== sellerId.toString()) {
        return res.status(403).json({
          status: "fail",
          message: "You can only delete your own products"
        });
      }

      req.id = accountId;
      req.role = role;
      req.sellerId = sellerId;
      return next();
    }

    // If neither admin nor seller
    return res.status(403).json({
      status: "fail",
      message: "Access denied. Admin or seller role required."
    });

  } catch (err) {
    return res.status(401).json({
      status: "fail",
      message: "invalid or expired token, please login again"
    });
  }
};

const verifySellerForOrder = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(400).json({
        status: "fail",
        message: "invalid token or please login again"
      });
    }

    const payload = await jwt.verify(token, process.env.jwtkey);
    const accountId = payload.id;

    // Try to resolve the account either as a customer/admin or as a seller.
    let account = await User.findById(accountId).lean();
    let role = normalizeRole(account?.role);
    let sellerId;

    if (!account) {
      const seller = await Seller.findById(accountId).lean();
      if (!seller) {
        return res.status(401).json({
          status: "fail",
          message: "invalid token or account not found"
        });
      }
      account = seller;
      role = normalizeRole(seller.role || "seller");
      sellerId = seller._id;
    }

    // Allow if user is admin
    if (role === "admin") {
      req.id = accountId;
      req.role = role;
      if (sellerId) {
        req.sellerId = sellerId;
      }
      return next();
    }

    // For sellers, check if they have items in the order and restrict status updates
    if (role === "seller") {
      const orderId = req.params.id;
      if (!orderId) {
        return res.status(400).json({
          status: "fail",
          message: "Order ID is required"
        });
      }

      // Import Order here to avoid circular dependency
      const Order = (await import("../Models/OrderSchema.js")).default;
      const order = await Order.findById(orderId);

      if (!order) {
        return res.status(404).json({
          status: "fail",
          message: "Order not found"
        });
      }

      // Check if the seller has any items in this order
      const hasSellerItems = order.items.some(item =>
        item.sellerId && item.sellerId.toString() === sellerId.toString()
      );

      if (!hasSellerItems) {
        return res.status(403).json({
          status: "fail",
          message: "Access denied. You can only manage orders containing your products."
        });
      }

      // Check if the requested status update is allowed for sellers
      const { status: requestedStatus } = req.body || {};
      if (requestedStatus) {
        const allowedSellerStatuses = ["confirmed", "cancelled_by_seller", "ready_for_pickup"];

        if (!allowedSellerStatuses.includes(requestedStatus)) {
          return res.status(403).json({
            status: "fail",
            message: "Sellers can only update orders to: confirmed, cancelled_by_seller, or ready_for_pickup. Further updates must be done by admin."
          });
        }
      }

      req.id = accountId;
      req.role = role;
      req.sellerId = sellerId;
      return next();
    }

    // If neither admin nor seller
    return res.status(403).json({
      status: "fail",
      message: "Access denied. Admin or seller role required."
    });

  } catch (err) {
    return res.status(401).json({
      status: "fail",
      message: "invalid or expired token, please login again"
    });
  }
};

const verifyAdminOrSeller = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(400).json({
        status: "fail",
        message: "invalid token or please login again"
      });
    }

    const payload = await jwt.verify(token, process.env.jwtkey);
    const accountId = payload.id;

    // Try to resolve the account either as a customer/admin or as a seller.
    let account = await User.findById(accountId).lean();
    let role = normalizeRole(account?.role);
    let sellerId;

    if (!account) {
      const seller = await Seller.findById(accountId).lean();
      if (!seller) {
        return res.status(401).json({
          status: "fail",
          message: "invalid token or account not found"
        });
      }
      account = seller;
      role = normalizeRole(seller.role || "seller");
      sellerId = seller._id;
    }

    // Allow if user is admin or seller
    if (role === "admin" || role === "seller") {
      req.id = accountId;
      req.role = role;
      if (sellerId) {
        req.sellerId = sellerId;
      }
      return next();
    }

    // If neither admin nor seller
    return res.status(403).json({
      status: "fail",
      message: "Access denied. Admin or seller role required."
    });

  } catch (err) {
    return res.status(401).json({
      status: "fail",
      message: "invalid or expired token, please login again"
    });
  }
};

// Optional authentication middleware - doesn't fail if no token, just sets req properties if authenticated
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    // If no token, just continue without setting auth properties
    if (!token) {
      return next();
    }

    const payload = await jwt.verify(token, process.env.jwtkey);
    const accountId = payload.id;

    // Try to resolve the account either as a customer/admin or as a seller.
    let account = await User.findById(accountId).lean();
    let role = normalizeRole(account?.role);
    let sellerId;

    if (!account) {
      const seller = await Seller.findById(accountId).lean();
      if (!seller) {
        // Invalid token but don't fail, just continue without auth
        return next();
      }
      account = seller;
      role = normalizeRole(seller.role || "seller");
      sellerId = seller._id;
    }

    // Set authentication properties if successful
    req.id = accountId;
    req.role = role;
    req.isAuthenticated = true;
    if (sellerId) {
      req.sellerId = sellerId;
    }

    next();
  } catch (err) {
    // Authentication failed but don't return error, just continue without auth

    next();
  }
};

export default verifyuser;
export { verifyAdmin, verifySellerOrAdmin, verifySellerForOrder, verifyAdminOrSeller, optionalAuth };