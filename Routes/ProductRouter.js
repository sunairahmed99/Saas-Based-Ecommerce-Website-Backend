import express from 'express';
import { createProduct, getAllProducts, getSellerProducts, getProductAndIncrementViews, getTrendingProducts, getForYouProducts, updateProductStatus, deleteProduct, getProductsByCategory, getProductsBySubcategory, getProductsBySeller, searchProducts, updateAllProductRatingsAdmin, fixNegativeStockAdmin, toggleFeaturedStatus, getFeaturedProducts, getLatestProducts, getRelatedProducts } from '../Controllers/ProductController.js';
import { uploadMultipleImages } from '../Middleware/Uploadmultiplemiddleware.js';
import { verifyAdmin, verifySellerOrAdmin } from '../Middleware/VerifyUser.js';



const ProductRouter = express.Router();


ProductRouter.get('/featured', getFeaturedProducts);
ProductRouter.get('/latest', getLatestProducts);
ProductRouter.get('/related', getRelatedProducts);
ProductRouter.post('/create',uploadMultipleImages,createProduct)
ProductRouter.get('/getall',getAllProducts)
ProductRouter.get('/getsellerproduct',getSellerProducts)
ProductRouter.get('/seller',getSellerProducts) // Alternative route for frontend
ProductRouter.get('/category/:categoryId', getProductsByCategory);
ProductRouter.get('/subcategory/:subcategoryId', getProductsBySubcategory);
ProductRouter.get('/seller/:sellerId', getProductsBySeller);
ProductRouter.get('/trending', getTrendingProducts);
ProductRouter.get('/view/:id', getProductAndIncrementViews);
ProductRouter.get('/foryou/:userId', getForYouProducts);
ProductRouter.get('/search', searchProducts);
ProductRouter.patch('/update-status/:id', verifyAdmin, updateProductStatus);
ProductRouter.patch('/toggle-feature/:id', verifyAdmin, toggleFeaturedStatus);
ProductRouter.post('/update-ratings', verifyAdmin, updateAllProductRatingsAdmin);
ProductRouter.post('/fix-negative-stock', verifyAdmin, fixNegativeStockAdmin);
ProductRouter.delete('/delete/:id', verifySellerOrAdmin, deleteProduct);


export default ProductRouter;
