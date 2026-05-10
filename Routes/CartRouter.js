import express from 'express';
import {
  addToCart,
  getCartItems,
  updateCartItem,
  deleteCartItem,
  clearCart,
  getCartCount
} from '../Controllers/CartController.js';
import verifyuser from '../Middleware/VerifyUser.js';

const CartRouter = express.Router();

// Add product to cart (requires authentication)
CartRouter.post('/add', verifyuser, addToCart);

// Get all cart items for a user (requires authentication)
CartRouter.get('/getall', verifyuser, getCartItems);

// Get cart items by userId (alternative route)
CartRouter.get('/getall/:userId', getCartItems);

// Get cart count and total value
CartRouter.get('/count', verifyuser, getCartCount);

// Get cart count by userId (alternative route)
CartRouter.get('/count/:userId', getCartCount);

// Update cart item (quantity, color, size)
CartRouter.put('/update/:id', verifyuser, updateCartItem);

// Delete cart item by ID
CartRouter.delete('/delete/:id', verifyuser, deleteCartItem);

// Clear all cart items for a user
CartRouter.delete('/clear', verifyuser, clearCart);

export default CartRouter;

