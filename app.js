import './Utils/silenceConsole.js';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import UserRouter from './Routes/UserRouter.js';
import SellerRouter from './Routes/SellerRouter.js';
import CategoryRouter from './Routes/CategoryRouter.js';
import ProductRouter from './Routes/ProductRouter.js';
import InventoryRouter from './Routes/InventoryRouter.js';
import SubCategoryRouter from './Routes/SubcategoryRouter.js';
import OfferRouter from './Routes/OfferRouter.js';
import FlashDealRouter from './Routes/FlashDealRouter.js';
import FavoriteRouter from './Routes/FavoriteRouter.js';
import CartRouter from './Routes/CartRouter.js';
import AddressRouter from './Routes/AddressRouter.js';
import CouponRouter from './Routes/CouponRouter.js';
import CheckoutRouter from './Routes/CheckoutRouter.js';
import NotificationRouter from './Routes/NotificationRouter.js';
import ContactRouter from './Routes/ContactRouter.js';
import ReviewRouter from './Routes/ReviewRouter.js';
import RefundRouter from './Routes/RefundRouter.js';
import BoostPackageRouter from './Routes/BoostPackageRouter.js';
import ProductBoostRouter from './Routes/ProductBoostRouter.js';
import WalletRouter from './Routes/WalletRouter.js';
import AnalyticsRouter from './Routes/AnalyticsRouter.js';
import PaymentRouter from './Routes/PaymentRouter.js';
import ChatbotRouter from './Routes/ChatbotRouter.js';
import ChatRouter from './Routes/ChatRouter.js';
import PlatformSettingsRouter from './Routes/PlatformSettingsRoute.js';
import passport from './Utils/passport.js';

const app = express();

// Security and Performance Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression({
  level: 6,
  threshold: 1024
}));

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(null, true); // Allow all during development or refine logic
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'auth_token', 'seller_auth_token', 'admin_auth_token', 'seller_id']
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Initialize Passport
app.use(passport.initialize());




app.use('/user', UserRouter)
app.use('/seller', SellerRouter)
app.use('/category', CategoryRouter)
app.use('/product', ProductRouter)
app.use('/inventory', InventoryRouter)
app.use('/subcategory', SubCategoryRouter)
app.use('/offer', OfferRouter);
app.use('/flashdeal', FlashDealRouter);
app.use('/favorite', FavoriteRouter);
app.use('/cart', CartRouter);
app.use('/address', AddressRouter);
app.use('/coupon', CouponRouter);
app.use('/checkout', CheckoutRouter);
app.use('/notifications', NotificationRouter);
app.use('/contact', ContactRouter);
app.use('/review', ReviewRouter);
app.use('/refund', RefundRouter);
app.use('/boostpackage', BoostPackageRouter);
app.use('/boost', ProductBoostRouter);
app.use('/wallet', WalletRouter);
app.use('/analytics', AnalyticsRouter);
app.use('/api/payment', PaymentRouter);
app.use('/api/chatbot', ChatbotRouter);
app.use('/api/chat', ChatRouter);
app.use('/api/platform-settings', PlatformSettingsRouter);

// Health check route
app.get('/ping', (req, res) => res.send('Pong from New folder (5)'));

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  // Never expose internals in production
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    status: 'error',
    message: isProd ? 'Something went wrong. Please try again.' : err.message,
  });
});



export default app;