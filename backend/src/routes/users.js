const express = require('express');
const {
  saveQuote,
  unsaveQuote,
  savedQuotes,
  weeklySavedStats,
  setQuoteMeta,
  profile,
  updateProfile,
  changePassword
} = require('../controllers/usersController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.post('/save-quote/:quoteId', saveQuote);
router.delete('/save-quote/:quoteId', unsaveQuote);
router.patch('/save-quote/:quoteId/meta', setQuoteMeta);
router.get('/saved-quotes', savedQuotes);
router.get('/stats/weekly-saved', weeklySavedStats);
router.get('/profile', profile);
router.patch('/profile', updateProfile);
router.post('/change-password', changePassword);

module.exports = router;
