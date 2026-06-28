const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    titleUz: { type: String, trim: true },
    author: { type: String, required: true, trim: true, index: true },
    authorUz: { type: String, trim: true },
    year: { type: Number },
    coverImage: { type: String },
    description: { type: String },
    descriptionUz: { type: String },
    // 1 page text for preview
    previewPages: { type: [String], default: [] },
    isSentencePreview: { type: Boolean, default: false },
    language: { type: String, enum: ['en', 'uz', 'ru'], default: 'en' },
    gutenbergId: { type: String, index: true },
    googleBooksId: { type: String, index: true },
    affiliateLink: { type: String },
    affiliateCommission: { type: Number, default: 0 },
    totalQuotes: { type: Number, default: 0 },
    source: { type: String },
    // New: track book popularity
    likes: { type: Number, default: 0, index: true },
    likedBy: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Book', bookSchema);
