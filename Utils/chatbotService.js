import KnowledgeBase from '../Models/KnowledgeBaseSchema.js';
import { createEmbedding, generateResponse } from './embedding.js';

/**
 * Chatbot Service with RAG (Retrieval Augmented Generation)
 */
class ChatbotService {

    /**
     * Process user message and generate response using RAG
     * @param {string} userMessage - User's message
     * @param {string} category - Optional category filter
     * @returns {Promise<Object>} - Response object with answer and context
     */
    async processMessage(userMessage, category = null) {
        try {
            if (!userMessage || userMessage.trim().length === 0) {
                return {
                    success: false,
                    message: 'Please provide a valid message',
                    answer: 'I\'m sorry, I didn\'t understand your message. Please try again.'
                };
            }

            // Create embedding for user message
            const queryEmbedding = await createEmbedding(userMessage.trim());

            // Find similar knowledge base entries
            let similarResults = await KnowledgeBase.findSimilar(queryEmbedding, 5, category);

            // Fallback: If no vector results, try keyword search
            if (!similarResults || similarResults.length === 0 || similarResults.every(r => r.similarity === 0)) {
                const words = userMessage.trim().split(/\s+/).filter(w => w.length > 3);
                if (words.length > 0) {
                    const regex = new RegExp(words.join('|'), 'i');
                    const keywordResults = await KnowledgeBase.find({
                        text: { $regex: regex },
                        active: true,
                        ...(category && { category })
                    }).limit(5);

                    if (keywordResults.length > 0) {
                        similarResults = keywordResults.map(r => ({
                            ...r.toObject(),
                            similarity: 0.5 // Artificial score for keywords
                        }));
                    }
                }
            }

            if (!similarResults || similarResults.length === 0) {
                return {
                    success: true,
                    message: 'No relevant information found',
                    answer: '🛍️ I\'m here to help with shopping, orders, and our store services. For other questions, please contact our customer support team.\n\nWhat would you like to know about our products?',
                    context: [],
                    confidence: 0
                };
            }

            // Filter results by similarity threshold (optional)
            const relevantResults = similarResults.filter(result => result.similarity > 0.1);

            if (relevantResults.length === 0) {
                return {
                    success: true,
                    message: 'Low confidence results',
                    answer: '🤔 I\'m not entirely sure about that. Could you please rephrase your question or ask about our products, orders, shipping, or returns?',
                    context: similarResults.slice(0, 2),
                    confidence: similarResults[0]?.similarity || 0
                };
            }

            // Prepare context from relevant results
            const context = relevantResults
                .map(result => result.text)
                .join('\n\n');

            // Check if the query is ecommerce-related
            const ecommerceKeywords = [
                'order', 'buy', 'purchase', 'product', 'item', 'shopping', 'cart',
                'shipping', 'delivery', 'return', 'refund', 'payment', 'price', 'cost',
                'warranty', 'size', 'color', 'stock', 'available', 'store', 'shop',
                'checkout', 'track', 'package', 'deliver', 'ship', 'fee', 'iphone',
                'samsung', 'laptop', 'phone', 'mobile', 'computer', 'electronic',
                'fashion', 'cloth', 'shirt', 'pant', 'shoes', 'dress', 'brand',
                'money', 'cash', 'card', 'online', 'pay', 'amount', 'rate', 'expensive',
                'cheap', 'discount', 'offer', 'sale', 'deal', 'how much', 'price of'
            ];

            const isEcommerceQuery = ecommerceKeywords.some(keyword =>
                userMessage.toLowerCase().includes(keyword)
            );

            let answer;

            if (isEcommerceQuery && relevantResults.length > 0) {
                // Provide ecommerce-specific answer
                answer = relevantResults[0].text;

                // Add helpful context based on category
                const category = relevantResults[0].category;
                if (category === 'shipping') {
                    answer += "\n\n🚚 Need help tracking your order? Visit your account dashboard!";
                } else if (category === 'policy') {
                    answer += "\n\n📋 Our policies ensure your shopping experience is safe and secure.";
                } else if (category === 'product') {
                    answer += "\n\n🛍️ Check out our full product catalog for more options!";
                }
            } else {
                // Generic greeting or non-ecommerce query
                if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
                    answer = "👋 Welcome to My Ecommerce Store! 🛍️\n\nI'm here to help you with:\n• Product information and pricing\n• Order tracking and shipping\n• Returns and refunds\n• Payment methods\n\nWhat would you like to know about our products or services?";
                } else {
                    answer = "🤔 I specialize in helping with shopping, orders, and our store services. For account login issues or general support, please visit our login page or contact customer support.\n\n💡 What can I help you shop for today?";
                }
            }

            // Update usage count for retrieved knowledge
            await this.updateUsageCount(relevantResults.slice(0, 3));

            return {
                success: true,
                message: 'Knowledge retrieved successfully',
                answer: answer,
                context: relevantResults.slice(0, 3),
                confidence: relevantResults[0].similarity,
                totalResults: relevantResults.length
            };

        } catch (error) {
            console.error('Chatbot service error:', error);
            // Fallback for AI or Database errors
            return {
                success: true,
                message: 'Fallback response due to error',
                answer: '👋 I\'m currently learning more about our store. While my advanced AI features are calibrating, I can tell you that we offer premium products, fast shipping, and secure checkout.\n\nHow can I assist you with your shopping today?',
                context: [],
                confidence: 0
            };
        }
    }

    /**
     * Add new knowledge to the knowledge base
     * @param {Object} knowledgeData - Knowledge data
     * @returns {Promise<Object>} - Created knowledge entry
     */
    async addKnowledge(knowledgeData) {
        try {
            const { text, category = 'general', source = 'manual', metadata = {} } = knowledgeData;

            if (!text || text.trim().length === 0) {
                throw new Error('Text content is required');
            }

            // Create embedding for the text
            const embedding = await createEmbedding(text.trim());

            // Create knowledge entry
            const knowledge = new KnowledgeBase({
                text: text.trim(),
                embedding: embedding,
                category: category,
                source: source,
                metadata: metadata,
                active: true
            });

            await knowledge.save();

            return {
                success: true,
                message: 'Knowledge added successfully',
                data: knowledge
            };

        } catch (error) {
            console.error('Error adding knowledge:', error);
            return {
                success: false,
                message: error.message,
                error: error.message
            };
        }
    }

    /**
     * Update usage count for knowledge entries
     * @param {Array} knowledgeEntries - Array of knowledge entries
     */
    async updateUsageCount(knowledgeEntries) {
        try {
            const ids = knowledgeEntries.map(entry => entry._id);
            await KnowledgeBase.updateMany(
                { _id: { $in: ids } },
                { $inc: { usageCount: 1 } }
            );
        } catch (error) {
            console.error('Error updating usage count:', error);
        }
    }

    /**
     * Get chatbot statistics
     * @returns {Promise<Object>} - Statistics data
     */
    async getStatistics() {
        try {
            const stats = await KnowledgeBase.aggregate([
                {
                    $group: {
                        _id: null,
                        totalEntries: { $sum: 1 },
                        activeEntries: {
                            $sum: { $cond: ['$active', 1, 0] }
                        },
                        totalUsage: { $sum: '$usageCount' },
                        categories: { $addToSet: '$category' }
                    }
                }
            ]);

            const categoryStats = await KnowledgeBase.aggregate([
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        usage: { $sum: '$usageCount' }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            return {
                success: true,
                data: {
                    overview: stats[0] || {
                        totalEntries: 0,
                        activeEntries: 0,
                        totalUsage: 0,
                        categories: []
                    },
                    categoryBreakdown: categoryStats
                }
            };

        } catch (error) {
            console.error('Error getting statistics:', error);
            return {
                success: false,
                message: error.message,
                error: error.message
            };
        }
    }

    /**
     * Search knowledge base directly (for admin purposes)
     * @param {string} query - Search query
     * @param {number} limit - Number of results
     * @returns {Promise<Object>} - Search results
     */
    async searchKnowledge(query, limit = 10) {
        try {
            const results = await this.processMessage(query);
            return results;
        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: error.message
            };
        }
    }
}

export default new ChatbotService();
