import mongoose from "mongoose";

const CartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  color: {
    type: String,
    default: null
  },
  size: {
    type: String,
    default: null
  },
  price: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});


CartSchema.index({ userId: 1, productId: 1, color: 1, size: 1 }, { unique: true });

const Cart = mongoose.model("Cart", CartSchema);

export default Cart;

