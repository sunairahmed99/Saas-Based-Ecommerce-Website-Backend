import mongoose from 'mongoose';

const RefundRequestSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller'
    },
    items: [{
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      name: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      total: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    refundAmount: {
      type: Number,
      required: true,
      min: 0
    },
    refundReason: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'processing', 'refunded', 'rejected'],
      default: 'pending'
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    processedAt: {
      type: Date
    },
    refundMethod: {
      type: String,
      enum: ['wallet', 'bank_transfer', 'card_refund'],
      default: 'wallet'
    },
    adminNotes: {
      type: String,
      trim: true
    },
    transactionId: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Index for better performance
RefundRequestSchema.index({ userId: 1, status: 1 });
RefundRequestSchema.index({ orderId: 1 });
RefundRequestSchema.index({ status: 1, createdAt: -1 });

const RefundRequest = mongoose.model('RefundRequest', RefundRequestSchema);

export default RefundRequest;
