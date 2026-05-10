import express from 'express';
import { addToFavorites, getFavorites, deleteFavorite, checkFavorite } from '../Controllers/FavoriteController.js';
import verifyuser from '../Middleware/VerifyUser.js';

const FavoriteRouter = express.Router();

// Add product to favorites (requires authentication)
FavoriteRouter.post('/add', verifyuser, addToFavorites);

// Get all favorites for a user (requires authentication)
FavoriteRouter.get('/getall', verifyuser, getFavorites);

// Get favorites by userId (alternative route)
FavoriteRouter.get('/getall/:userId', getFavorites);

// Check if product is in favorites
FavoriteRouter.get('/check/:productId', verifyuser, checkFavorite);

// Delete favorite by favorite ID
FavoriteRouter.delete('/delete/:id', verifyuser, deleteFavorite);

// Delete favorite by userId and productId
FavoriteRouter.delete('/remove', verifyuser, deleteFavorite);

export default FavoriteRouter;

