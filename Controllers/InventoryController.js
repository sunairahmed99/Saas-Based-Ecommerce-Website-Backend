import mongoose from "mongoose";
import Product from "../Models/ProductSchema.js";
import ProductVariation from "../Models/ProductVariationSchema.js";
import InventoryLog from "../Models/InventoryLogSchema.js";
import InventoryAlert from "../Models/InventoryAlertSchema.js";
import Warehouse from "../Models/WarehouseSchema.js";

// Helper function to check and create low stock alerts
const checkAndCreateLowStockAlerts = async (product, variations = [], sellerId) => {
  const alerts = [];

  // Check main product stock
  if (product.totalStock <= product.minStockAlert && product.totalStock > 0) {
    const existingAlert = await InventoryAlert.findOne({
      productId: product._id,
      variationId: null,
      alertType: "low_stock",
      status: "active"
    });

    if (!existingAlert) {
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
    }
  } else if (product.totalStock === 0) {
    const existingAlert = await InventoryAlert.findOne({
      productId: product._id,
      variationId: null,
      alertType: "out_of_stock",
      status: "active"
    });

    if (!existingAlert) {
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
  }

  // Check variation stocks
  for (const variation of variations) {
    const threshold = product.minStockAlert;
    if (variation.variationStock <= threshold && variation.variationStock > 0) {
      const existingAlert = await InventoryAlert.findOne({
        productId: product._id,
        variationId: variation._id,
        alertType: "low_stock",
        status: "active"
      });

      if (!existingAlert) {
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
      }
    } else if (variation.variationStock === 0) {
      const existingAlert = await InventoryAlert.findOne({
        productId: product._id,
        variationId: variation._id,
        alertType: "out_of_stock",
        status: "active"
      });

      if (!existingAlert) {
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
  }

  // Create alerts if any exist
  if (alerts.length > 0) {
    await InventoryAlert.insertMany(alerts);
  }
};

// Update product stock (manual adjustment)
const updateProductStock = async (req, res) => {
  try {
    const { productId } = req.params;
    const { newStock, reason, notes, performedBy } = req.body;

    const sellerId = req.get("seller_id") || req.sellerId || req.id;
    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const product = await Product.findOne({ _id: productId, sellerid: sellerId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or access denied",
      });
    }

    const previousStock = product.totalStock || 0;
    const quantityChanged = newStock - previousStock;

    // Update product stock using findOneAndUpdate to avoid validation issues
    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      {
        $set: {
          totalStock: newStock,
          stockType: newStock > 0 ? "in_stock" : "out_of_stock"
        }
      },
      { new: true, runValidators: false } // Don't run full validation to avoid SKU requirement
    );

    // Create inventory log
    await InventoryLog.create({
      productId: updatedProduct._id,
      sellerId: sellerId,
      actionType: quantityChanged > 0 ? "manual_add" : "manual_adjust",
      previousStock,
      newStock,
      quantityChanged,
      reason,
      notes,
      performedBy: {
        userId: performedBy?.userId || sellerId,
        userType: performedBy?.userType || "seller",
        name: performedBy?.name || "Seller",
      },
    });

    // Check for alerts
    const variations = await ProductVariation.find({ productId: updatedProduct._id, isActive: true });
    await checkAndCreateLowStockAlerts(updatedProduct, variations, sellerId);

    res.status(200).json({
      success: true,
      message: "Product stock updated successfully",
      data: {
        productId: updatedProduct._id,
        previousStock,
        newStock,
        quantityChanged,
      },
    });
  } catch (error) {
    console.error("Error updating product stock:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Update variation stock
const updateVariationStock = async (req, res) => {
  try {
    const { variationId } = req.params;
    const { newStock, reason, notes, performedBy } = req.body;

    const sellerId = req.get("seller_id") || req.sellerId || req.id;
    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const variation = await ProductVariation.findById(variationId).populate("productId");
    if (!variation || variation.productId.sellerid.toString() !== sellerId.toString()) {
      return res.status(404).json({
        success: false,
        message: "Variation not found or access denied",
      });
    }

    const previousStock = variation.variationStock;
    const quantityChanged = newStock - previousStock;

    // Update variation stock
    variation.variationStock = newStock;
    await variation.save();

    // Update main product stock if needed (sum of all variations)
    const allVariations = await ProductVariation.find({
      productId: variation.productId._id,
      isActive: true
    });

    const totalVariationStock = allVariations.reduce((sum, v) => sum + v.variationStock, 0);
    await Product.findByIdAndUpdate(variation.productId._id, {
      totalStock: totalVariationStock,
      stockType: totalVariationStock > 0 ? "in_stock" : "out_of_stock",
    });

    // Create inventory log
    await InventoryLog.create({
      productId: variation.productId._id,
      variationId: variation._id,
      sellerId: sellerId,
      actionType: quantityChanged > 0 ? "manual_add" : "manual_adjust",
      previousStock,
      newStock,
      quantityChanged,
      reason,
      notes,
      performedBy: {
        userId: performedBy?.userId || sellerId,
        userType: performedBy?.userType || "seller",
        name: performedBy?.name || "Seller",
      },
      variationDetails: {
        size: variation.size,
        color: variation.color,
        variationSku: variation.variationSku,
      },
    });

    // Check for alerts
    const product = await Product.findById(variation.productId._id);
    await checkAndCreateLowStockAlerts(product, allVariations, sellerId);

    res.status(200).json({
      success: true,
      message: "Variation stock updated successfully",
      data: {
        variationId: variation._id,
        previousStock,
        newStock,
        quantityChanged,
      },
    });
  } catch (error) {
    console.error("Error updating variation stock:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Bulk stock update via CSV
const bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { sku, variationSku, newStock, reason }

    const sellerId = req.get("seller_id") || req.sellerId || req.id;
    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        let product, variation;

        if (update.variationSku) {
          // Update variation stock
          variation = await ProductVariation.findOne({
            variationSku: update.variationSku.trim(),
          }).populate("productId");

          if (!variation || variation.productId.sellerid.toString() !== sellerId.toString()) {
            errors.push({
              sku: update.sku,
              variationSku: update.variationSku,
              error: "Variation not found or access denied",
            });
            continue;
          }

          const previousStock = variation.variationStock;
          variation.variationStock = update.newStock;
          await variation.save();

          // Update main product stock
          const allVariations = await ProductVariation.find({
            productId: variation.productId._id,
            isActive: true,
          });

          const totalVariationStock = allVariations.reduce((sum, v) => sum + v.variationStock, 0);
          await Product.findByIdAndUpdate(variation.productId._id, {
            totalStock: totalVariationStock,
            stockType: totalVariationStock > 0 ? "in_stock" : "out_of_stock",
          });

          // Create log
          await InventoryLog.create({
            productId: variation.productId._id,
            variationId: variation._id,
            sellerId: sellerId,
            actionType: "bulk_update",
            previousStock,
            newStock: update.newStock,
            quantityChanged: update.newStock - previousStock,
            reason: update.reason,
            performedBy: {
              userId: sellerId,
              userType: "seller",
              name: "Seller",
            },
            variationDetails: {
              size: variation.size,
              color: variation.color,
              variationSku: variation.variationSku,
            },
          });

          results.push({
            sku: update.sku,
            variationSku: update.variationSku,
            previousStock,
            newStock: update.newStock,
            status: "updated",
          });
        } else if (update.sku) {
          // Update main product stock
          product = await Product.findOne({
            sku: update.sku.trim(),
            sellerid: sellerId,
          });

          if (!product) {
            errors.push({
              sku: update.sku,
              error: "Product not found or access denied",
            });
            continue;
          }

          const previousStock = product.totalStock || 0;

          // Update product stock using findOneAndUpdate to avoid validation issues
          const updatedProduct = await Product.findByIdAndUpdate(
            product._id,
            {
              $set: {
                totalStock: update.newStock,
                stockType: update.newStock > 0 ? "in_stock" : "out_of_stock"
              }
            },
            { new: true, runValidators: false }
          );

          // Create log
          await InventoryLog.create({
            productId: updatedProduct._id,
            sellerId: sellerId,
            actionType: "bulk_update",
            previousStock,
            newStock: update.newStock,
            quantityChanged: update.newStock - previousStock,
            reason: update.reason,
            performedBy: {
              userId: sellerId,
              userType: "seller",
              name: "Seller",
            },
          });

          results.push({
            sku: update.sku,
            previousStock,
            newStock: update.newStock,
            status: "updated",
          });
        }
      } catch (error) {
        errors.push({
          sku: update.sku,
          variationSku: update.variationSku,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Bulk stock update completed",
      data: {
        results,
        errors,
        totalProcessed: updates.length,
        successful: results.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk stock update:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get inventory logs for a seller
const getInventoryLogs = async (req, res) => {
  try {
    const sellerId = req.get("seller_id") || req.sellerId || req.id;
    const { page = 1, limit = 20, productId, actionType, startDate, endDate } = req.query;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const query = { sellerId };

    if (productId) query.productId = productId;
    if (actionType) query.actionType = actionType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await InventoryLog.find(query)
      .populate("productId", "pname sku")
      .populate("variationId", "size color variationSku")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await InventoryLog.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Inventory logs retrieved successfully",
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalLogs: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching inventory logs:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get inventory alerts for a seller
const getInventoryAlerts = async (req, res) => {
  try {
    const sellerId = req.get("seller_id") || req.sellerId || req.id;
    const { status = "active", priority, page = 1, limit = 20 } = req.query;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const query = { sellerId };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const alerts = await InventoryAlert.find(query)
      .populate("productId", "pname sku totalStock minStockAlert")
      .populate("variationId", "size color variationSku variationStock")
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await InventoryAlert.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Inventory alerts retrieved successfully",
      data: {
        alerts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalAlerts: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching inventory alerts:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Acknowledge inventory alert
const acknowledgeAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const sellerId = req.get("seller_id") || req.sellerId || req.id;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const alert = await InventoryAlert.findOneAndUpdate(
      { _id: alertId, sellerId },
      {
        status: "acknowledged",
        resolvedAt: new Date(),
        resolvedBy: {
          userId: sellerId,
          userType: "seller",
          name: "Seller",
        },
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Alert acknowledged successfully",
      data: alert,
    });
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Generate business summary report
const generateBusinessSummary = async (sellerId, periodDays) => {
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Total products
  const totalProducts = await Product.countDocuments({ sellerid: sellerId });

  // Total revenue
  const revenueData = await InventoryLog.aggregate([
    {
      $match: {
        sellerId: new mongoose.Types.ObjectId(sellerId),
        actionType: "order_placed",
        createdAt: { $gte: startDate },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $unwind: "$product",
    },
    {
      $group: {
        _id: null,
        totalRevenue: {
          $sum: {
            $multiply: [
              { $abs: "$quantityChanged" },
              { $subtract: ["$product.prodisprice", "$product.pactualprice"] }
            ]
          }
        },
        totalOrders: { $addToSet: "$orderId" },
        totalQuantity: { $sum: { $abs: "$quantityChanged" } },
      },
    },
  ]);

  // Stock levels
  const stockData = await Product.aggregate([
    {
      $match: { sellerid: new mongoose.Types.ObjectId(sellerId) },
    },
    {
      $group: {
        _id: null,
        totalStock: { $sum: "$totalStock" },
        lowStock: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ["$totalStock", 0] }, { $lte: ["$totalStock", "$minStockAlert"] }] },
              1,
              0,
            ],
          },
        },
        outOfStock: {
          $sum: {
            $cond: [{ $eq: ["$totalStock", 0] }, 1, 0],
          },
        },
      },
    },
  ]);

  // Recent alerts
  const recentAlerts = await InventoryAlert.find({
    sellerId: sellerId,
    createdAt: { $gte: startDate },
  }).countDocuments();

  return {
    period: `${periodDays} days`,
    overview: {
      totalProducts,
      totalRevenue: revenueData[0]?.totalRevenue || 0,
      totalOrders: revenueData[0]?.totalOrders?.length || 0,
      totalQuantitySold: revenueData[0]?.totalQuantity || 0,
      averageOrderValue: revenueData[0]?.totalOrders?.length
        ? (revenueData[0].totalRevenue || 0) / revenueData[0].totalOrders.length
        : 0,
    },
    inventory: {
      totalStock: stockData[0]?.totalStock || 0,
      lowStockItems: stockData[0]?.lowStock || 0,
      outOfStockItems: stockData[0]?.outOfStock || 0,
    },
    alerts: {
      recentAlerts,
    },
  };
};

// Helper function to generate report data
const generateReportData = async (sellerId, reportType, periodDays = 30) => {
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  let pipeline = [];

  switch (reportType) {
    case "summary":
      return await generateBusinessSummary(sellerId, periodDays);

    case "sales_report":
      // Sales report with revenue, orders, and trends
      pipeline = [
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
            actionType: "order_placed",
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            totalRevenue: { $sum: { $multiply: ["$quantityChanged", "$productPrice"] } },
            totalOrders: { $addToSet: "$orderId" },
            totalQuantity: { $sum: { $abs: "$quantityChanged" } },
          },
        },
        {
          $project: {
            date: "$_id",
            revenue: "$totalRevenue",
            orders: { $size: "$totalOrders" },
            quantity: "$totalQuantity",
          },
        },
        { $sort: { date: 1 } },
      ];
      break;

    case "profit_report":
      // Profit analysis report
      pipeline = [
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
            actionType: "order_placed",
            createdAt: { $gte: startDate },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $group: {
            _id: "$productId",
            productName: { $first: "$product.pname" },
            sku: { $first: "$product.sku" },
            revenue: {
              $sum: {
                $multiply: [
                  { $abs: "$quantityChanged" },
                  { $subtract: ["$product.prodisprice", "$product.pactualprice"] }
                ]
              }
            },
            cost: {
              $sum: {
                $multiply: [
                  { $abs: "$quantityChanged" },
                  "$product.pactualprice"
                ]
              }
            },
            unitsSold: { $sum: { $abs: "$quantityChanged" } },
          },
        },
        {
          $project: {
            productId: "$_id",
            productName: 1,
            sku: 1,
            revenue: 1,
            cost: 1,
            profit: { $subtract: ["$revenue", "$cost"] },
            profitMargin: {
              $cond: {
                if: { $eq: ["$revenue", 0] },
                then: 0,
                else: { $multiply: [{ $divide: [{ $subtract: ["$revenue", "$cost"] }, "$revenue"] }, 100] }
              }
            },
            unitsSold: 1,
          },
        },
        { $sort: { profit: -1 } },
      ];
      break;

    case "order_trends":
      // Order trends and patterns
      pipeline = [
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
            actionType: "order_placed",
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
              hour: { $hour: "$createdAt" },
            },
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: { $multiply: ["$quantityChanged", "$productPrice"] } },
            totalQuantity: { $sum: { $abs: "$quantityChanged" } },
          },
        },
        {
          $project: {
            date: {
              $dateFromParts: {
                year: "$_id.year",
                month: "$_id.month",
                day: "$_id.day",
                hour: "$_id.hour"
              }
            },
            orders: "$totalOrders",
            revenue: "$totalRevenue",
            quantity: "$totalQuantity",
          },
        },
        { $sort: { date: 1 } },
      ];
      break;

    case "best_products":
      // Best performing products
      pipeline = [
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
            actionType: "order_placed",
            createdAt: { $gte: startDate },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $group: {
            _id: "$productId",
            productName: { $first: "$product.pname" },
            sku: { $first: "$product.sku" },
            category: { $first: "$product.catid" },
            totalSold: { $sum: { $abs: "$quantityChanged" } },
            totalRevenue: {
              $sum: {
                $multiply: [
                  { $abs: "$quantityChanged" },
                  { $subtract: ["$product.prodisprice", "$product.pactualprice"] }
                ]
              }
            },
            avgPrice: { $avg: "$product.prodisprice" },
          },
        },
        {
          $project: {
            productId: "$_id",
            productName: 1,
            sku: 1,
            category: 1,
            totalSold: 1,
            totalRevenue: 1,
            avgPrice: 1,
            performance: {
              $add: [
                { $multiply: ["$totalSold", 0.4] },
                { $multiply: ["$totalRevenue", 0.6] }
              ]
            },
          },
        },
        { $sort: { performance: -1 } },
        { $limit: 20 },
      ];
      break;

    case "worst_products":
      // Worst performing products
      pipeline = [
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
            actionType: "order_placed",
            createdAt: { $gte: startDate },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $group: {
            _id: "$productId",
            productName: { $first: "$product.pname" },
            sku: { $first: "$product.sku" },
            category: { $first: "$product.catid" },
            totalSold: { $sum: { $abs: "$quantityChanged" } },
            totalRevenue: {
              $sum: {
                $multiply: [
                  { $abs: "$quantityChanged" },
                  { $subtract: ["$product.prodisprice", "$product.pactualprice"] }
                ]
              }
            },
            avgPrice: { $avg: "$product.prodisprice" },
            currentStock: { $first: "$product.totalStock" },
          },
        },
        {
          $project: {
            productId: "$_id",
            productName: 1,
            sku: 1,
            category: 1,
            totalSold: 1,
            totalRevenue: 1,
            avgPrice: 1,
            currentStock: 1,
            performance: {
              $add: [
                { $multiply: ["$totalSold", 0.4] },
                { $multiply: ["$totalRevenue", 0.6] }
              ]
            },
          },
        },
        { $sort: { performance: 1 } },
        { $limit: 20 },
      ];
      break;

    case "fast_moving":
      // Products with highest stock turnover in last 30 days
      pipeline = [
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
            actionType: { $in: ["order_placed", "order_cancelled", "order_returned"] },
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: "$productId",
            totalDeducted: {
              $sum: {
                $cond: [{ $eq: ["$actionType", "order_placed"] }, "$quantityChanged", 0],
              },
            },
            totalRestored: {
              $sum: {
                $cond: [
                  { $in: ["$actionType", ["order_cancelled", "order_returned"]] },
                  { $abs: "$quantityChanged" },
                  0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $project: {
            productId: "$_id",
            productName: "$product.pname",
            sku: "$product.sku",
            currentStock: "$product.totalStock",
            turnoverRate: { $subtract: ["$totalDeducted", "$totalRestored"] },
          },
        },
        { $sort: { turnoverRate: -1 } },
        { $limit: 20 },
      ];
      break;

    case "slow_moving":
      // Products with low stock movement
      pipeline = [
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
            actionType: "order_placed",
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: "$productId",
            totalSold: { $sum: { $abs: "$quantityChanged" } },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $project: {
            productId: "$_id",
            productName: "$product.pname",
            sku: "$product.sku",
            currentStock: "$product.totalStock",
            totalSold: 1,
          },
        },
        { $sort: { totalSold: 1 } },
        { $limit: 20 },
      ];
      break;

    case "out_of_stock":
      // Out of stock products
      pipeline = [
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $match: {
            "product.sellerid": new mongoose.Types.ObjectId(sellerId),
            "product.stockType": "out_of_stock",
          },
        },
        {
          $project: {
            productId: "$_id",
            productName: "$product.pname",
            sku: "$product.sku",
            totalStock: "$product.totalStock",
            minStockAlert: "$product.minStockAlert",
          },
        },
      ];
      break;

    case "low_stock":
      // Low stock products
      pipeline = [
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $match: {
            "product.sellerid": new mongoose.Types.ObjectId(sellerId),
            $expr: {
              $and: [
                { $gt: ["$product.totalStock", 0] },
                { $lte: ["$product.totalStock", "$product.minStockAlert"] },
              ],
            },
          },
        },
        {
          $project: {
            productId: "$_id",
            productName: "$product.pname",
            sku: "$product.sku",
            currentStock: "$product.totalStock",
            minStockAlert: "$product.minStockAlert",
          },
        },
      ];
      break;

    default:
      throw new Error(`Invalid report type: ${reportType}`);
  }

  if (pipeline.length > 0) {
    const result = await InventoryLog.aggregate(pipeline);
    return result;
  }

  return [];
};

