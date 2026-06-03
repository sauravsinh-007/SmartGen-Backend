const express = require('express');
const router = express.Router();
const plannerController = require('../controllers/plannerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/generate', plannerController.generateWeeklyPlan);
router.get('/current', plannerController.getCurrentWeekPlan);
router.get('/today', plannerController.getTodayOutfit);
router.get('/history', plannerController.getPlanHistory);
router.post('/:planId/day/:day/regenerate', plannerController.regenerateDayOutfit);
router.post('/:planId/day/:day/worn', plannerController.markOutfitWorn);

module.exports = router;
