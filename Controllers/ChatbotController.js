import chatbotService from '../Utils/chatbotService.js';

/**
 * Process chatbot message
 * @route POST /api/chatbot/message
 */
const processMessage = async (req, res) => {
    try {
        const { message, category } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message is required',
                error: 'EMPTY_MESSAGE'
            });
        }

        // Process the message using RAG
        const result = await chatbotService.processMessage(message.trim(), category);

        if (result.success) {
            return res.status(200).json({
                success: true,
                data: {
                    answer: result.answer,
                    confidence: result.confidence,
                    category: result.context[0]?.category || 'general'
                }
            });
        } else {
            return res.status(200).json({
                success: false,
                message: result.message,
                data: {
                    answer: result.answer,
                    error: result.error
                }
            });
        }

    } catch (error) {
        console.error('Chatbot message processing error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: 'SERVER_ERROR'
        });
    }
};

/**
 * Add knowledge to the knowledge base
 * @route POST /api/chatbot/knowledge
 */
const addKnowledge = async (req, res) => {
    try {
        const { text, category, source, metadata } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Text content is required',
                error: 'EMPTY_TEXT'
            });
        }

        const result = await chatbotService.addKnowledge({
            text: text.trim(),
            category: category || 'general',
            source: source || 'manual',
            metadata: metadata || {}
        });

        if (result.success) {
            return res.status(201).json({
                success: true,
                message: 'Knowledge added successfully',
                data: result.data
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Add knowledge error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add knowledge',
            error: 'SERVER_ERROR'
        });
    }
};

/**
 * Get chatbot statistics
 * @route GET /api/chatbot/stats
 */
const getStatistics = async (req, res) => {
    try {
        const result = await chatbotService.getStatistics();

        if (result.success) {
            return res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.message,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Get statistics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get statistics',
            error: 'SERVER_ERROR'
        });
    }
};

/**
 * Search knowledge base
 * @route POST /api/chatbot/search
 */
const searchKnowledge = async (req, res) => {
    try {
        const { query, limit } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required',
                error: 'EMPTY_QUERY'
            });
        }

        const result = await chatbotService.searchKnowledge(query.trim(), limit || 10);

        return res.status(200).json({
            success: result.success,
            message: result.message,
            data: result
        });

    } catch (error) {
        console.error('Search knowledge error:', error);
        return res.status(500).json({
            success: false,
            message: 'Search failed',
            error: 'SERVER_ERROR'
        });
    }
};

/**
 * Get knowledge categories
 * @route GET /api/chatbot/categories
 */
const getCategories = async (req, res) => {
    try {
        const categories = [
            'faq',
            'policy',
            'product',
            'shipping',
            'returns',
            'support',
            'general'
        ];

        return res.status(200).json({
            success: true,
            data: categories
        });

    } catch (error) {
        console.error('Get categories error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get categories',
            error: 'SERVER_ERROR'
        });
    }
};

export {
    processMessage,
    addKnowledge,
    getStatistics,
    searchKnowledge,
    getCategories
};
