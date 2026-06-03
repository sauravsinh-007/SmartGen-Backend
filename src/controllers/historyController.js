const OutfitHistory = require('../models/OutfitHistory');

exports.getHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, occasion, startDate, endDate, minRating } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { user: req.user._id };
    if (occasion) query.occasion = occasion;
    if (minRating) query.rating = { $gte: parseInt(minRating) };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const [history, total] = await Promise.all([
      OutfitHistory.find(query)
        .sort('-date')
        .skip(skip)
        .limit(parseInt(limit))
        .populate('items.item', 'name category color image'),
      OutfitHistory.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      history,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.rateOutfit = async (req, res, next) => {
  try {
    const { rating, feedback } = req.body;

    const entry = await OutfitHistory.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({ error: 'Outfit history entry not found.' });
    }

    entry.rating = rating;
    if (feedback) entry.feedback = feedback;
    await entry.save();

    res.status(200).json({ success: true, entry });
  } catch (error) {
    next(error);
  }
};

exports.deleteHistoryEntry = async (req, res, next) => {
  try {
    const entry = await OutfitHistory.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!entry) {
      return res.status(404).json({ error: 'History entry not found.' });
    }

    res.status(200).json({ success: true, message: 'History entry deleted.' });
  } catch (error) {
    next(error);
  }
};
