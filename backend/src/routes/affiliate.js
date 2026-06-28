const express = require('express');
const { go } = require('../controllers/affiliateController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public redirect endpoint; attaches the user if logged in (for attribution).
router.get('/go', optionalAuth, go);

module.exports = router;
