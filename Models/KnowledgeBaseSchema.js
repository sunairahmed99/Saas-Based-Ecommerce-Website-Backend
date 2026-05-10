import mongoose from 'mongoose';

const KnowledgeBaseSchema = mongoose.Schema({
    // Original text content
    text: {
        type: String,
        required: [true, 'Text content is required'],
        trim: true
    },

    // Vector embedding for semantic search
    embedding: {
        type: [Number],
        required: [true, 'Embedding is required'],
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'Embedding cannot be empty'
        }
    },

    // Category for organization
    category: {
        type: String,
        enum: ['faq', 'policy', 'product', 'shipping', 'returns', 'support', 'general', 'seller', 'orders'],
        default: 'general'
    },

    // Source of the knowledge
    source: {
        type: String,
        enum: ['manual', 'product', 'faq', 'policy', 'auto'],
        default: 'manual'
    },

    // Reference to related entity (product ID, etc.)
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'referenceModel'
    },

    // Model name for reference
    referenceModel: {
        type: String,
        enum: ['Product', 'Category', 'User']
    },

    // Metadata
    metadata: {
        title: String,
        tags: [String],
        priority: {
            type: Number,
            min: 1,
            max: 10,
            default: 5
        }
    },

    // Status
    active: {
        type: Boolean,
        default: true
    },

    // Usage tracking
    usageCount: {
        type: Number,
        default: 0
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for vector search performance
KnowledgeBaseSchema.index({ embedding: 1 });
KnowledgeBaseSchema.index({ category: 1 });
KnowledgeBaseSchema.index({ active: 1 });
KnowledgeBaseSchema.index({ 'metadata.tags': 1 });

// Pre-save middleware to update updatedAt
KnowledgeBaseSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Static method to find similar texts
KnowledgeBaseSchema.statics.findSimilar = async function(queryEmbedding, limit = 5, category = null) {
    const pipeline = [
        {
            $match: {
                active: true,
                ...(category && { category })
            }
        },
        {
            $addFields: {
                similarity: {
                    $let: {
                        vars: {
                            queryVector: queryEmbedding
                        },
                        in: {
                            $divide: [
                                {
                                    $reduce: {
                                        input: { $range: [0, { $size: '$embedding' }] },
                                        initialValue: 0,
                                        in: {
                                            $add: [
                                                '$$value',
                                                { $multiply: [
                                                    { $arrayElemAt: ['$embedding', '$$this'] },
                                                    { $arrayElemAt: ['$$queryVector', '$$this'] }
                                                ]}
                                            ]
                                        }
                                    }
                                },
                                {
                                    $multiply: [
                                        {
                                            $sqrt: {
                                                $reduce: {
                                                    input: '$embedding',
                                                    initialValue: 0,
                                                    in: { $add: ['$$value', { $multiply: ['$$this', '$$this'] }] }
                                                }
                                            }
                                        },
                                        {
                                            $sqrt: {
                                                $reduce: {
                                                    input: '$$queryVector',
                                                    initialValue: 0,
                                                    in: { $add: ['$$value', { $multiply: ['$$this', '$$this'] }] }
                                                }
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        },
        { $sort: { similarity: -1 } },
        { $limit: limit },
        {
            $project: {
                text: 1,
                category: 1,
                metadata: 1,
                similarity: 1,
                referenceId: 1,
                referenceModel: 1
            }
        }
    ];

    return this.aggregate(pipeline);
};

const KnowledgeBase = mongoose.model('KnowledgeBase', KnowledgeBaseSchema);

export default KnowledgeBase;
