const express = require('express');
const { getById, preview, trending, bestSellers, like, unlike, getLikes } = require('../controllers/booksController');
const { optionalAuth } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/security');

const router = express.Router();

router.get('/trending', trending);
router.get('/best-sellers', bestSellers);
router.get('/:id/preview', validateObjectId(), optionalAuth, preview);
router.get('/:id/likes', validateObjectId(), getLikes);
router.post('/:id/like', validateObjectId(), optionalAuth, like);
router.post('/:id/unlike', validateObjectId(), optionalAuth, unlike);
router.get('/:id', validateObjectId(), getById);

module.exports = router;
