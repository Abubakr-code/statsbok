/**
 * Payment integrations for Uzbekistan: Payme (JSON-RPC) and Click.
 *
 * Premium price: $3/month. Amounts are handled in UZS tiyin for Payme
 * (1 so'm = 100 tiyin), as required by the Payme protocol.
 */

const crypto = require('crypto');
const Order = require('../models/Order');
const User = require('../models/User');

const PREMIUM_DAYS = 30;

const PaymeError = {
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_PERFORM: -31008,
  ORDER_NOT_FOUND: -31050,
  UNAUTHORIZED: -32504
};

function grantPremium(user) {
  const base =
    user.premiumUntil && user.premiumUntil > new Date() ? user.premiumUntil : new Date();
  const until = new Date(base.getTime() + PREMIUM_DAYS * 24 * 60 * 60 * 1000);
  user.plan = 'premium';
  user.premiumUntil = until;
  user.savedLimit = Number.MAX_SAFE_INTEGER;
  return user.save();
}

/* ===== PAYME (JSON-RPC) ===== */

function verifyPaymeAuth(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  // Everything after the first colon is the password (passwords may contain colons)
  const key = decoded.split(':').slice(1).join(':');
  const secret = process.env.PAYME_SECRET_KEY || process.env.PAYME_TEST_SECRET_KEY;
  if (!secret) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(secret));
  } catch {
    return false; // buffers different length → not equal
  }
}

function paymeErrorResponse(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function paymeResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

async function handlePayme(req) {
  const { id, method, params } = req.body || {};

  if (!verifyPaymeAuth(req)) {
    return paymeErrorResponse(id, PaymeError.UNAUTHORIZED, 'Unauthorized');
  }

  if (!params) {
    return paymeErrorResponse(id, -32600, 'Invalid request: params missing');
  }

  switch (method) {
    case 'CheckPerformTransaction': {
      const order = await Order.findById(params.account && params.account.order_id);
      if (!order) return paymeErrorResponse(id, PaymeError.ORDER_NOT_FOUND, 'Order not found');
      if (params.amount !== order.amount * 100) {
        return paymeErrorResponse(id, PaymeError.INVALID_AMOUNT, 'Invalid amount');
      }
      return paymeResult(id, { allow: true });
    }

    case 'CreateTransaction': {
      const order = await Order.findById(params.account && params.account.order_id);
      if (!order) return paymeErrorResponse(id, PaymeError.ORDER_NOT_FOUND, 'Order not found');
      if (params.amount !== order.amount * 100) {
        return paymeErrorResponse(id, PaymeError.INVALID_AMOUNT, 'Invalid amount');
      }
      order.transactionId = params.id;
      order.paymentProvider = 'payme';
      if (order.status === 'pending') await order.save();
      return paymeResult(id, {
        create_time: Date.now(),
        transaction: order._id.toString(),
        state: 1
      });
    }

    case 'PerformTransaction': {
      // Atomic: only update status if still not paid (prevents double-grant on concurrent callbacks)
      const updated = await Order.findOneAndUpdate(
        { transactionId: params.id, status: { $ne: 'paid' } },
        { $set: { status: 'paid' } },
        { new: true }
      );
      const order = updated || await Order.findOne({ transactionId: params.id });
      if (!order) {
        return paymeErrorResponse(id, PaymeError.TRANSACTION_NOT_FOUND, 'Transaction not found');
      }
      if (updated && order.type === 'premium_subscription') {
        const user = await User.findById(order.userId);
        if (user) await grantPremium(user);
      }
      return paymeResult(id, {
        perform_time: Date.now(),
        transaction: order._id.toString(),
        state: 2
      });
    }

    case 'CancelTransaction': {
      const order = await Order.findOne({ transactionId: params.id });
      if (!order) {
        return paymeErrorResponse(id, PaymeError.TRANSACTION_NOT_FOUND, 'Transaction not found');
      }
      if (order.status === 'paid') {
        return paymeErrorResponse(id, PaymeError.CANNOT_PERFORM, 'Cannot cancel a completed transaction');
      }
      order.status = 'refunded';
      await order.save();
      return paymeResult(id, {
        cancel_time: Date.now(),
        transaction: order._id.toString(),
        state: -1
      });
    }

    case 'CheckTransaction': {
      const order = await Order.findOne({ transactionId: params.id });
      if (!order) {
        return paymeErrorResponse(id, PaymeError.TRANSACTION_NOT_FOUND, 'Transaction not found');
      }
      const state = order.status === 'paid' ? 2 : order.status === 'refunded' ? -1 : 1;
      return paymeResult(id, {
        create_time: order.createdAt.getTime(),
        perform_time: order.status === 'paid' ? order.createdAt.getTime() : 0,
        cancel_time: order.status === 'refunded' ? order.createdAt.getTime() : 0,
        transaction: order._id.toString(),
        state,
        reason: null
      });
    }

    case 'GetStatement': {
      const orders = await Order.find({
        paymentProvider: 'payme',
        createdAt: { $gte: new Date(params.from), $lte: new Date(params.to) }
      });
      return paymeResult(id, {
        transactions: orders.map((o) => ({
          id: o.transactionId,
          time: o.createdAt.getTime(),
          amount: o.amount * 100,
          account: { order_id: o._id.toString() },
          transaction: o._id.toString(),
          state: o.status === 'paid' ? 2 : o.status === 'refunded' ? -1 : 1
        }))
      });
    }

    default:
      return paymeErrorResponse(id, -32601, 'Method not found');
  }
}

/* ===== CLICK (Prepare + Complete, MD5 signed) ===== */

function clickSign(params, secret, action) {
  const parts = [params.click_trans_id, params.service_id, secret, params.merchant_trans_id];
  if (action === 'complete') parts.push(params.merchant_prepare_id);
  parts.push(params.amount, params.action, params.sign_time);
  return crypto.createHash('md5').update(parts.join('')).digest('hex');
}

function verifyClickSign(params, action) {
  const expected = clickSign(params, process.env.CLICK_SECRET_KEY, action);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(params.sign_string || ''), 'hex'));
  } catch {
    return false;
  }
}

