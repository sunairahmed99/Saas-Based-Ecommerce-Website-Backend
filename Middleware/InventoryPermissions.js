import Product from "../Models/ProductSchema.js";
import ProductVariation from "../Models/ProductVariationSchema.js";

// Middleware to check if seller owns the product
const checkProductOwnership = async (req, res, next) => {
  try {
    const sellerId = req.header("seller_id") || req.id;
    const { productId } = req.params;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.sellerid.toString() !== sellerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only manage your own products",
      });
    }

    // Attach product to request for use in controller
    req.product = product;
    next();
  } catch (error) {
    console.error("Error in product ownership check:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Middleware to check if seller owns the variation
const checkVariationOwnership = async (req, res, next) => {
  try {
    const sellerId = req.header("seller_id") || req.id;
    const { variationId } = req.params;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const variation = await ProductVariation.findById(variationId).populate("productId");
    if (!variation) {
      return res.status(404).json({
        success: false,
        message: "Product variation not found",
      });
    }

    if (variation.productId.sellerid.toString() !== sellerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only manage your own product variations",
      });
    }

    // Attach variation and product to request for use in controller
    req.variation = variation;
    req.product = variation.productId;
    next();
  } catch (error) {
    console.error("Error in variation ownership check:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Middleware to check seller access for inventory operations
const checkSellerAccess = async (req, res, next) => {
  try {
    const sellerId = req.header("seller_id") || req.id;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    // Attach sellerId to request for use in controller
    req.sellerId = sellerId;
    next();
  } catch (error) {
    console.error("Error in seller access check:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Admin-only middleware (for future use)
const checkAdminAccess = async (req, res, next) => {
  try {
    // For now, allowing all access (as per existing pattern)
    // In future, implement proper admin role checking
    next();
  } catch (error) {
    console.error("Error in admin access check:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export {
  checkProductOwnership,
  checkVariationOwnership,
  checkSellerAccess,
  checkAdminAccess,
};
