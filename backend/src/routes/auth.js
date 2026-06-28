const express = require('express');
const {
  register,
  verify,
  resendCode,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  googleLogin,
  googleClientId
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, codeLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/verify', codeLimiter, verify);
router.post('/resend-code', authLimiter, resendCode);
router.post('/login', authLimiter, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/google', authLimiter, googleLogin);
router.get('/google-client-id', googleClientId);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
