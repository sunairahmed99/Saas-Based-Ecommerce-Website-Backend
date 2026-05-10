import Product from "../Models/ProductSchema.js";
import { ProductReview } from "../Models/ReviewSchema.js";

/**
 * Calculate and update the rating for a specific product
 * @param {string} productId - The product ID to update
 */
export const updateProductRating = async (productId) => {
  try {
    // Get all approved reviews for this product
    const reviews = await ProductReview.find({
      productId,
      approved: true
    }).select('rating');

    if (reviews.length === 0) {
      // No reviews, set rating to 0
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        reviewCount: 0
      });
      return;
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    // Round to 1 decimal place
    const roundedRating = Math.round(averageRating * 10) / 10;

    // Update product with new rating and review count
    await Product.findByIdAndUpdate(productId, {
      rating: roundedRating,
      reviewCount: reviews.length
    });


  } catch (error) {
    console.error(`Error updating product rating for ${productId}:`, error);
  }
};

/**
 * Update ratings for multiple products
 * @param {Array<string>} productIds - Array of product IDs to update
 */
export const updateMultipleProductRatings = async (productIds) => {
  const promises = productIds.map(productId => updateProductRating(productId));
  await Promise.all(promises);
};

/**
 * Update ratings for all products (useful for initial setup or cron job)
 */
export const updateAllProductRatings = async () => {
  try {
    // Get all products
    const products = await Product.find({}).select('_id');
    const productIds = products.map(p => p._id.toString());

    await updateMultipleProductRatings(productIds);

  } catch (error) {
    console.error('Error in bulk rating update:', error);
  }
};

/**
 * Hook to automatically update product rating when a review is added/updated
 * This should be called from the review controller
 * @param {string} productId - The product ID whose rating needs updating
 */
export const updateRatingOnReviewChange = async (productId) => {
  // Debounce the update to avoid multiple updates for the same product
  setTimeout(() => {
    updateProductRating(productId);
  }, 1000); // 1 second delay
};

/**
 * Fix negative stock values in the database
 */
export const fixNegativeStock = async () => {
  try {
    const result = await Product.updateMany(
      {
        $or: [
          { totalStock: { $lt: 0 } },
          { pqty: { $lt: 0 } }
        ]
      },
      [
        {
          $set: {
            totalStock: { $max: ['$totalStock', 0] },
            pqty: { $max: ['$pqty', 0] }
          }
        }
      ]
    );

    return result.modifiedCount;

  } catch (error) {
    console.error('Error fixing negative stock:', error);
    throw error;
  }
};
