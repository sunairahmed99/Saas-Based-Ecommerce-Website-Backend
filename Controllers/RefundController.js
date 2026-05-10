import RefundRequest from '../Models/RefundSchema.js';
import Order from '../Models/OrderSchema.js';
import User from '../Models/UserSchema.js';
import Wallet from '../Models/WalletSchema.js';

// Create refund request (User)
const createRefundRequest = async (req, res) => {
  try {
    const userId = req.id;
    const { orderId, refundReason, items } = req.body;

    // Validate required fields
    if (!orderId || !refundReason) {
      return res.status(400).json({
        status: 'fail',
        message: 'Order ID and refund reason are required'
      });
    }

    // Check if order exists and belongs to user
    const order = await Order.findOne({ _id: orderId, userId }).populate('items.productId');
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found'
      });
    }

    // Check if order can be refunded (delivered orders only, within 30 days)
    if (order.status !== 'delivered') {
      return res.status(400).json({
        status: 'fail',
        message: 'Only delivered orders can be refunded'
      });
    }

    const orderDate = new Date(order.createdAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (orderDate < thirtyDaysAgo) {
      return res.status(400).json({
        status: 'fail',
        message: 'Refund requests must be made within 30 days of delivery'
      });
    }

    // Check if refund request already exists for this order
    const existingRefund = await RefundRequest.findOne({ orderId, userId });
    if (existingRefund) {
      return res.status(400).json({
        status: 'fail',
        message: 'Refund request already exists for this order'
      });
    }

    // Calculate refund amount based on selected items or full order
    let refundAmount = 0;
    let refundItems = [];

    if (items && items.length > 0) {
      // Partial refund - only selected items
      for (const item of items) {
        const orderItem = order.items.find(oi => oi._id.toString() === item.itemId);
        if (orderItem) {
          const itemTotal = orderItem.price * item.quantity;
          refundAmount += itemTotal;
          refundItems.push({
            productId: orderItem.productId._id,
            name: orderItem.name,
            quantity: item.quantity,
            price: orderItem.price,
            total: itemTotal
          });
        }
      }
    } else {
      // Full order refund
      refundAmount = order.total;
      refundItems = order.items.map(item => ({
        productId: item.productId._id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      }));
    }

    // Create refund request
    const refundRequest = await RefundRequest.create({
      orderId,
      userId,
      sellerId: order.items[0]?.sellerId, // First seller (assuming single seller per order)
      items: refundItems,
      refundAmount,
      refundReason,
      status: 'pending'
    });

    res.status(201).json({
      status: 'success',
      message: 'Refund request submitted successfully',
      data: refundRequest
    });

  } catch (error) {
    console.error('Create refund request error:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to create refund request'
    });
  }
};

// Get user's refund requests
const getUserRefundRequests = async (req, res) => {
  try {
    const userId = req.id;

    const refunds = await RefundRequest.find({ userId })
      .populate('orderId', 'orderId total status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: refunds
    });

  } catch (error) {
    console.error('Get user refund requests error:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to fetch refund requests'
    });
  }
};

// Get all refund requests (Admin)
const getAllRefundRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let filter = {};
    if (status) {
      filter.status = status;
    }

    const refunds = await RefundRequest.find(filter)
      .populate('orderId', 'orderId total status createdAt')
      .populate('userId', 'name email')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await RefundRequest.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: refunds,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    console.error('Get all refund requests error:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to fetch refund requests'
    });
  }
};

// Process refund (Admin)
const processRefund = async (req, res) => {
  try {
    const { refundId } = req.params;
    const { refundAmount, refundReason, refundMethod = 'wallet' } = req.body;
    const adminId = req.id;

    const refund = await RefundRequest.findById(refundId);
    if (!refund) {
      return res.status(404).json({
        status: 'fail',
        message: 'Refund request not found'
      });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({
        status: 'fail',
        message: 'Refund request is not in pending status'
      });
    }

    // Update refund status
    refund.status = 'processing';
    refund.processedBy = adminId;
    refund.processedAt = new Date();
    refund.adminNotes = refundReason;
    refund.refundMethod = refundMethod;

    // Process refund based on method
    if (refundMethod === 'wallet') {
      // Add money back to user's wallet
      const userWallet = await Wallet.findOne({ userId: refund.userId });
      if (userWallet) {
        userWallet.totalPoints += refundAmount;
        userWallet.transactions.push({
          type: 'refund',
          points: refundAmount,
          description: `Refund for order ${refund.orderId.orderId}`,
          timestamp: new Date()
        });
        await userWallet.save();
      }
    }

    // Mark as refunded
    refund.status = 'refunded';
    refund.transactionId = `REF_${Date.now()}`;
    await refund.save();

    res.status(200).json({
      status: 'success',
      message: 'Refund processed successfully',
      data: refund
    });

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to process refund'
    });
  }
};

// Reject refund (Admin)
const rejectRefund = async (req, res) => {
  try {
    const { refundId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.id;

    const refund = await RefundRequest.findById(refundId);
    if (!refund) {
      return res.status(404).json({
        status: 'fail',
        message: 'Refund request not found'
      });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({
        status: 'fail',
        message: 'Refund request is not in pending status'
      });
    }

    // Update refund status
    refund.status = 'rejected';
    refund.processedBy = adminId;
    refund.processedAt = new Date();
    refund.adminNotes = rejectionReason;
    await refund.save();

    res.status(200).json({
      status: 'success',
      message: 'Refund request rejected',
      data: refund
    });

  } catch (error) {
    console.error('Reject refund error:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to reject refund request'
    });
  }
};

// Get refund statistics (Admin)
const getRefundStats = async (req, res) => {
  try {
    const stats = await RefundRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$refundAmount' }
        }
      }
    ]);

    const totalRequests = await RefundRequest.countDocuments();
    const pendingRequests = await RefundRequest.countDocuments({ status: 'pending' });
    const processedRequests = await RefundRequest.countDocuments({ status: 'refunded' });

    res.status(200).json({
      status: 'success',
      data: {
        totalRequests,
        pendingRequests,
        processedRequests,
        stats: stats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalAmount: stat.totalAmount
          };
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Get refund stats error:', error);
    res.status(500).json({
      status: 'fail',
      message: 'Failed to fetch refund statistics'
    });
  }
};

export {
  createRefundRequest,
  getUserRefundRequests,
  getAllRefundRequests,
  processRefund,
  rejectRefund,
  getRefundStats
};
