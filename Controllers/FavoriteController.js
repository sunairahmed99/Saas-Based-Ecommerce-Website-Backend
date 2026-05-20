import Favorite from "../Models/FavoriteSchema.js";
import Product from "../Models/ProductSchema.js";
import User from "../Models/UserSchema.js";
import mongoose from "mongoose";

// Add product to favorites
const addToFavorites = async (req, res) => {
  try {
    const userId = req.id || req.body.userId || req.headers["user_id"];
    const { productId } = req.body;

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

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
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

    // Check if already in favorites
    const existingFavorite = await Favorite.findOne({ userId, productId });
    if (existingFavorite) {
      return res.status(400).json({
        success: false,
        message: "Product already in favorites"
      });
    }

    // Add to favorites
    const favorite = await Favorite.create({ userId, productId });

    res.status(200).json({
      success: true,
      message: "Product added to favorites successfully",
      data: favorite
    });
  } catch (error) {
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product already in favorites"
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Get all favorites for a user
const getFavorites = async (req, res) => {
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

    // Get all favorites with populated product details
    const favorites = await Favorite.find({ userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "productId",
        populate: [
          { path: "sellerid", select: "name email" },
          { path: "catid", select: "name Image" },
          { path: "subcatid", select: "name Image" }
        ]
      })
      .lean();

    res.status(200).json({
      success: true,
      message: "Favorites fetched successfully",
      count: favorites.length,
      data: favorites
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Delete product from favorites
const deleteFavorite = async (req, res) => {
  try {
    const userId = req.id || req.body?.userId || req.headers["user_id"];
    const favoriteId = req.params.id;


    // If favoriteId is provided in params, use it directly
    if (favoriteId) {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(favoriteId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid favorite ID format"
        });
      }

      const favorite = await Favorite.findById(favoriteId);

      if (!favorite) {
        return res.status(404).json({
          success: false,
          message: "Favorite not found"
        });
      }

      // Verify ownership if userId is provided
      if (userId && favorite.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to delete this favorite"
        });
      }

      await Favorite.findByIdAndDelete(favoriteId);

      return res.status(200).json({
        success: true,
        message: "Product removed from favorites successfully"
      });
    }

    // Fallback: delete by userId and productId (for older API compatibility)
    const { productId } = req.body || {};

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

    const favorite = await Favorite.findOneAndDelete({ userId, productId });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: "Product not found in favorites"
      });
    }

    res.status(200).json({
      success: true,
      message: "Product removed from favorites successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Check if product is in favorites
const checkFavorite = async (req, res) => {
  try {
    const userId = req.id || req.params.userId || req.query.userId || req.headers["user_id"];
    const { productId } = req.params;

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

    const favorite = await Favorite.findOne({ userId, productId });

    res.status(200).json({
      success: true,
      isFavorite: !!favorite,
      data: favorite
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

export { addToFavorites, getFavorites, deleteFavorite, checkFavorite };

