const express = require('express');
const {
  createPremiumOrder,
  paymeWebhook,
  clickPrepareHandler,
  clickCompleteHandler,
  status
} = require('../controllers/paymentsController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/premium-order', requireAuth, createPremiumOrder);
router.post('/payme/webhook', paymeWebhook);
router.post('/click/prepare', clickPrepareHandler);
router.post('/click/complete', clickCompleteHandler);
router.get('/status/:orderId', requireAuth, status);

module.exports = router;
