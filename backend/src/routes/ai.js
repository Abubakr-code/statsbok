const express = require('express');
const { recommend, context, moodSearch, chat } = require('../controllers/aiController');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { aiChatLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// The floating assistant is available to everyone (anonymous included).
router.post('/chat', aiChatLimiter, optionalAuth, chat);

router.post('/recommend', requireAuth, recommend);
router.post('/context', requireAuth, context);
router.post('/mood-search', requireAuth, moodSearch);

module.exports = router;
