const WeeklyPlan = require('../models/WeeklyPlan');
const ClothingItem = require('../models/ClothingItem');
const OutfitHistory = require('../models/OutfitHistory');
const User = require('../models/User');
const { generateWeeklyOutfits, regenerateDayOutfit, getWeekNumber } = require('../services/outfitGeneratorService');
const { sendWeeklyPlanReady } = require('../services/notificationService');

const populatePlan = (plan) =>
  WeeklyPlan.findById(plan._id || plan)
    .populate('days.outfit.top', 'name category color image stats')
    .populate('days.outfit.bottom', 'name category color image stats')
    .populate('days.outfit.footwear', 'name category color image stats')
    .populate('days.outfit.accessory', 'name category color image stats');

exports.generateWeeklyPlan = async (req, res, next) => {
  try {
    const { occasion, weekOffset = 0, dayOccasions } = req.body;

    const generated = await generateWeeklyOutfits(req.user._id, {
      occasion: occasion || req.user.preferences?.defaultOccasion || 'casual',
      weekOffset: parseInt(weekOffset),
      dayOccasions: dayOccasions || {},
    });

    const existingPlan = await WeeklyPlan.findOne({
      user: req.user._id,
      year: generated.year,
      weekNumber: generated.weekNumber,
    });

    let plan;
    if (existingPlan) {
      existingPlan.days = generated.days;
      existingPlan.generationContext = generated.generationContext;
      existingPlan.status = 'active';
      existingPlan.generatedAt = new Date();
      existingPlan.regeneratedCount += 1;
      plan = await existingPlan.save();
    } else {
      plan = await WeeklyPlan.create({
        user: req.user._id,
        weekStartDate: generated.weekStartDate,
        weekEndDate: generated.weekEndDate,
        weekNumber: generated.weekNumber,
        year: generated.year,
        days: generated.days,
        generationContext: generated.generationContext,
        status: 'active',
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.outfitsGenerated': 7 },
    });

    if (req.user.fcmToken) {
      sendWeeklyPlanReady(req.user._id, req.user.fcmToken).catch(() => {});
    }

    const populated = await populatePlan(plan);
    res.status(200).json({ success: true, plan: populated });
  } catch (error) {
    if (error.message?.includes('empty') || error.message?.includes('need at least')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

exports.getCurrentWeekPlan = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekNumber = getWeekNumber(today);
    const year = today.getFullYear();

    const plan = await WeeklyPlan.findOne({
      user: req.user._id,
      year,
      weekNumber,
    });

    if (!plan) {
      return res.status(404).json({ error: 'No plan found for this week. Generate one!' });
    }

    const populated = await populatePlan(plan);
    res.status(200).json({ success: true, plan: populated });
  } catch (error) {
    next(error);
  }
};

exports.getPlanHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [plans, total] = await Promise.all([
      WeeklyPlan.find({ user: req.user._id })
        .sort('-weekStartDate')
        .skip(skip)
        .limit(parseInt(limit))
        .select('weekStartDate weekEndDate weekNumber year status generatedAt'),
      WeeklyPlan.countDocuments({ user: req.user._id }),
    ]);

    res.status(200).json({
      success: true,
      plans,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

exports.getTodayOutfit = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekNumber = getWeekNumber(today);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[today.getDay()];

    const plan = await WeeklyPlan.findOne({
      user: req.user._id,
      year: today.getFullYear(),
      weekNumber,
      status: 'active',
    });

    if (!plan) {
      return res.status(404).json({ error: 'No active plan for this week.' });
    }

    const dayPlan = plan.days.find((d) => d.day === todayName);
    if (!dayPlan?.outfit?.top) {
      return res.status(404).json({ error: 'No outfit planned for today.' });
    }

    const populated = await populatePlan(plan);
    const todayPopulated = populated.days.find((d) => d.day === todayName);

    res.status(200).json({ success: true, today: todayName, outfit: todayPopulated });
  } catch (error) {
    next(error);
  }
};

exports.regenerateDayOutfit = async (req, res, next) => {
  try {
    const { planId, day } = req.params;

    const plan = await WeeklyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found.' });
    }

    const dayPlanIndex = plan.days.findIndex((d) => d.day === day);
    if (dayPlanIndex === -1) {
      return res.status(404).json({ error: `Day "${day}" not found in plan.` });
    }

    const currentOutfit = plan.days[dayPlanIndex].outfit;
    const newOutfit = await regenerateDayOutfit(req.user._id, plan.days[dayPlanIndex], currentOutfit);

    if (!newOutfit) {
      return res.status(400).json({ error: 'Could not generate a different outfit. Add more clothes to your wardrobe.' });
    }

    plan.days[dayPlanIndex].outfit = newOutfit;
    plan.days[dayPlanIndex].isRegeneratable = true;
    plan.regeneratedCount += 1;
    await plan.save();

    const populated = await populatePlan(plan);
    const updatedDay = populated.days.find((d) => d.day === day);

    res.status(200).json({ success: true, day: updatedDay });
  } catch (error) {
    next(error);
  }
};

exports.markOutfitWorn = async (req, res, next) => {
  try {
    const { planId, day } = req.params;
    const { rating, feedback } = req.body;

    const plan = await WeeklyPlan.findOne({ _id: planId, user: req.user._id });
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });

    const dayPlan = plan.days.find((d) => d.day === day);
    if (!dayPlan?.outfit?.top) {
      return res.status(404).json({ error: 'No outfit found for this day.' });
    }

    dayPlan.outfit.isWorn = true;
    dayPlan.outfit.wornAt = new Date();
    if (rating) dayPlan.outfit.userRating = rating;
    if (feedback) dayPlan.outfit.userFeedback = feedback;
    await plan.save();

    const outfitItems = [
      { item: dayPlan.outfit.top, role: 'top' },
      { item: dayPlan.outfit.bottom, role: 'bottom' },
      { item: dayPlan.outfit.footwear, role: 'footwear' },
      { item: dayPlan.outfit.accessory, role: 'accessory' },
    ].filter((i) => i.item);

    await OutfitHistory.create({
      user: req.user._id,
      weeklyPlan: planId,
      date: dayPlan.date,
      items: outfitItems,
      occasion: dayPlan.occasion,
      rating: rating || null,
      feedback: feedback || null,
      colorScheme: dayPlan.outfit.colorHarmony,
    });

    await Promise.all(
      outfitItems.map(({ item }) =>
        ClothingItem.findByIdAndUpdate(item, {
          $inc: { 'stats.wornCount': 1 },
          $set: { 'stats.lastWorn': new Date() },
        })
      )
    );

    res.status(200).json({ success: true, message: 'Outfit marked as worn.' });
  } catch (error) {
    next(error);
  }
};
