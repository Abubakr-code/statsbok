const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  telegramId:    { type: Number, unique: true, required: true },
  username:      { type: String, default: null },
  firstName:     { type: String, default: null },
  lang:          { type: String, enum: ['uz', 'ru', 'en'], default: 'uz' },
  subscribed:    { type: Boolean, default: false },
  statbooksUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  linkCode:        { type: String, default: null },
  linkCodeExpires: { type: Date, default: null },
  createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('TelegramUser', schema);
