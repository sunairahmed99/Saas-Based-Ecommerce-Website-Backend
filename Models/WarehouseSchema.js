import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },

    // Location details
    address: {
      street: String,
      city: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
      postalCode: {
        type: String,
        required: true,
        trim: true,
      },
      country: {
        type: String,
        required: true,
        default: "India",
        trim: true,
      },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },

    // Contact information
    contactPerson: {
      name: String,
      phone: String,
      email: String,
    },

    // Warehouse capacity and type
    capacity: {
      type: Number, // in square feet or cubic meters
      default: null,
    },

    type: {
      type: String,
      enum: ["primary", "secondary", "third_party"],
      default: "primary",
    },

    // Operational details
    operatingHours: {
      open: String, // e.g., "09:00"
      close: String, // e.g., "18:00"
      timezone: {
        type: String,
        default: "Asia/Kolkata",
      },
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Priority for order fulfillment (1 = highest priority)
    priority: {
      type: Number,
      default: 1,
      min: 1,
    },

    // Additional metadata
    description: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (code field already indexed by unique: true)
warehouseSchema.index({ sellerId: 1, isActive: 1 });
warehouseSchema.index({ sellerId: 1, priority: 1 });

// Virtual for full address
warehouseSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  return `${addr.street || ''}, ${addr.city}, ${addr.state} ${addr.postalCode}, ${addr.country}`;
});

// Ensure virtual fields are serialized
warehouseSchema.set('toJSON', { virtuals: true });
warehouseSchema.set('toObject', { virtuals: true });

const Warehouse = mongoose.model("Warehouse", warehouseSchema);

export default Warehouse;
