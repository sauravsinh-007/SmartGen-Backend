const ClothingItem = require('../models/ClothingItem');
const OutfitHistory = require('../models/OutfitHistory');
const WeeklyPlan = require('../models/WeeklyPlan');

exports.getDashboardAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [
      totalItems,
      categoryBreakdown,
      topWornItems,
      leastWornItems,
      colorDistribution,
      occasionDistribution,
      recentOutfits,
      wardrobeUsage,
    ] = await Promise.all([
      ClothingItem.countDocuments({ user: userId, isActive: true }),
      ClothingItem.aggregate([
        { $match: { user: userId, isActive: true } },
        { $group: { _id: '$categoryGroup', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ClothingItem.find({ user: userId, isActive: true })
        .sort('-stats.wornCount')
        .limit(5)
        .select('name category color image stats'),
      ClothingItem.find({ user: userId, isActive: true, 'stats.wornCount': { $lt: 3 } })
        .sort('stats.wornCount')
        .limit(5)
        .select('name category color image stats'),
      ClothingItem.aggregate([
        { $match: { user: userId, isActive: true } },
        { $group: { _id: '$color.primary', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      ClothingItem.aggregate([
        { $match: { user: userId, isActive: true } },
        { $unwind: '$occasion' },
        { $group: { _id: '$occasion', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      OutfitHistory.find({ user: userId })
        .sort('-date')
        .limit(10)
        .populate('items.item', 'name category color image'),
      ClothingItem.aggregate([
        { $match: { user: userId, isActive: true } },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            wornAtLeastOnce: {
              $sum: { $cond: [{ $gt: ['$stats.wornCount', 0] }, 1, 0] },
            },
            neverWorn: {
              $sum: { $cond: [{ $eq: ['$stats.wornCount', 0] }, 1, 0] },
            },
            avgWornCount: { $avg: '$stats.wornCount' },
            maxWornCount: { $max: '$stats.wornCount' },
          },
        },
      ]),
    ]);

    const usage = wardrobeUsage[0] || { totalItems, wornAtLeastOnce: 0, neverWorn: 0, avgWornCount: 0 };
    const usagePercentage = totalItems > 0
      ? Math.round((usage.wornAtLeastOnce / totalItems) * 100)
      : 0;

    const outfitsThisMonth = await OutfitHistory.countDocuments({
      user: userId,
      date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    });

    res.status(200).json({
      success: true,
      analytics: {
        overview: {
          totalItems,
          usagePercentage,
          outfitsThisMonth,
          neverWorn: usage.neverWorn,
          avgWornPerItem: Math.round((usage.avgWornCount || 0) * 10) / 10,
        },
        categoryBreakdown,
        colorDistribution,
        occasionDistribution,
        topWornItems,
        leastWornItems,
        recentOutfits,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getWornHistory = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const history = await OutfitHistory.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({ success: true, history });
  } catch (error) {
    next(error);
  }
};

exports.getItemAnalytics = async (req, res, next) => {
  try {
    const item = await ClothingItem.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!item) {
      return res.status(404).json({ error: 'Clothing item not found.' });
    }

    const history = await OutfitHistory.find({
      user: req.user._id,
      'items.item': req.params.id,
    })
      .sort('-date')
      .limit(20)
      .select('date occasion rating weather');

    const avgRating = history.filter((h) => h.rating).reduce((sum, h, _, arr) => {
      return sum + h.rating / arr.length;
    }, 0);

    res.status(200).json({
      success: true,
      item,
      analytics: {
        wornCount: item.stats.wornCount,
        lastWorn: item.stats.lastWorn,
        avgRating: Math.round(avgRating * 10) / 10 || null,
        history,
      },
    });
  } catch (error) {
    next(error);
  }
};
