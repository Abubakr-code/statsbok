const express = require('express');
const { recommend, context, moodSearch, chat, findBook } = require('../controllers/aiController');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { aiChatLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/chat', aiChatLimiter, optionalAuth, chat);
router.post('/find-book', aiChatLimiter, optionalAuth, findBook);

router.post('/recommend', requireAuth, recommend);
router.post('/context', requireAuth, context);
router.post('/mood-search', requireAuth, moodSearch);

module.exports = router;
