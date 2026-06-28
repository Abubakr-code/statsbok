const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    // Uzbek Latin version if the original input was Cyrillic
    textLatin: { type: String },
    // lowercase, punctuation removed - used for matching
    textNormalized: { type: String, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', index: true },
    pageNumber: { type: Number },
    chapterTitle: { type: String },
    language: { type: String, enum: ['en', 'uz', 'ru'], default: 'en' },
    source: {
      type: String,
      enum: ['gutenberg', 'google_books', 'user_submitted', 'partner', 'ai_generated'],
      default: 'gutenberg'
    },
    verified: { type: Boolean, default: false },
    upvotes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

// Text index so search works on a plain local MongoDB (non-Atlas fallback).
quoteSchema.index({ textNormalized: 'text', text: 'text' });

module.exports = mongoose.model('Quote', quoteSchema);
