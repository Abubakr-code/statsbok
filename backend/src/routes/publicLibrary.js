const router = require('express').Router();
const { getPublicReview } = require('../controllers/libraryController');

router.get('/reviews/:username/:slug', getPublicReview);

module.exports = router;
