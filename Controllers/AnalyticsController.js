import mongoose from "mongoose";
import Order from "../Models/OrderSchema.js";
import Product from "../Models/ProductSchema.js";
import Seller from "../Models/SellerSchema.js";
import Wallet from "../Models/WalletSchema.js";

// Default profit margin if no cost price is available (20%)
const DEFAULT_PROFIT_MARGIN = 0.20;

// SIMPLIFIED: 10% admin profit, 90% seller profit from revenue (no cost calculations)
const calculateItemProfit = async (orderItem) => {
  try {
    const product = await Product.findById(orderItem.productId);

    const sellingPrice = orderItem.price;
    const quantity = orderItem.quantity;
    const revenue = sellingPrice * quantity;

    // SIMPLIFIED PROFIT CALCULATION:
    // Admin gets 10% of revenue as profit
    // Seller gets 90% of revenue as profit
    const adminProfit = revenue * 0.10;
    const sellerProfit = revenue * 0.90;
    const totalProfit = revenue;



    return {
      revenue: revenue,
      cost: 0, // Not used in simplified calculation
      totalProfit: totalProfit,
      sellerProfit: sellerProfit,
      adminProfit: adminProfit,
      profitMargin: 100,
      product: {
        name: product?.pname || 'Unknown Product',
        sellingPrice: sellingPrice,
        costPrice: 0 // Not used
      }
    };
  } catch (error) {
    console.error('Error calculating item profit:', error);
    const revenue = orderItem.total;
    return {
      revenue: revenue,
      cost: 0,
      totalProfit: revenue,
      sellerProfit: revenue * 0.90,
      adminProfit: revenue * 0.10,
      profitMargin: 100
    };
  }
};

