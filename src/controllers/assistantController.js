const ClothingItem = require('../models/ClothingItem');
const { getFashionAdvice } = require('../services/clothingDetectionService');

exports.chat = async (req, res, next) => {
  try {
    const { message, occasion, weather } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const wardrobe = await ClothingItem.find({
      user: req.user._id,
      isActive: true,
    })
      .select('name category categoryGroup color occasion season style brand')
      .lean();

    if (wardrobe.length === 0) {
      return res.status(400).json({
        error: 'Your wardrobe is empty. Please add clothes first before using the AI assistant.',
      });
    }

    const response = await getFashionAdvice(
      message,
      wardrobe,
      occasion || req.user.preferences?.defaultOccasion || 'casual',
      weather
    );

    res.status(200).json({ success: true, response, wardrobeItemCount: wardrobe.length });
  } catch (error) {
    if (error.message?.includes('unavailable')) {
      return res.status(503).json({ error: error.message });
    }
    next(error);
  }
};

exports.getOutfitSuggestion = async (req, res, next) => {
  try {
    const { occasion, weather, mood, event } = req.body;

    const wardrobe = await ClothingItem.find({ user: req.user._id, isActive: true }).lean();

    const prompt = `Give me a complete outfit suggestion for:
${occasion ? `Occasion: ${occasion}` : ''}
${weather ? `Weather: ${weather}` : ''}
${mood ? `My mood: ${mood}` : ''}
${event ? `Event: ${event}` : ''}

Please suggest a complete look with top, bottom, footwear, and any accessories from my wardrobe. Explain why these pieces work together.`;

    const response = await getFashionAdvice(prompt, wardrobe, occasion, weather);
    res.status(200).json({ success: true, suggestion: response });
  } catch (error) {
    next(error);
  }
};
