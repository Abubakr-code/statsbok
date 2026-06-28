const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['premium_subscription', 'book_purchase'],
      required: true
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'UZS' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true
    },
    paymentProvider: { type: String, enum: ['payme', 'click'], required: true },
    transactionId: { type: String, index: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Order', orderSchema);
