const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', historyController.getHistory);
router.put('/:id/rate', historyController.rateOutfit);
router.delete('/:id', historyController.deleteHistoryEntry);

module.exports = router;
