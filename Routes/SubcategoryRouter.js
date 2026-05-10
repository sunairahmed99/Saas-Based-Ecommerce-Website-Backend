import express from 'express';
import upload from '../Middleware/Uploadmiddleware.js';
import { createSubcategory,deleteSubcategory,getAllSubcategories, updateSubcategory } from '../Controllers/SubcategoryController.js';
import { verifyAdmin } from '../Middleware/VerifyUser.js';


const SubCategoryRouter = express.Router();


// Public routes
SubCategoryRouter.get('/getall',getAllSubcategories)

// Admin routes
SubCategoryRouter.post('/create', verifyAdmin, upload.single('image'), createSubcategory)
SubCategoryRouter.patch('/update/:id', verifyAdmin, upload.single('image'), updateSubcategory)
SubCategoryRouter.delete('/delete/:id', verifyAdmin, deleteSubcategory)


export default SubCategoryRouter;
