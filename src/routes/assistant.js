const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const assistantController = require('../controllers/assistantController');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests. Please wait a moment.' },
});

router.use(protect);

router.post(
  '/chat',
  aiLimiter,
  [body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 500 })],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    next();
  },
  assistantController.chat
);

router.post('/suggest', aiLimiter, assistantController.getOutfitSuggestion);

module.exports = router;