async function clickPrepare(params) {
  if (!verifyClickSign(params, 'prepare')) {
    return { error: -1, error_note: 'Invalid sign' };
  }
  const order = await Order.findById(params.merchant_trans_id);
  if (!order) return { error: -5, error_note: 'Order not found' };
  if (Number(params.amount) !== order.amount) {
    return { error: -2, error_note: 'Invalid amount' };
  }
  order.paymentProvider = 'click';
  await order.save();
  return {
    click_trans_id: params.click_trans_id,
    merchant_trans_id: params.merchant_trans_id,
    merchant_prepare_id: order._id.toString(),
    error: 0,
    error_note: 'Success'
  };
}

async function clickComplete(params) {
  if (!verifyClickSign(params, 'complete')) {
    return { error: -1, error_note: 'Invalid sign' };
  }
  const order = await Order.findById(params.merchant_trans_id);
  if (!order) return { error: -5, error_note: 'Order not found' };

  if (Number(params.error) < 0) {
    order.status = 'failed';
    await order.save();
    return { error: Number(params.error), error_note: 'Payment failed' };
  }

  if (order.status !== 'paid') {
    order.status = 'paid';
    order.transactionId = String(params.click_trans_id);
    await order.save();
    if (order.type === 'premium_subscription') {
      const user = await User.findById(order.userId);
      if (user) await grantPremium(user);
    }
  }

  return {
    click_trans_id: params.click_trans_id,
    merchant_trans_id: params.merchant_trans_id,
    merchant_confirm_id: order._id.toString(),
    error: 0,
    error_note: 'Success'
  };
}

module.exports = { handlePayme, clickPrepare, clickComplete, grantPremium, PREMIUM_DAYS };
