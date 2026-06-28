const Order = require('../models/Order');
const { handlePayme, clickPrepare, clickComplete } = require('../services/paymentService');

const PREMIUM_PRICE_UZS = 38000;

async function createPremiumOrder(req, res, next) {
  try {
    const provider = req.body.provider === 'click' ? 'click' : 'payme';
    const order = await Order.create({
      userId: req.user._id,
      type: 'premium_subscription',
      amount: PREMIUM_PRICE_UZS,
      currency: 'UZS',
      status: 'pending',
      paymentProvider: provider
    });
    res.status(201).json({ orderId: order._id, amount: order.amount, provider });
  } catch (err) {
    next(err);
  }
}

async function paymeWebhook(req, res, next) {
  try {
    res.json(await handlePayme(req));
  } catch (err) {
    next(err);
  }
}

async function clickPrepareHandler(req, res, next) {
  try {
    res.json(await clickPrepare(req.body));
  } catch (err) {
    next(err);
  }
}

async function clickCompleteHandler(req, res, next) {
  try {
    res.json(await clickComplete(req.body));
  } catch (err) {
    next(err);
  }
}

async function status(req, res, next) {
  try {
    const order = await Order.findById(req.params.orderId).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(order.userId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ orderId: order._id, status: order.status, type: order.type });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPremiumOrder,
  paymeWebhook,
  clickPrepareHandler,
  clickCompleteHandler,
  status
};