// Get inventory reports
const getInventoryReports = async (req, res) => {
  try {
    const sellerId = req.get("seller_id") || req.sellerId || req.id;
    const { reportType, period = 30 } = req.query;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const periodDays = parseInt(period) || 30;
    const reportData = await generateReportData(sellerId, reportType, periodDays);

    res.status(200).json({
      success: true,
      message: "Report generated successfully",
      data: {
        reportType,
        period: `${periodDays} days`,
        results: reportData,
      },
    });
  } catch (error) {
    console.error("Error generating inventory report:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Export reports to CSV
const exportReport = async (req, res) => {
  try {
    const sellerId = req.get("seller_id") || req.sellerId || req.id;
    const { reportType, format = "csv", period = 30 } = req.query;

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    // Get report data using helper function
    const periodDays = parseInt(period) || 30;
    const reportData = await generateReportData(sellerId, reportType, periodDays);

    // Handle summary report differently (it's an object, not an array)
    let csvData;
    if (reportType === "summary") {
      csvData = convertSummaryToCSV(reportData);
    } else {
      csvData = convertToCSV(reportData, reportType);
    }

    // Set headers for file download
    const filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.status(200).send(csvData);
  } catch (error) {
    console.error("Error exporting report:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Helper function to convert summary report to CSV
const convertSummaryToCSV = (summaryData) => {
  if (!summaryData) {
    return "No data available";
  }

  const csvRows = [];

  // Add headers
  csvRows.push("Category,Metric,Value");

  // Add overview data
  if (summaryData.overview) {
    csvRows.push(`Overview,Total Products,${summaryData.overview.totalProducts || 0}`);
    csvRows.push(`Overview,Total Revenue,${summaryData.overview.totalRevenue || 0}`);
    csvRows.push(`Overview,Total Orders,${summaryData.overview.totalOrders || 0}`);
    csvRows.push(`Overview,Total Quantity Sold,${summaryData.overview.totalQuantitySold || 0}`);
    csvRows.push(`Overview,Average Order Value,${summaryData.overview.averageOrderValue || 0}`);
  }

  // Add inventory data
  if (summaryData.inventory) {
    csvRows.push(`Inventory,Total Stock,${summaryData.inventory.totalStock || 0}`);
    csvRows.push(`Inventory,Low Stock Items,${summaryData.inventory.lowStockItems || 0}`);
    csvRows.push(`Inventory,Out of Stock Items,${summaryData.inventory.outOfStockItems || 0}`);
  }

  // Add alerts data
  if (summaryData.alerts) {
    csvRows.push(`Alerts,Recent Alerts,${summaryData.alerts.recentAlerts || 0}`);
  }

  // Add period
  if (summaryData.period) {
    csvRows.push(`Period,Report Period,${summaryData.period}`);
  }

  return csvRows.join('\n');
};

// Helper function to convert data to CSV
const convertToCSV = (data, reportType) => {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return "No data available";
  }

  // Ensure data is an array
  const dataArray = Array.isArray(data) ? data : [data];

  // Check if first item exists and has properties
  if (!dataArray[0] || typeof dataArray[0] !== 'object') {
    return "No data available";
  }

  const headers = Object.keys(dataArray[0]);
  const csvRows = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of dataArray) {
    if (!row || typeof row !== 'object') continue;

    const values = headers.map(header => {
      const value = row[header];
      // Handle nested objects or arrays
      if (typeof value === 'object' && value !== null) {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      // Escape commas and quotes in strings
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
};

export {
  updateProductStock,
  updateVariationStock,
  bulkUpdateStock,
  getInventoryLogs,
  getInventoryAlerts,
  acknowledgeAlert,
  getInventoryReports,
  exportReport,
};
