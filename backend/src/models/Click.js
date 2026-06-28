const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', index: true },
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', default: null },
    provider: { type: String, default: 'unknown' },
    url: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Click', clickSchema);