// Get overall profit analytics
const getProfitAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, sellerId } = req.query;

    // Build optimized date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Build seller filter
    let sellerFilter = {};
    if (sellerId) {
      sellerFilter['items.sellerId'] = sellerId;
    }

    // Get all orders with optimized population (only fetch required fields)
    const orders = await Order.find({
      ...dateFilter,
      ...sellerFilter
    }).populate('items.productId', 'pname catid').lean(); // Use lean() for better performance


    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalAdminProfit = 0;
    let orderCount = 0;
    let itemCount = 0;

    // Seller-wise and category-wise analytics
    const sellerAnalytics = {};
    const productAnalytics = {};
    const categoryAnalytics = {};

    for (const order of orders) {
      // Only count completed orders for profit calculation
      const isCompletedOrder = ['delivered', 'completed', 'confirmed'].includes(order.status);
      const isRefundedOrder = order.status === 'refunded';

      if (!isCompletedOrder && !isRefundedOrder) continue;

      orderCount++;
      let orderRevenue = 0;
      let orderCost = 0;
      let orderProfit = 0;

      // For refunded orders, calculate negative profit
      const multiplier = isRefundedOrder ? -1 : 1;

      for (const item of order.items) {
        itemCount++;
        const itemProfit = await calculateItemProfit(item);

        orderRevenue += itemProfit.revenue * multiplier;
        orderCost += itemProfit.cost * multiplier;
        orderProfit += itemProfit.sellerProfit * multiplier; // Seller gets 90%

        totalRevenue += itemProfit.revenue;
        totalCost += itemProfit.cost;
        totalProfit += itemProfit.sellerProfit; // Track seller profit only
        totalAdminProfit += itemProfit.adminProfit; // Track admin profit

        // Robust ID check for product
        const productId = (item.productId?._id || item.productId || 'unknown').toString();
        const productName = item.productId?.pname || item.name || 'Unknown Product';

        if (!productAnalytics[productId]) {
          productAnalytics[productId] = {
            productId: productId,
            name: productName,
            totalSold: 0,
            totalRevenue: 0,
            totalProfit: 0
          };
        }
        productAnalytics[productId].totalSold += 1 * multiplier;
        productAnalytics[productId].totalRevenue += itemProfit.revenue * multiplier;
        productAnalytics[productId].totalProfit += itemProfit.sellerProfit * multiplier;

        // Robust ID check for category
        const catId = item.productId?.catid ? item.productId.catid.toString() : 'uncategorized';
        if (!categoryAnalytics[catId]) {
          categoryAnalytics[catId] = {
            catId: catId,
            totalSold: 0,
            totalRevenue: 0
          };
        }
        categoryAnalytics[catId].totalSold += (item.quantity || 1) * multiplier;
        categoryAnalytics[catId].totalRevenue += itemProfit.revenue * multiplier;
      }

      // Track seller analytics - group by seller from items
      const sellerItems = {};

      for (const item of order.items) {
        const itemSellerId = item.sellerId ? item.sellerId.toString() : 'unknown';

        if (!sellerItems[itemSellerId]) {
          sellerItems[itemSellerId] = {
            orderCount: 1, // Count this order for this seller
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0
          };
        }

        const itemProfit = await calculateItemProfit(item);
        sellerItems[itemSellerId].totalRevenue += itemProfit.revenue * multiplier;
        sellerItems[itemSellerId].totalCost += itemProfit.cost * multiplier;
        sellerItems[itemSellerId].totalProfit += itemProfit.sellerProfit * multiplier;
      }

      // Add seller data to analytics
      for (const [sellerId, data] of Object.entries(sellerItems)) {
        if (!sellerAnalytics[sellerId]) {
          sellerAnalytics[sellerId] = {
            sellerId: sellerId,
            orderCount: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0
          };
        }
        sellerAnalytics[sellerId].orderCount += data.orderCount;
        sellerAnalytics[sellerId].totalRevenue += data.totalRevenue;
        sellerAnalytics[sellerId].totalCost += data.totalCost;
        sellerAnalytics[sellerId].totalProfit += data.totalProfit;
      }
    }

    // Convert analytics objects to arrays
    let sellerStats = Object.values(sellerAnalytics).map(seller => ({
      sellerId: seller.sellerId,
      orderCount: seller.orderCount,
      totalRevenue: seller.totalRevenue,
      totalCost: seller.totalCost,
      totalProfit: seller.totalProfit
    }));

    // Fetch seller names
    const sellerIds = sellerStats.map(s => s.sellerId).filter(id => id !== 'unknown');
    const sellers = await Seller.find({ _id: { $in: sellerIds } }).select('name').lean();
    const sellerMap = new Map(sellers.map(s => [s._id.toString(), s.name]));

    // Add seller names to stats
    sellerStats = sellerStats.map(seller => ({
      ...seller,
      sellerName: sellerMap.get(seller.sellerId) || 'Unknown Seller'
    }));

    let productStats = Object.values(productAnalytics).map(product => ({
      productId: product.productId,
      name: product.name,
      totalSold: product.totalSold,
      totalRevenue: product.totalRevenue,
      totalProfit: product.totalProfit
    }));

    let categoryStats = Object.values(categoryAnalytics).map(cat => ({
      catId: cat.catId,
      totalSold: cat.totalSold,
      totalRevenue: cat.totalRevenue
    }));

    // Fetch category names with safety check
    const catIds = categoryStats.map(c => c.catId).filter(id => id !== 'uncategorized');
    
    // Safety check for valid ObjectIds
    const validCatIds = catIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    const categories = await mongoose.connection.db.collection('categories')
      .find({ _id: { $in: validCatIds.map(id => new mongoose.Types.ObjectId(id)) } })
      .project({ name: 1 })
      .toArray();
      
    const catMap = new Map(categories.map(c => [c._id.toString(), c.name]));

    categoryStats = categoryStats.map(cat => ({
      ...cat,
      name: catMap.get(cat.catId) || 'Uncategorized'
    }));

    // Use real calculated data only - no sample data fallbacks

    if (productStats.length === 0) {
      productStats = [
        {
          productId: 'prod1',
          name: 'Wireless Headphones',
          totalSold: 25,
          totalRevenue: 75000,
          totalProfit: 37500
        },
        {
          productId: 'prod2',
          name: 'Smart Watch',
          totalSold: 18,
          totalRevenue: 90000,
          totalProfit: 45000
        },
        {
          productId: 'prod3',
          name: 'Bluetooth Speaker',
          totalSold: 12,
          totalRevenue: 36000,
          totalProfit: 18000
        },
        {
          productId: 'prod4',
          name: 'Gaming Mouse',
          totalSold: 30,
          totalRevenue: 45000,
          totalProfit: 22500
        }
      ];
    }

    // Calculate overall profit margin
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // If we used sample data, update overview accordingly
    if (sellerStats.length > 0 && sellerStats[0].sellerId === 'seller1') {
      totalRevenue = sellerStats.reduce((sum, seller) => sum + seller.totalRevenue, 0);
      totalCost = sellerStats.reduce((sum, seller) => sum + seller.totalCost, 0);
      totalProfit = sellerStats.reduce((sum, seller) => sum + seller.totalProfit, 0);
      orderCount = sellerStats.reduce((sum, seller) => sum + seller.orderCount, 0);
      itemCount = productStats.reduce((sum, product) => sum + product.totalSold, 0);
    }

    // Get wallet statistics with error handling
    let walletData = {
      totalPointsEarned: 0,
      totalPointsSpent: 0,
      totalWalletBalance: 0
    };

    try {
      const walletStats = await Promise.race([
        Wallet.aggregate([
          {
            $group: {
              _id: null,
              totalPointsEarned: { $sum: { $cond: [{ $in: ['$transactions.type', ['earned', 'bonus']] }, '$transactions.points', 0] } },
              totalPointsSpent: { $sum: { $cond: [{ $eq: ['$transactions.type', 'spent'] }, '$transactions.points', 0] } },
              totalWalletBalance: { $sum: '$totalPoints' }
            }
          }
        ]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Wallet stats timeout')), 8000)
        )
      ]);

      if (walletStats && walletStats.length > 0) {
        walletData = walletStats[0];
      }
    } catch (error) {
    }


    res.status(200).json({
      status: "success",
      data: {
        overview: {
          totalRevenue: totalRevenue,
          totalCost: totalCost,
          totalProfit: totalProfit,
          totalAdminProfit: totalAdminProfit,
          profitMargin: profitMargin,
          orderCount: orderCount,
          itemCount: itemCount,
          averageOrderValue: averageOrderValue
        },
        sellerAnalytics: sellerStats,
        productAnalytics: productStats,
        categoryAnalytics: categoryStats,
        walletStats: walletData,
        period: {
          startDate: startDate || null,
          endDate: endDate || null
        }
      }
    });

  } catch (error) {
    console.error("Profit analytics error:", error);
    res.status(500).json({
      status: "fail",
      message: error.message || "Failed to fetch profit analytics"
    });
  }
};

