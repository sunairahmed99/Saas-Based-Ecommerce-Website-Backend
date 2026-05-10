import mongoose from "mongoose";

const productVariationSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Variation attributes
    size: {
      type: String,
      trim: true,
      default: null,
    },

    color: {
      type: String,
      trim: true,
      default: null,
    },

    // Variation-specific inventory
    variationStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    variationSku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Variation-specific pricing (optional)
    variationPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    variationDiscountPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    // Variation status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Images specific to this variation (optional)
    variationImages: [{
      type: String,
      default: [],
    }],
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique combinations of product, size, and color
productVariationSchema.index(
  { productId: 1, size: 1, color: 1 },
  {
    unique: true,
    partialFilterExpression: {
      size: { $ne: null },
      color: { $ne: null }
    }
  }
);

// Index for efficient queries
productVariationSchema.index({ productId: 1, isActive: 1 });

const ProductVariation = mongoose.model("ProductVariation", productVariationSchema);

export default ProductVariation;
