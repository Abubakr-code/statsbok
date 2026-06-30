const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { checkLibraryLimit, checkInsightLimit } = require('../middleware/libraryLimits');
const { validateObjectId } = require('../middleware/security');
const ctrl = require('../controllers/libraryController');

// All routes require auth
router.use(requireAuth);

// Stats (must be before /:id)
router.get('/stats', ctrl.getStats);
router.get('/stats/calendar', ctrl.getCalendar);

// Goal (must be before /:id)
router.get('/goal/:year', ctrl.getGoal);
router.post('/goal', ctrl.setGoal);
router.put('/goal/:year', ctrl.setGoal);

// ISBN / Lookup (must be before /:id)
router.get('/isbn/:isbn', ctrl.lookupISBN);
router.get('/lookup', ctrl.lookupByQuery);

// Library CRUD
router.get('/', ctrl.getLibrary);
router.post('/', checkLibraryLimit, ctrl.addBook);
router.get('/:id', validateObjectId(), ctrl.getBook);
router.get('/:id/pdf', validateObjectId(), ctrl.streamPdf);
router.put('/:id', validateObjectId(), ctrl.updateBook);
router.delete('/:id', validateObjectId(), ctrl.deleteBook);

// Shelf
router.patch('/:id/shelf', validateObjectId(), ctrl.changeShelf);

// Progress
router.patch('/:id/progress', validateObjectId(), ctrl.updateProgress);
router.post('/:id/session', validateObjectId(), ctrl.addSession);

// Review
router.put('/:id/review', validateObjectId(), ctrl.updateReview);
router.patch('/:id/review/toggle', validateObjectId(), ctrl.toggleReviewPublic);

// Insights
router.post('/:id/insights', validateObjectId(), checkInsightLimit, ctrl.addInsight);
router.delete('/:id/insights/:iid', validateObjectId(), ctrl.deleteInsight);

module.exports = router;
