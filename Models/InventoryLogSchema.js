import mongoose from "mongoose";

const inventoryLogSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariation",
      default: null, // null for main product stock changes
    },

    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },

    // Type of inventory change
    actionType: {
      type: String,
      enum: [
        "order_placed",      // Stock deducted on order
        "order_cancelled",   // Stock restored on cancellation
        "order_returned",    // Stock restored on return
        "manual_add",        // Manual stock addition
        "manual_adjust",     // Manual stock adjustment (damage/loss)
        "bulk_update",       // CSV bulk update
        "initial_stock",     // Initial stock setup
      ],
      required: true,
    },

    // Stock change details
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },

    newStock: {
      type: Number,
      required: true,
      min: 0,
    },

    quantityChanged: {
      type: Number,
      required: true, // Positive for additions, negative for deductions
    },

    // Reference to related entities
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    orderItemId: {
      type: String, // Specific order item reference
      default: null,
    },

    // Reason for manual adjustments
    reason: {
      type: String,
      trim: true,
      default: null,
    },

    // Additional notes
    notes: {
      type: String,
      trim: true,
      default: null,
    },

    // User who performed the action
    performedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      userType: {
        type: String,
        enum: ["seller", "admin", "system"],
        required: true,
      },
      name: {
        type: String,
        trim: true,
        default: null,
      },
    },

    // Variation details (for logging purposes)
    variationDetails: {
      size: String,
      color: String,
      variationSku: String,
    },

    // Location/warehouse information
    warehouse: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
inventoryLogSchema.index({ productId: 1, createdAt: -1 });
inventoryLogSchema.index({ sellerId: 1, createdAt: -1 });
inventoryLogSchema.index({ actionType: 1, createdAt: -1 });
inventoryLogSchema.index({ orderId: 1 });
inventoryLogSchema.index({ variationId: 1 });

const InventoryLog = mongoose.model("InventoryLog", inventoryLogSchema);

export default InventoryLog;