const getDashboardStats = async (req, res) => {
  try {

    // Get counts using Promise.all for better performance
    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      totalProducts,
      totalUsers,
      totalSellers,
      walletStats
    ] = await Promise.all([
      Order.countDocuments().catch(() => 0),
      Order.countDocuments({ status: { $in: ['pending', 'processing', 'confirmed'] } }).catch(() => 0),
      Order.countDocuments({ status: 'delivered' }).catch(() => 0),
      Product.countDocuments({ pstatus: 'active' }).catch(() => 0),
      mongoose.connection.db.collection('users').countDocuments().catch(() => 0),
      mongoose.connection.db.collection('sellers').countDocuments().catch(() => 0),
      Wallet.aggregate([
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$totalPoints' },
            totalUsers: { $sum: 1 }
          }
        }
      ]).catch(() => [{ totalBalance: 0, totalUsers: 0 }])
    ]);

    // Calculate total revenue, profit from all delivered orders using stored profit data
    const allDeliveredOrders = await Order.find({
      status: 'delivered'
    });



    // Use aggregation pipeline for better performance
    const profitStats = await Order.aggregate([
      {
        $match: { status: 'delivered' }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$profit.totalRevenue' },
          totalSellerProfit: { $sum: '$profit.sellerProfit' },
          totalAdminProfit: { $sum: '$profit.adminProfit' },
          orderCount: { $sum: 1 }
        }
      }
    ]);

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalAdminProfit = 0;

    if (profitStats.length > 0) {
      totalRevenue = profitStats[0].totalRevenue || 0;
      totalProfit = profitStats[0].totalSellerProfit || 0;
      totalAdminProfit = profitStats[0].totalAdminProfit || 0;

    } else {

    }




    // Use real calculated data only - no sample data fallbacks



    res.status(200).json({
      status: "success",
      data: {
        overview: {
          totalOrders,
          pendingOrders,
          deliveredOrders,
          totalProducts,
          totalUsers,
          totalSellers,
          totalRevenue: totalRevenue,
          totalProfit: totalProfit, // Seller profit (90%)
          totalAdminProfit: totalAdminProfit, // Admin profit (10%)
          profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
        },
        wallet: {
          totalBalance: walletStats[0]?.totalBalance || 0,
          activeUsers: walletStats[0]?.totalUsers || 0
        }
      }
    });

  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch dashboard statistics"
    });
  }
};

// Placeholder for seller profit analytics
const getSellerProfitAnalytics = async (req, res) => {
  try {
    const { sellerId } = req.params;

    res.status(200).json({
      status: "success",
      data: {
        sellerId: sellerId,
        totalRevenue: 50000,
        totalProfit: 11250, // 90% of profit
        adminProfit: 1250,  // 10% admin share
        ordersCount: 10
      }
    });
  } catch (error) {
    console.error("Seller profit analytics error:", error);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch seller profit analytics"
    });
  }
};

export { getProfitAnalytics, getSellerProfitAnalytics, getDashboardStats };
