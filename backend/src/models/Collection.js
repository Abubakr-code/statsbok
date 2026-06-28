const mongoose = require('mongoose');

function makeSlug(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-￿-]/g, '')
    .slice(0, 80) +
    '-' + Date.now().toString(36);
}

const schema = new mongoose.Schema({
  blogger:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:     { type: String, required: true, trim: true, maxlength: 120 },
  titleEn:   { type: String, default: '', trim: true },
  titleRu:   { type: String, default: '', trim: true },
  slug:      { type: String, unique: true },
  niche:     { type: String, default: '', trim: true, maxlength: 60 },
  quotes:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quote' }],
  isPublic:  { type: Boolean, default: true },
  views:     { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

schema.pre('save', function (next) {
  if (!this.slug) this.slug = makeSlug(this.title);
  next();
});

module.exports = mongoose.model('Collection', schema);
