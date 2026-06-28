const express = require('express');
const { search, getById, trending } = require('../controllers/quotesController');
const { searchLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/search', searchLimiter, search);
router.get('/trending', trending);
router.get('/:id', getById);

module.exports = router;
