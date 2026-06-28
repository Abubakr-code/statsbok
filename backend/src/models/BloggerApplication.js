const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  channelName: { type: String, required: true, trim: true },
  channelLink: { type: String, required: true, trim: true },
  followers:   { type: Number, default: 0 },
  niche:       { type: String, default: '', trim: true },
  bio:         { type: String, default: '', trim: true, maxlength: 500 },
  status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt:   { type: Date, default: Date.now },
  reviewedAt:  { type: Date, default: null }
});

module.exports = mongoose.model('BloggerApplication', schema);
