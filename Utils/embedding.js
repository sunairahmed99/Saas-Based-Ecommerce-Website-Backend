import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const genAI = new GoogleGenerativeAI(process.env.Gemni_apikey);

/**
 * Create vector embedding for text using Gemini
 * @param {string} text - Text to create embedding for
 * @returns {Promise<number[]>} - Vector embedding array
 */
export const createEmbedding = async (text) => {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Attempt with the most stable model first
    try {
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(text);
      if (result.embedding && result.embedding.values) {
        return result.embedding.values;
      }
    } catch (e) {

      const model = genAI.getGenerativeModel({ model: "embedding-001" });
      const result = await model.embedContent(text);
      if (result.embedding && result.embedding.values) {
        return result.embedding.values;
      }
    }

    throw new Error('All embedding models failed');
  } catch (error) {
    console.error('Error creating embedding:', error);
    // Return a zero vector of size 768 (standard for text-embedding-004)
    // so the database can still be populated for text-based fallback search
    return new Array(768).fill(0);
  }
};

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} - Similarity score between 0 and 1
 */
export const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (magA * magB);
};

/**
 * Find most similar texts from knowledge base
 * @param {string} query - User query
 * @param {Array} knowledgeBase - Array of knowledge objects with text and embedding
 * @param {number} topK - Number of top results to return
 * @returns {Array} - Top similar texts with scores
 */
export const findSimilarTexts = async (query, knowledgeBase, topK = 5) => {
  try {
    // Create embedding for the query
    const queryEmbedding = await createEmbedding(query);

    // Calculate similarity scores
    const similarities = knowledgeBase.map(item => ({
      ...item,
      score: cosineSimilarity(queryEmbedding, item.embedding)
    }));

    // Sort by similarity score (descending)
    similarities.sort((a, b) => b.score - a.score);

    // Return top K results
    return similarities.slice(0, topK);
  } catch (error) {
    console.error('Error finding similar texts:', error);
    throw new Error(`Similarity search failed: ${error.message}`);
  }
};

/**
 * Generate response using Gemini with context
 * @param {string} userMessage - User's message
 * @param {string} context - Relevant context from knowledge base
 * @returns {Promise<string>} - AI generated response
 */
export const generateResponse = async (userMessage, context) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
You are a helpful customer support assistant for our ecommerce platform.

IMPORTANT: Answer based ONLY on the information provided below. If you don't find relevant information, say "I'm sorry, I don't have information about that. Please contact our support team."

Context Information:
${context}

User Question: ${userMessage}

Please provide a helpful, accurate response based on the context above. Keep your response concise but informative.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error(`Response generation failed: ${error.message}`);
  }
};
