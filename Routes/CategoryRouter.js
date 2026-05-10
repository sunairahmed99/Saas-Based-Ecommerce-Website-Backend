import express from 'express';
import { createCategory, deleteCategory, getallCategory, updateCategory, getTrendingCategories, incrementCategoryClicks } from '../Controllers/CategoryController.js';
import upload from '../Middleware/Uploadmiddleware.js';
import { verifyAdminOrSeller } from '../Middleware/VerifyUser.js';


const CategoryRouter = express.Router();


// Public routes
CategoryRouter.get('/getall',getallCategory)
CategoryRouter.get('/trending',getTrendingCategories)
CategoryRouter.patch('/click/:id',incrementCategoryClicks)

// Admin/Seller routes
CategoryRouter.post('/create', verifyAdminOrSeller, upload.single('image'), createCategory)
CategoryRouter.patch('/update/:id', verifyAdminOrSeller, upload.single('image'), updateCategory)
CategoryRouter.delete('/delete/:id', verifyAdminOrSeller, deleteCategory)


export default CategoryRouter;
