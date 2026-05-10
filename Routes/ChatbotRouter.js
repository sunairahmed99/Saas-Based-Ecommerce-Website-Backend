import express from 'express';
import {
    processMessage,
    addKnowledge,
    getStatistics,
    searchKnowledge,
    getCategories
} from '../Controllers/ChatbotController.js';
import verifyuser from '../Middleware/VerifyUser.js';

const ChatbotRouter = express.Router();

// Public routes (no authentication required for basic chatbot)
ChatbotRouter.post('/message', processMessage);
ChatbotRouter.get('/categories', getCategories);

// Protected routes (require authentication)
ChatbotRouter.post('/knowledge', verifyuser, addKnowledge);
ChatbotRouter.get('/stats', verifyuser, getStatistics);
ChatbotRouter.post('/search', verifyuser, searchKnowledge);

export default ChatbotRouter;
