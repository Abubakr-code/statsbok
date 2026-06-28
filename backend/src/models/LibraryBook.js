const mongoose = require('mongoose');

const insightSchema = new mongoose.Schema({
  text: { type: String, required: true },
  pageNumber: Number,
  createdAt: { type: Date, default: Date.now }
});

const readingSessionSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  pagesRead: { type: Number, default: 0 },
  minutesRead: { type: Number, default: 0 },
  currentPage: Number
});

const libraryBookSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  year: Number,
  isbn: String,
  coverUrl: String,
  genre: String,
  language: { type: String, enum: ['uz', 'ru', 'en', 'other'], default: 'uz' },
  totalPages: Number,
  description: String,
  tags: [String],
  shelf: {
    type: String,
    enum: ['reading', 'finished', 'want', 'wishlist', 'dropped'],
    default: 'want'
  },
  currentPage: { type: Number, default: 0 },
  startedAt: Date,
  finishedAt: Date,
  rating: { type: Number, min: 1, max: 5 },
  isPublic: { type: Boolean, default: false },
  review: {
    text: { type: String, default: '' },
    isPublic: { type: Boolean, default: false },
    publicSlug: String,
    createdAt: Date,
    updatedAt: Date
  },
  insights: [insightSchema],
  readingSessions: [readingSessionSchema],
  statbooksBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  source: { type: String, enum: ['isbn', 'search', 'manual', 'statbooks'], default: 'manual' }
}, { timestamps: true });

libraryBookSchema.index({ userId: 1, shelf: 1 });
libraryBookSchema.index({ userId: 1, 'review.publicSlug': 1 });

module.exports = mongoose.model('LibraryBook', libraryBookSchema);
