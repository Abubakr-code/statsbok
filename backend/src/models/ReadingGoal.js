const mongoose = require('mongoose');

const readingGoalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  year: { type: Number, required: true },
  targetBooks: { type: Number, required: true },
  targetPages: Number,
  completedBooks: { type: Number, default: 0 },
  completedPages: { type: Number, default: 0 }
}, { timestamps: true });

readingGoalSchema.index({ userId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('ReadingGoal', readingGoalSchema);
