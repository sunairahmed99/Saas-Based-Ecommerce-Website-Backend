import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
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
    },
    color: {
      type: String,
      default: null
    },
    size: {
      type: String,
      default: null
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true
    }
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address"
    },
    fullName: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    label: String
  },
  { _id: false }
);

const ALLOWED_ORDER_STATUSES = [
  "placed",
  "pending",
  "processing",
  "confirmed",
  "cancelled_by_seller",
  "ready_for_pickup",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "return_requested",
  "return_approved",
  "return_rejected",
  "returned",
  "refunded"
];

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    items: {
      type: [orderItemSchema],
      validate: (v) => Array.isArray(v) && v.length > 0
    },
    address: shippingAddressSchema,
    subtotal: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    coupon: {
      code: String,
      discountType: String,
      discountValue: Number
    },
    profit: {
      totalRevenue: { type: Number, default: 0 },
      totalCost: { type: Number, default: 0 },
      totalProfit: { type: Number, default: 0 },
      sellerProfit: { type: Number, default: 0 },
      adminProfit: { type: Number, default: 0 },
      calculatedAt: { type: Date, default: Date.now }
    },
    payment: {
      method: {
        type: String,
        enum: ["cod", "card", "wallet"],
        default: "cod"
      },
      status: {
        type: String,
        enum: ["pending", "paid"],
        default: "pending"
      }
    },
    paymentMethod: {
      // Alias for FE consumption (maps to payment.method)
      type: String,
      default: "cod"
    },
    status: {
      type: String,
      enum: ALLOWED_ORDER_STATUSES,
      default: "pending"
    },
    statusTimestamps: {
      type: Map,
      of: Date,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;

