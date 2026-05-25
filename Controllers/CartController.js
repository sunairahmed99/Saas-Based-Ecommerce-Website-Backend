import Cart from "../Models/CartSchema.js";
import Product from "../Models/ProductSchema.js";
import User from "../Models/UserSchema.js";

const parseVariantList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((v) => {
      if (typeof v === "string" && v.includes(",")) {
        return v.split(",").map((s) => s.trim()).filter(Boolean);
      }
      return v ? [String(v).trim()] : [];
    }).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const getStock = (product) =>
  Number(product?.totalStock ?? product?.pqty ?? 0);

const populateCartItem = (query) =>
  query.populate({
    path: "productId",
    populate: [
      { path: "sellerid", select: "name email sname" },
      { path: "catid", select: "name Image" },
      { path: "subcatid", select: "name Image" },
    ],
  });

const populateCartItemForAdd = (query) =>
  query.populate({
    path: "productId",
    select:
      "pname pprice pactualprice prodisprice pimages pstatus pqty totalStock pcolor psize sellerid catid subcatid",
    populate: [
      { path: "sellerid", select: "name sname" },
      { path: "catid", select: "name" },
      { path: "subcatid", select: "name" },
    ],
  });

// Add product to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.id || req.body.userId || req.headers["user_id"];
    const { productId, quantity, color, size } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check if product is available
    if (product.pstatus === "outofstock" || product.pstatus === "inactive") {
      return res.status(400).json({
        success: false,
        message: "Product is not available"
      });
    }

    // Validate quantity
    const qty = quantity || 1;
    if (qty < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1"
      });
    }

    const stock = getStock(product);
    if (stock < qty) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock} items available in stock`,
      });
    }

    const availableColors = parseVariantList(product.pcolor);
    const availableSizes = parseVariantList(product.psize);

    if (color && availableColors.length > 0 && !availableColors.includes(color)) {
      return res.status(400).json({
        success: false,
        message: "Selected color is not available for this product",
      });
    }

    if (size && availableSizes.length > 0 && !availableSizes.includes(size)) {
      return res.status(400).json({
        success: false,
        message: "Selected size is not available for this product",
      });
    }

    // Calculate price (use discounted price if available, otherwise use actual price)
    const itemPrice = product.prodisprice > 0 ? product.prodisprice : (product.pactualprice > 0 ? product.pactualprice : product.pprice);
    const totalPrice = itemPrice * qty;

    // Check if item already exists in cart with same color and size
    const existingCartItem = await Cart.findOne({
      userId,
      productId,
      color: color || null,
      size: size || null
    });

    if (existingCartItem) {
      // Update quantity if item already exists
      const newQuantity = existingCartItem.quantity + qty;
      
      // Check stock availability for new quantity
      if (stock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${stock} items available in stock. You already have ${existingCartItem.quantity} in cart.`,
        });
      }

      existingCartItem.quantity = newQuantity;
      existingCartItem.totalPrice = itemPrice * newQuantity;
      await existingCartItem.save();

      const updatedItem = await populateCartItemForAdd(
        Cart.findById(existingCartItem._id)
      ).lean();

      return res.status(200).json({
        success: true,
        message: "Cart item quantity updated successfully",
        data: updatedItem,
      });
    }

    const cartItem = await Cart.create({
      userId,
      productId,
      quantity: qty,
      color: color || null,
      size: size || null,
      price: itemPrice,
      totalPrice: totalPrice,
    });

    const populatedItem = await populateCartItemForAdd(
      Cart.findById(cartItem._id)
    ).lean();

    res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      data: populatedItem,
    });
  } catch (error) {
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product already in cart with same color and size"
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Get all cart items for a user
const getCartItems = async (req, res) => {
  try {
    const userId = req.id || req.params.userId || req.query.userId || req.headers["user_id"];

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get all cart items with populated product details
    const cartItems = await Cart.find({ userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "productId",
        populate: [
          { path: "sellerid", select: "name email" },
          { path: "catid", select: "name Image" },
          { path: "subcatid", select: "name Image" }
        ]
      });

    // Calculate total cart value
    const totalCartValue = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    res.status(200).json({
      success: true,
      message: "Cart items fetched successfully",
      count: cartItems.length,
      totalItems: totalItems,
      totalCartValue: totalCartValue,
      data: cartItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Update cart item (quantity, color, size)
const updateCartItem = async (req, res) => {
  try {
    const userId = req.id || req.body.userId || req.headers["user_id"];
    const cartItemId = req.params.id;
    const { quantity, color, size } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    if (!cartItemId) {
      return res.status(400).json({
        success: false,
        message: "Cart item ID is required"
      });
    }

    // Find cart item
    const cartItem = await Cart.findById(cartItemId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

    // Verify ownership
    if (cartItem.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to update this cart item"
      });
    }

    // Get product details
    const product = await Product.findById(cartItem.productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Update quantity if provided
    if (quantity !== undefined) {
      if (quantity < 1) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be at least 1"
        });
      }

      const stock = getStock(product);
      if (stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${stock} items available in stock`,
        });
      }

      cartItem.quantity = quantity;
    }

    // Update color if provided
    if (color !== undefined) {
      if (color && product.pcolor && product.pcolor.length > 0) {
        if (!product.pcolor.includes(color)) {
          return res.status(400).json({
            success: false,
            message: "Selected color is not available for this product"
          });
        }
      }
      cartItem.color = color || null;
    }

    // Update size if provided
    if (size !== undefined) {
      if (size && product.psize && product.psize.length > 0) {
        if (!product.psize.includes(size)) {
          return res.status(400).json({
            success: false,
            message: "Selected size is not available for this product"
          });
        }
      }
      cartItem.size = size || null;
    }

    // Recalculate price
    const itemPrice = product.prodisprice > 0 ? product.prodisprice : (product.pactualprice > 0 ? product.pactualprice : product.pprice);
    cartItem.price = itemPrice;
    cartItem.totalPrice = itemPrice * cartItem.quantity;

    await cartItem.save();

    res.status(200).json({
      success: true,
      message: "Cart item updated successfully",
      data: cartItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Delete cart item
const deleteCartItem = async (req, res) => {
  try {
    const userId = req.id || req.body.userId || req.headers["user_id"];
    const cartItemId = req.params.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    if (!cartItemId) {
      return res.status(400).json({
        success: false,
        message: "Cart item ID is required"
      });
    }

    // Find cart item
    const cartItem = await Cart.findById(cartItemId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

    // Verify ownership
    if (cartItem.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to delete this cart item"
      });
    }

    await Cart.findByIdAndDelete(cartItemId);

    res.status(200).json({
      success: true,
      message: "Cart item removed successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Clear all cart items for a user
const clearCart = async (req, res) => {
  try {
    const userId = req.id || req.body.userId || req.headers["user_id"];

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await Cart.deleteMany({ userId });

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Get cart item count
const getCartCount = async (req, res) => {
  try {
    const userId = req.id || req.params.userId || req.query.userId || req.headers["user_id"];

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const cartItems = await Cart.find({ userId });
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalCartValue = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

    res.status(200).json({
      success: true,
      count: cartItems.length,
      totalItems: totalItems,
      totalCartValue: totalCartValue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

export {
  addToCart,
  getCartItems,
  updateCartItem,
  deleteCartItem,
  clearCart,
  getCartCount
};

