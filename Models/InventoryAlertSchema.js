import mongoose from "mongoose";

const inventoryAlertSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariation",
      default: null, // null for main product alerts
    },

    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },

    // Alert type
    alertType: {
      type: String,
      enum: ["low_stock", "out_of_stock", "overstock"],
      required: true,
    },

    // Stock levels
    currentStock: {
      type: Number,
      required: true,
      min: 0,
    },

    minStockThreshold: {
      type: Number,
      required: true,
      min: 0,
    },

    // Alert message
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Alert status
    status: {
      type: String,
      enum: ["active", "acknowledged", "resolved"],
      default: "active",
    },

    // Notification channels
    notifiedVia: [{
      type: String,
      enum: ["email", "dashboard", "push", "sms"],
      default: [],
    }],

    // Priority level
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    // Auto-resolve settings
    autoResolve: {
      enabled: {
        type: Boolean,
        default: false,
      },
      stockLevel: {
        type: Number,
        default: null,
      },
    },

    // Additional metadata
    productName: {
      type: String,
      trim: true,
      default: null,
    },

    productSku: {
      type: String,
      trim: true,
      default: null,
    },

    variationDetails: {
      size: String,
      color: String,
      variationSku: String,
    },

    // Last notification timestamps
    lastNotified: {
      email: Date,
      dashboard: Date,
      push: Date,
      sms: Date,
    },

    // Resolution details
    resolvedAt: Date,
    resolvedBy: {
      userId: mongoose.Schema.Types.ObjectId,
      userType: {
        type: String,
        enum: ["seller", "admin"],
      },
      name: String,
    },

    // Snooze settings (for temporarily disabling alerts)
    snoozedUntil: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
inventoryAlertSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
inventoryAlertSchema.index({ productId: 1, alertType: 1 });
inventoryAlertSchema.index({ variationId: 1, alertType: 1 });
inventoryAlertSchema.index({ priority: 1, status: 1 });
inventoryAlertSchema.index({ snoozedUntil: 1 });

// Pre-save middleware to set priority based on alert type and stock levels
inventoryAlertSchema.pre('save', function(next) {
  if (this.alertType === 'out_of_stock') {
    this.priority = 'critical';
  } else if (this.alertType === 'low_stock') {
    // Set priority based on how low the stock is
    const stockRatio = this.currentStock / this.minStockThreshold;
    if (stockRatio <= 0.25) {
      this.priority = 'high';
    } else if (stockRatio <= 0.5) {
      this.priority = 'medium';
    } else {
      this.priority = 'low';
    }
  }

  next();
});

const InventoryAlert = mongoose.model("InventoryAlert", inventoryAlertSchema);

export default InventoryAlert;
