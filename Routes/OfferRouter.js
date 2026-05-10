import express from 'express';
import { createOffer, deleteOffer, getAllOffers, updateOffer, createBanner, getAllBanners, updateBanner, deleteBanner } from '../Controllers/OfferController.js';
import upload from '../Middleware/Uploadmiddleware.js';

const OfferRouter = express.Router();

// Offer routes
OfferRouter.post('/create', upload.single('image'), createOffer);
OfferRouter.get('/getall', getAllOffers);
OfferRouter.patch('/update/:id', upload.single('image'), updateOffer);
OfferRouter.delete('/delete/:id', deleteOffer);

// Banner routes
OfferRouter.post('/banner/create', upload.single('image'), createBanner);
OfferRouter.get('/banner/getall', getAllBanners);
OfferRouter.patch('/banner/update/:id', upload.single('image'), updateBanner);
OfferRouter.delete('/banner/delete/:id', deleteBanner);

export default OfferRouter;
