const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', analyticsController.getDashboardAnalytics);
router.get('/worn-history', analyticsController.getWornHistory);
router.get('/item/:id', analyticsController.getItemAnalytics);

module.exports = router;
