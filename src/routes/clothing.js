const express = require('express');
const router = express.Router();
const clothingController = require('../controllers/clothingController');
const { protect } = require('../middleware/auth');
const { clothingUploadMiddleware } = require('../config/cloudinary');

router.use(protect);

router.get('/', clothingController.getWardrobe);
router.get('/stats', clothingController.getWardrobeStats);
router.get('/:id', clothingController.getClothingItem);

// clothingUploadMiddleware = [multer memory, stream-to-cloudinary]
router.post('/', clothingUploadMiddleware, clothingController.addClothing);
router.post('/detect', clothingUploadMiddleware, clothingController.detectClothing);
router.put('/:id', clothingUploadMiddleware, clothingController.updateClothing);
router.delete('/:id', clothingController.deleteClothing);

module.exports = router;
