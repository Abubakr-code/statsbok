const mongoose = require('mongoose');

// Per-saved-quote organization (premium): a folder + free-form tags.
const savedMetaSchema = new mongoose.Schema(
  {
    quote: { type: String }, // Can be ObjectId or AI quote ID
    folder: { type: String, default: '', trim: true },
    tags: { type: [String], default: [] }
  },
  { _id: false }
);

const savedQuoteEventSchema = new mongoose.Schema(
  {
    quote: { type: String, required: true },
    savedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

// Store AI-generated quote data (when user saves AI search results)
const aiQuoteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // e.g., "ai-1781847266528-0"
    text: { type: String, default: '' },
    book: {
      title: { type: String, default: '' },
      titleUz: { type: String, default: null },
      author: { type: String, default: '' },
      year: { type: Number, default: null },
      coverImage: { type: String, default: null }
    },
    confidence: { type: Number, default: 0.75 },
    savedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // Current signup uses email or Google. Phone is kept only for old accounts.
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, default: undefined },
    phone: { type: String, unique: true, sparse: true, trim: true, default: undefined },
    googleId: { type: String, unique: true, sparse: true, default: undefined },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true },
    // Round profile photo (stored as a small data URL) and a short bio.
    avatarUrl: { type: String, default: null },
    bio: { type: String, default: '', maxlength: 300 },
    plan: { type: String, enum: ['free', 'premium'], default: 'free' },
    premiumUntil: { type: Date, default: null },
    savedQuotes: [{ type: String }], // Can be ObjectId (DB quotes) or string (AI quotes like 'ai-timestamp-idx')
    savedQuoteEvents: { type: [savedQuoteEventSchema], default: [] },
    savedAiQuotes: [{ type: aiQuoteSchema, default: [] }], // Store full AI quote data
    savedMeta: { type: [savedMetaSchema], default: [] },
    // 10 for free users; treated as unlimited for premium in the controllers
    savedLimit: { type: Number, default: 10 },
    language: { type: String, enum: ['uz', 'en', 'ru'], default: 'uz' },
    // Blogger
    isBlogger: { type: Boolean, default: false },
    bloggerProfile: {
      channelName:  { type: String, default: '' },
      channelLink:  { type: String, default: '' },
      followers:    { type: Number, default: 0 },
      niche:        { type: String, default: '' },
      bio:          { type: String, default: '', maxlength: 500 },
      verifiedBadge:{ type: Boolean, default: false },
      widgetClicks: { type: Number, default: 0 },
    },
    // Account verification via a 6-digit email code.
    followedBloggers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
    verified: { type: Boolean, default: false },
    verificationCodeHash: { type: String, default: null },
    verificationExpires: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

// Helper: is the user currently a paying premium member?
userSchema.methods.isPremium = function isPremium() {
  return this.plan === 'premium' && this.premiumUntil && this.premiumUntil > new Date();
};

module.exports = mongoose.model('User', userSchema);
