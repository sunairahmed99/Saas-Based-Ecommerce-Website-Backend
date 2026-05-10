import { uploadImageToCloudinary } from "../Middleware/Uploadmultiplemiddleware.js";
import Product from "../Models/ProductSchema.js";
import ProductVariation from "../Models/ProductVariationSchema.js";
import InventoryLog from "../Models/InventoryLogSchema.js";
import InventoryAlert from "../Models/InventoryAlertSchema.js";
import RecentlyViewedProduct from "../Models/RecentlyViewedProduct.js";
import { updateAllProductRatings, fixNegativeStock } from "../Utils/ProductRatingService.js";

const createProduct = async (req, res) => {
  try {
    const {
      _id, // Check if this is an update operation
      pname,
      pdescription,
      pprice,
      pdis,
      sku,
      stockType,
      totalStock,
      minStockAlert,
      warehouse,
      variations, // Array of variation objects
      catid,
      subcatid,
    } = req.body;

    // Check if this is an update operation
    if (_id) {
      return updateProduct(req, res);
    }


    // Validate required fields for NEW products only
    if (!pname || pname.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    if (!pdescription || pdescription.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product description is required"
      });
    }

    if (!pprice || isNaN(pprice) || pprice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid product price is required"
      });
    }

    if (!sku || sku.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "SKU is required"
      });
    }

    if (sku.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "SKU must be at least 3 characters long"
      });
    }

    // Check for image files for new products
    const files = req.files;
    if (!files?.pimage1?.[0]) {
      return res.status(400).json({
        success: false,
        message: "pimage1 is required"
      });
    }

    // Allow admin/super users to create products without binding to a seller.
    const sellerId =
      req.body?.sellerid ||
      req.body?.sellerId ||
      req.get("seller_id") ||
      req.id ||
      null;

    let img1 = null;
    let img2 = null;
    let img3 = null;

    if (files?.pimage1?.[0]) {
      const upload1 = await uploadImageToCloudinary(files.pimage1[0].buffer);
      img1 = upload1.secure_url;
    }
    uploadImageToCloudinary

    if (files?.pimage2?.[0]) {
      const upload2 = await uploadImageToCloudinary(files.pimage2[0].buffer);
      img2 = upload2.secure_url;
    }

    if (files?.pimage3?.[0]) {
      const upload3 = await uploadImageToCloudinary(files.pimage3[0].buffer);
      img3 = upload3.secure_url;
    }

    if (!img1) {
      return res.status(400).json({
        success: false,
        message: "pimage1 is required",
      });
    }

    // Validate SKU uniqueness
    if (sku) {
      const existingProduct = await Product.findOne({ sku: sku.trim() });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists. Please choose a unique SKU.",
        });
      }
    }

    // Calculate pricing with 10% admin commission
    const adminCommissionPercent = 10; // 10% admin commission
    const adminCommissionAmount = (pprice * adminCommissionPercent) / 100;
    const priceAfterAdminCommission = pprice - adminCommissionAmount; // actual price after commission

    const sellerDiscountPercent = parseFloat(req.body.discountPercent) || 0;
    const sellerDiscountAmount = (priceAfterAdminCommission * sellerDiscountPercent) / 100;
    const finalPrice = Math.max(priceAfterAdminCommission - sellerDiscountAmount, 0); // final discounted price

    // Determine stock type based on total stock
    const actualStockType = stockType || (totalStock > 0 ? "in_stock" : "out_of_stock");

    // Process sizes and colors - ensure they are arrays of individual values

    let psize = [];
    let pcolor = [];

    // Process sizes
    if (req.body.psize) {
      if (Array.isArray(req.body.psize)) {
        // Flatten any nested arrays and split any strings
        psize = req.body.psize.flatMap(item =>
          typeof item === 'string' ? item.split(',').map(s => s.trim()).filter(Boolean) : [item]
        ).filter(Boolean);
      } else if (typeof req.body.psize === 'string') {
        psize = req.body.psize.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Process colors
    if (req.body.pcolor) {
      if (Array.isArray(req.body.pcolor)) {
        // Flatten any nested arrays and split any strings
        pcolor = req.body.pcolor.flatMap(item =>
          typeof item === 'string' ? item.split(',').map(c => c.trim()).filter(Boolean) : [item]
        ).filter(Boolean);
      } else if (typeof req.body.pcolor === 'string') {
        pcolor = req.body.pcolor.split(',').map(c => c.trim()).filter(Boolean);
      }
    }


    // Ensure arrays contain only strings and no empty values
    psize = psize.filter(item => typeof item === 'string' && item.trim().length > 0).map(s => s.trim());
    pcolor = pcolor.filter(item => typeof item === 'string' && item.trim().length > 0).map(c => c.trim());


    const newProduct = new Product({
      pname,
      pdescription,
      pprice: pprice, // Base price entered by seller
      pactualprice: priceAfterAdminCommission, // Price after 10% admin commission
      pdis: sellerDiscountPercent, // Seller discount percentage
      prodisprice: finalPrice, // Final price after discount
      sku: sku ? sku.trim() : null,
      stockType: actualStockType,
      totalStock: totalStock || 0,
      minStockAlert: minStockAlert || 10,
      warehouse: warehouse || null,
      psize,
      pcolor,
      catid,
      subcatid,
      sellerid: sellerId,
      pimage1: img1,
      pimage2: img2,
      pimage3: img3,
    });

    const savedProduct = await newProduct.save();

    // Create inventory log for initial stock
    if (sellerId) {
      await InventoryLog.create({
        productId: savedProduct._id,
        sellerId: sellerId,
        actionType: "initial_stock",
        previousStock: 0,
        newStock: totalStock || 0,
        quantityChanged: totalStock || 0,
        performedBy: {
          userId: sellerId,
          userType: "seller",
          name: "Seller" // This could be fetched from seller model
        },
        notes: "Initial product stock setup",
      });
    }

    // Create product variations if provided
    let savedVariations = [];
    if (variations && Array.isArray(variations) && variations.length > 0) {
      const variationPromises = variations.map(async (variation) => {
        // Validate variation SKU uniqueness
        if (variation.variationSku) {
          const existingVariation = await ProductVariation.findOne({
            variationSku: variation.variationSku.trim()
          });
          if (existingVariation) {
            throw new Error(`Variation SKU ${variation.variationSku} already exists`);
          }
        }

        const newVariation = new ProductVariation({
          productId: savedProduct._id,
          size: variation.size || null,
          color: variation.color || null,
          variationStock: variation.variationStock || 0,
          variationSku: variation.variationSku ? variation.variationSku.trim() : null,
          variationPrice: variation.variationPrice || null,
          variationDiscountPrice: variation.variationDiscountPrice || null,
          variationImages: variation.variationImages || [],
        });

        return await newVariation.save();
      });

      savedVariations = await Promise.all(variationPromises);

      // Create inventory logs for variations
      if (sellerId) {
        const variationLogPromises = savedVariations.map(variation =>
          InventoryLog.create({
            productId: savedProduct._id,
            variationId: variation._id,
            sellerId: sellerId,
            actionType: "initial_stock",
            previousStock: 0,
            newStock: variation.variationStock,
            quantityChanged: variation.variationStock,
            performedBy: {
              userId: sellerId,
              userType: "seller",
              name: "Seller"
            },
            variationDetails: {
              size: variation.size,
              color: variation.color,
              variationSku: variation.variationSku,
            },
            notes: "Initial variation stock setup",
          })
        );
        await Promise.all(variationLogPromises);
      }
    }

    // Check for low stock alerts
    await checkAndCreateLowStockAlerts(savedProduct, savedVariations, sellerId);

    res.status(200).json({
      success: true,
      message: "Product created successfully",
      data: {
        product: savedProduct,
        variations: savedVariations,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const {
      _id,
      pname,
      pdescription,
      pprice,
      pdis,
      sku,
      stockType,
      totalStock,
      minStockAlert,
      warehouse,
      variations, // Array of variation objects
      catid,
      subcatid,
    } = req.body;

    // Find existing product
    const existingProduct = await Product.findById(_id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check if seller is updating their own product (only for sellers)
    const currentUserSellerId = req.get('seller_id') || req.id;
    if (currentUserSellerId && existingProduct.sellerid.toString() !== currentUserSellerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own products"
      });
    }

    // Use the product's sellerId for inventory alerts (not the current user's sellerId)
    const productSellerId = existingProduct.sellerid;

    // Validate required fields for updates
    if (!pname || pname.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    if (!pdescription || pdescription.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product description is required"
      });
    }

    if (!pprice || isNaN(pprice) || pprice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid product price is required"
      });
    }

    if (!sku || sku.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "SKU is required"
      });
    }

    if (sku.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "SKU must be at least 3 characters long"
      });
    }

    // Check SKU uniqueness (exclude current product)
    const existingProductWithSKU = await Product.findOne({
      sku: sku.trim(),
      _id: { $ne: _id }
    });
    if (existingProductWithSKU) {
      return res.status(400).json({
        success: false,
        message: "SKU already exists. Please choose a unique SKU."
      });
    }

    const files = req.files;

    // Handle image uploads - only upload if new files provided
    let img1 = existingProduct.pimage1;
    let img2 = existingProduct.pimage2;
    let img3 = existingProduct.pimage3;

    if (files?.pimage1?.[0]) {
      const upload1 = await uploadImageToCloudinary(files.pimage1[0].buffer);
      img1 = upload1.secure_url;
    }

    if (files?.pimage2?.[0]) {
      const upload2 = await uploadImageToCloudinary(files.pimage2[0].buffer);
      img2 = upload2.secure_url;
    }

    if (files?.pimage3?.[0]) {
      const upload3 = await uploadImageToCloudinary(files.pimage3[0].buffer);
      img3 = upload3.secure_url;
    }

    // Calculate pricing with 10% admin commission
    const adminCommissionPercent = 10; // 10% admin commission
    const adminCommissionAmount = (pprice * adminCommissionPercent) / 100;
    const priceAfterAdminCommission = pprice - adminCommissionAmount; // actual price after commission

    const sellerDiscountPercent = parseFloat(req.body.discountPercent) || 0;
    const sellerDiscountAmount = (priceAfterAdminCommission * sellerDiscountPercent) / 100;
    const finalPrice = Math.max(priceAfterAdminCommission - sellerDiscountAmount, 0); // final discounted price

    // Determine stock type based on total stock
    const actualStockType = stockType || (totalStock > 0 ? "in_stock" : "out_of_stock");

    // Process sizes and colors - ensure they are arrays of individual values
    let psize = existingProduct.psize || [];
    let pcolor = existingProduct.pcolor || [];

    if (req.body.psize !== undefined) {
      if (Array.isArray(req.body.psize)) {
        psize = req.body.psize.flatMap(item =>
          typeof item === 'string' ? item.split(',').map(s => s.trim()).filter(Boolean) : [item]
        ).filter(Boolean);
      } else if (typeof req.body.psize === 'string') {
        psize = req.body.psize.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (req.body.pcolor !== undefined) {
      if (Array.isArray(req.body.pcolor)) {
        pcolor = req.body.pcolor.flatMap(item =>
          typeof item === 'string' ? item.split(',').map(c => c.trim()).filter(Boolean) : [item]
        ).filter(Boolean);
      } else if (typeof req.body.pcolor === 'string') {
        pcolor = req.body.pcolor.split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    // Ensure arrays contain only strings and no empty values
    psize = psize.filter(item => typeof item === 'string' && item.trim().length > 0).map(s => s.trim());
    pcolor = pcolor.filter(item => typeof item === 'string' && item.trim().length > 0).map(c => c.trim());

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      _id,
      {
        pname,
        pdescription,
        pprice: pprice, // Base price entered by seller
        pactualprice: priceAfterAdminCommission, // Price after 10% admin commission
        pdis: sellerDiscountPercent, // Seller discount percentage
        prodisprice: finalPrice, // Final price after discount
        sku: sku ? sku.trim() : null,
        stockType: actualStockType,
        totalStock: totalStock || 0,
        minStockAlert: minStockAlert || 10,
        warehouse: warehouse || null,
        psize,
        pcolor,
        catid,
        subcatid,
        pimage1: img1,
        pimage2: img2,
        pimage3: img3,
      },
      { new: true, runValidators: true }
    ).populate("sellerid", "name")
     .populate("catid", "name Image")
     .populate("subcatid", "name Image");

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found after update"
      });
    }

    // Handle variations update if provided
    if (variations && Array.isArray(variations) && variations.length > 0) {
      // Remove existing variations
      await ProductVariation.deleteMany({ productId: _id });

      // Create new variations
      const savedVariations = [];
      for (const variation of variations) {
        const newVariation = new ProductVariation({
          productId: _id,
          size: variation.size || null,
          color: variation.color || null,
          variationStock: variation.variationStock || 0,
          variationSku: variation.variationSku ? variation.variationSku.trim() : null,
          variationPrice: variation.variationPrice || null,
          variationDiscountPrice: variation.variationDiscountPrice || null,
          variationImages: variation.variationImages || [],
        });
        const savedVariation = await newVariation.save();
        savedVariations.push(savedVariation);
      }

      // Check for low stock alerts for variations
      await checkAndCreateLowStockAlerts(updatedProduct, savedVariations, productSellerId);
    } else {
      // Check for low stock alerts for main product
      await checkAndCreateLowStockAlerts(updatedProduct, [], productSellerId);
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: {
        product: updatedProduct,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Delete product (admin/seller)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getAllProducts = async (req, res) => {
  try {
  

   const products = await Product.find()
  .sort({ views: -1, createdAt: -1 })
  .populate("sellerid", "name email")
  .populate("catid", "name Image")
  .populate("subcatid", "name Image");

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });

  } catch (error) {
    console.error("Error fetching seller products:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


const getSellerProducts = async (req, res) => {
  try {
  
    const sellerid = req.get('seller_id');

    const products = await Product.find({sellerid:sellerid})
  .sort({ createdAt: -1 })
  .populate("sellerid", "name")
  .populate("catid", "name Image")
  .populate("subcatid", "name Image");


    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });

  } catch (error) {
    console.error("Error fetching seller products:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get product by ID and increment its views (only once per user/device)
const getProductAndIncrementViews = async (req, res) => {
  try {
    const { id } = req.params;
    const rawUserId =
      (req.body && req.body.userId) || (req.headers && req.headers["user_id"]);
    const deviceId =
      (req.body && req.body.deviceId) || (req.headers && req.headers["device_id"]);

    let shouldIncrement = true;

    // Check if this user/device has already viewed this product
    if (rawUserId && typeof rawUserId === "string" && rawUserId.length === 24) {
      const existing = await RecentlyViewedProduct.findOne({
        userId: rawUserId,
        productId: id,
      }).lean();
      if (existing) {
        shouldIncrement = false;
      }
    } else if (deviceId) {
      const existing = await RecentlyViewedProduct.findOne({
        deviceId,
        productId: id,
      }).lean();
      if (existing) {
        shouldIncrement = false;
      }
    }

    let product;
    try {
      if (shouldIncrement) {
        product = await Product.findByIdAndUpdate(
          id,
          { $inc: { views: 1 } },
          { new: true }
        )
          .populate("sellerid", "name")
          .populate("catid", "name Image")
          .populate("subcatid", "name Image");
      } else {
        product = await Product.findById(id)
          .populate("sellerid", "name")
          .populate("catid", "name Image")
          .populate("subcatid", "name Image");
      }
    } catch (dbError) {
      console.error("Database error in getProductAndIncrementViews:", dbError);
      return res.status(500).json({
        success: false,
        message: "Database error occurred",
        error: dbError.message,
      });
    }

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    // Log recently viewed entry only once
    if (shouldIncrement) {
      try {
        if (
          rawUserId &&
          typeof rawUserId === "string" &&
          rawUserId.length === 24
        ) {
          await RecentlyViewedProduct.create({ userId: rawUserId, productId: id });
        } else if (deviceId) {
          await RecentlyViewedProduct.create({ deviceId, productId: id });
        }
      } catch (recentlyViewedError) {
        // Log the error but don't fail the entire request

      }
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
      });
  }
};

// Get top 10 trending products (highest views)
const getTrendingProducts = async (req, res) => {
  try {
    const products = await Product.find({ pstatus: "active" })
      .sort({ views: -1 })
      .limit(10)
      .populate("sellerid", "name")
      .populate("catid", "name Image")
      .populate("subcatid", "name Image");
    return res.status(200).json({ success: true, data: products });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

// Get "For You" personalized products for given user (recently viewed)
const getForYouProducts = async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required." });
    }
    // Find latest 30, group on productId for unique, pick top 10
    let history = await RecentlyViewedProduct.find({ userId })
      .sort({ viewedAt: -1 })
      .limit(30)
      .populate({
        path: "productId",
        match: { pstatus: "active" }, // Only populate active products
        populate: [
          { path: "sellerid", select: "name" },
          { path: "catid", select: "name Image" },
          { path: "subcatid", select: "name Image" }
        ]
      });
    // Unique by productId (only latest 1 per product, max 10)
    // Filter out entries where productId is null (inactive products)
    const validHistory = history.filter(entry => entry.productId);
    const unique = [];
    const seen = new Set();
    for (const entry of validHistory) {
      if (!seen.has(entry.productId._id.toString())) {
        unique.push(entry.productId);
        seen.add(entry.productId._id.toString());
      }
      if (unique.length >= 10) break;
    }
    res.status(200).json({ success: true, data: unique });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { pstatus } = req.body;

    // Validate status enum
    const validStatuses = ["active", "inactive", "outofstock", "pending", "delivered"];
    if (!validStatuses.includes(pstatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { pstatus },
      { new: true, runValidators: true }
    )
      .populate("sellerid", "name email")
      .populate("catid", "name Image")
      .populate("subcatid", "name Image");

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product status updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const products = await Product.find({
      catid: categoryId,
      pstatus: "active"
    })
    .sort({ createdAt: -1 })
    .populate("sellerid", "name email")
    .populate("catid", "name Image")
    .populate("subcatid", "name Image");

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });

  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get products by subcategory
const getProductsBySubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;

    const products = await Product.find({
      subcatid: subcategoryId,
      pstatus: "active"
    })
    .sort({ createdAt: -1 })
    .populate("sellerid", "name email")
    .populate("catid", "name Image")
    .populate("subcatid", "name Image");

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });

  } catch (error) {
    console.error("Error fetching products by subcategory:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get products by seller
const getProductsBySeller = async (req, res) => {
  try {
    const { sellerId } = req.params;

    const products = await Product.find({
      sellerid: sellerId,
      pstatus: "active"
    })
    .sort({ createdAt: -1 })
    .populate("sellerid", "name email shopName")
    .populate("catid", "name Image")
    .populate("subcatid", "name Image");

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });

  } catch (error) {
    console.error("Error fetching products by seller:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Search products by query (product name, description, category)
const searchProducts = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const searchRegex = new RegExp(query.trim(), 'i'); // Case-insensitive regex

    const products = await Product.find({
      pstatus: "active",
      $or: [
        { pname: searchRegex },
        { pdescription: searchRegex }
      ]
    })
    .sort({ views: -1, createdAt: -1 })
    .populate("sellerid", "name email shopName")
    .populate({
      path: "catid",
      select: "name Image",
      match: { name: searchRegex } // Also search in category names
    })
    .populate("subcatid", "name Image");

    // Filter out products where category didn't match (populate with match returns null for catid if no match)
    const filteredProducts = products.filter(product =>
      product.catid !== null ||
      product.pname.match(searchRegex) ||
      product.pdescription.match(searchRegex)
    );

    res.status(200).json({
      success: true,
      message: "Search completed successfully",
      count: filteredProducts.length,
      data: filteredProducts,
      query: query.trim()
    });

  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Helper function to check and create low stock alerts
const checkAndCreateLowStockAlerts = async (product, variations = [], sellerId) => {
  const alerts = [];

  // Check main product stock
  if (product.totalStock <= product.minStockAlert && product.totalStock > 0) {
    alerts.push({
      productId: product._id,
      sellerId: sellerId,
      alertType: "low_stock",
      currentStock: product.totalStock,
      minStockThreshold: product.minStockAlert,
      message: `${product.pname} (${product.sku}) is running low on stock (${product.totalStock} remaining)`,
      productName: product.pname,
      productSku: product.sku,
    });
  } else if (product.totalStock === 0) {
    alerts.push({
      productId: product._id,
      sellerId: sellerId,
      alertType: "out_of_stock",
      currentStock: 0,
      minStockThreshold: product.minStockAlert,
      message: `${product.pname} (${product.sku}) is out of stock`,
      productName: product.pname,
      productSku: product.sku,
    });
  }

  // Check variation stocks
  for (const variation of variations) {
    const threshold = product.minStockAlert; // Use product threshold for variations
    if (variation.variationStock <= threshold && variation.variationStock > 0) {
      alerts.push({
        productId: product._id,
        variationId: variation._id,
        sellerId: sellerId,
        alertType: "low_stock",
        currentStock: variation.variationStock,
        minStockThreshold: threshold,
        message: `${product.pname} (${variation.size || ''} ${variation.color || ''}) is running low on stock (${variation.variationStock} remaining)`,
        productName: product.pname,
        productSku: product.sku,
        variationDetails: {
          size: variation.size,
          color: variation.color,
          variationSku: variation.variationSku,
        },
      });
    } else if (variation.variationStock === 0) {
      alerts.push({
        productId: product._id,
        variationId: variation._id,
        sellerId: sellerId,
        alertType: "out_of_stock",
        currentStock: 0,
        minStockThreshold: threshold,
        message: `${product.pname} (${variation.size || ''} ${variation.color || ''}) is out of stock`,
        productName: product.pname,
        productSku: product.sku,
        variationDetails: {
          size: variation.size,
          color: variation.color,
          variationSku: variation.variationSku,
        },
      });
    }
  }

  // Create alerts if any exist
  if (alerts.length > 0) {
    await InventoryAlert.insertMany(alerts);
  }
};

// Admin: Update all product ratings (manual trigger)
const updateAllProductRatingsAdmin = async (req, res) => {
  try {
    await updateAllProductRatings();
    res.status(200).json({
      success: true,
      message: "All product ratings updated successfully"
    });
  } catch (error) {
    console.error('Error in admin rating update:', error);
    res.status(500).json({
      success: false,
      message: "Error updating product ratings",
      error: error.message
    });
  }
};

// Admin: Fix negative stock values
const fixNegativeStockAdmin = async (req, res) => {
  try {
    const fixedCount = await fixNegativeStock();
    res.status(200).json({
      success: true,
      message: `Fixed negative stock for ${fixedCount} products`
    });
  } catch (error) {
    console.error('Error fixing negative stock:', error);
    res.status(500).json({
      success: false,
      message: "Error fixing negative stock",
      error: error.message
    });
  }
};

const toggleFeaturedStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    product.isFeatured = !product.isFeatured;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product is now ${product.isFeatured ? 'featured' : 'unfeatured'}`,
      data: product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

const getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true, pstatus: "active" })
      .sort({ createdAt: -1 })
      .limit(30) // Limit to 30 featured products
      .populate("sellerid", "name")
      .populate("catid", "name Image")
      .populate("subcatid", "name Image");

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

const getLatestProducts = async (req, res) => {
  try {
    const products = await Product.find({ pstatus: "active" })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("sellerid", "name")
      .populate("catid", "name Image")
      .populate("subcatid", "name Image");
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

export {
  createProduct,
  updateProduct,
  getAllProducts,
  getSellerProducts,
  getProductAndIncrementViews,
  getTrendingProducts,
  getForYouProducts,
  updateProductStatus,
  deleteProduct,
  getProductsByCategory,
  getProductsBySubcategory,
  getProductsBySeller,
  searchProducts,
  updateAllProductRatingsAdmin,
  fixNegativeStockAdmin,
  toggleFeaturedStatus,
  getFeaturedProducts,
  getLatestProducts
}
