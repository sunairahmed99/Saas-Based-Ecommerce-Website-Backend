import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    pname: {
      type: String,
      required: true,
      trim: true,
    },

    pdescription: {
      type: String,
      required: true,
    },

    pprice: {
      type: Number,
      required: true,
    },

    pactualprice: {
    
      type: Number,
      default: 0,
    },

    pdis: {
      type: Number,
      default: 0,
    },

    prodisprice: {
      type: Number,
      default: 0,
    },

    // Basic Inventory Fields
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    stockType: {
      type: String,
      enum: ["in_stock", "out_of_stock"],
      default: "in_stock",
    },

    totalStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    minStockAlert: {
      type: Number,
      default: 10,
      min: 0,
    },

    warehouse: {
      type: String,
      default: null,
      trim: true,
    },

    // Legacy fields for backward compatibility (will be deprecated)
    pqty: {
      type: Number,
      required: false,
      default: 0,
    },

    psize: {
      type:[String],
      default: null,
    },

    pcolor: {
      type:[String],
      default: null,
    },

    pstatus: {
      type: String,
      enum: ["active", "inactive", "outofstock","pending","delivered"],
      default: "pending",
    },

    catid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
  
    },

    subcatid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
   
    },

    sellerid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: false,
      default: null,
    },

    pimage1: {
      type: String,
      required: true,
    },

    pimage2: {
      type: String,
      default: null,
    },

    pimage3: {
      type: String,
      default: null,
    },

    views: {
      type: Number,
      default: 0,
    },

    // How many units of this product have been sold (all orders)
    soldCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Calculated rating based on product reviews (1-5 stars)
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    // Number of reviews for this product
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);



const Product = mongoose.model("Product", productSchema);

export default Product
