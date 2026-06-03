const ClothingItem = require('../models/ClothingItem');
const OutfitHistory = require('../models/OutfitHistory');
const {
  getOutfitColorScore,
  getColorHarmonyName,
} = require('./colorMatcherService');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const SEASON_MAP = {
  winter: ['winter', 'all'],
  summer: ['summer', 'all'],
  spring: ['spring', 'all'],
  autumn: ['autumn', 'all'],
  fall: ['autumn', 'all'],
  all: ['spring', 'summer', 'autumn', 'winter', 'all'],
};

const STYLE_COMPATIBILITY = {
  classic: ['classic', 'minimalist', 'modern'],
  modern: ['modern', 'classic', 'minimalist', 'streetwear'],
  sporty: ['sporty', 'streetwear', 'modern'],
  bohemian: ['bohemian', 'minimalist', 'classic'],
  minimalist: ['minimalist', 'classic', 'modern', 'bohemian'],
  streetwear: ['streetwear', 'sporty', 'modern'],
};

const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
};

const getWeekDates = (weekOffset = 0) => {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  return DAYS.map((dayName, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { day: dayName, date };
  });
};

const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const getUsageScore = (item, recentHistory) => {
  const recentlyWorn = recentHistory.find(
    (h) => h.items.some((i) => i.item.toString() === item._id.toString())
  );
  const daysSinceLastWorn = item.stats.lastWorn
    ? Math.floor((Date.now() - new Date(item.stats.lastWorn)) / 86400000)
    : 999;

  let score = 0;
  if (!recentlyWorn) score += 40;
  else score += Math.min(40, daysSinceLastWorn * 2);

  const wornCount = item.stats.wornCount || 0;
  if (wornCount === 0) score += 30;
  else if (wornCount < 3) score += 20;
  else if (wornCount < 10) score += 10;
  else score += 0;

  return score;
};

const getStyleScore = (top, bottom) => {
  if (!top?.style || !bottom?.style) return 50;
  const compatible = STYLE_COMPATIBILITY[top.style] || [];
  return compatible.includes(bottom.style) ? 80 : 20;
};

const getOccasionScore = (items, targetOccasion) => {
  let totalScore = 0;
  const validItems = items.filter(Boolean);
  validItems.forEach((item) => {
    if (item.occasion?.includes(targetOccasion)) totalScore += 100;
    else if (item.occasion?.includes('casual') && targetOccasion === 'casual') totalScore += 80;
    else totalScore += 20;
  });
  return validItems.length > 0 ? totalScore / validItems.length : 50;
};

const getSeasonScore = (items, currentSeason) => {
  const validSeasons = SEASON_MAP[currentSeason] || ['all'];
  let totalScore = 0;
  const validItems = items.filter(Boolean);
  validItems.forEach((item) => {
    const itemSeasons = item.season || ['all'];
    const matches = itemSeasons.some((s) => validSeasons.includes(s));
    totalScore += matches ? 100 : 30;
  });
  return validItems.length > 0 ? totalScore / validItems.length : 50;
};

const getVarietyScore = (items, alreadySelectedOutfits) => {
  if (alreadySelectedOutfits.length === 0) return 100;
  let score = 100;

  for (const selectedOutfit of alreadySelectedOutfits) {
    for (const item of items.filter(Boolean)) {
      const isDuplicate = [
        selectedOutfit.top,
        selectedOutfit.bottom,
        selectedOutfit.footwear,
        selectedOutfit.accessory,
      ].some((s) => s && s._id?.toString() === item._id?.toString());
      if (isDuplicate) score -= 25;
    }
  }

  return Math.max(0, score);
};

const scoreOutfitCombination = (top, bottom, footwear, accessory, context) => {
  const { occasion, season, recentHistory, alreadySelected } = context;
  const items = [top, bottom, footwear, accessory].filter(Boolean);

  const colorScore = getOutfitColorScore(top, bottom, footwear, accessory);
  const usageScore =
    items.reduce((sum, item) => sum + getUsageScore(item, recentHistory), 0) / items.length;
  const styleScore = getStyleScore(top, bottom);
  const occasionScore = getOccasionScore(items, occasion);
  const seasonScore = getSeasonScore(items, season);
  const varietyScore = getVarietyScore(items, alreadySelected);

  return (
    colorScore * 0.30 +
    usageScore * 0.25 +
    styleScore * 0.15 +
    occasionScore * 0.15 +
    seasonScore * 0.10 +
    varietyScore * 0.05
  );
};

const filterByOccasion = (items, occasion) => {
  const directMatch = items.filter((i) => i.occasion?.includes(occasion));
  if (directMatch.length > 0) return directMatch;
  return items;
};

const filterBySeason = (items, season) => {
  const validSeasons = SEASON_MAP[season] || ['all'];
  const seasonMatch = items.filter((i) =>
    i.season?.some((s) => validSeasons.includes(s))
  );
  if (seasonMatch.length > 0) return seasonMatch;
  return items;
};

const generateDayOutfit = (wardrobe, context) => {
  const { occasion, season, recentHistory, alreadySelected } = context;

  const tops = filterBySeason(
    filterByOccasion(wardrobe.filter((i) => i.categoryGroup === 'tops'), occasion),
    season
  );
  const bottoms = filterBySeason(
    filterByOccasion(wardrobe.filter((i) => i.categoryGroup === 'bottoms'), occasion),
    season
  );
  const footwear = wardrobe.filter((i) => i.categoryGroup === 'footwear');
  const accessories = wardrobe.filter((i) => i.categoryGroup === 'accessories');

  if (tops.length === 0 || bottoms.length === 0) return null;

  let bestScore = -1;
  let bestOutfit = null;

  const topSample = tops.slice(0, Math.min(tops.length, 8));
  const bottomSample = bottoms.slice(0, Math.min(bottoms.length, 8));
  const footwearSample = footwear.slice(0, Math.min(footwear.length, 5));
  const accessorySample = accessories.slice(0, Math.min(accessories.length, 3));

  for (const top of topSample) {
    for (const bottom of bottomSample) {
      const shoe = footwearSample.length > 0
        ? footwearSample.reduce((best, fw) => {
            const s = getOutfitColorScore(top, bottom, fw, null);
            return !best || s > getOutfitColorScore(top, bottom, best, null) ? fw : best;
          }, null)
        : null;

      const accessory = accessorySample.length > 0 ? accessorySample[0] : null;

      const score = scoreOutfitCombination(top, bottom, shoe, accessory, {
        occasion, season, recentHistory, alreadySelected,
      });

      if (score > bestScore) {
        bestScore = score;
        bestOutfit = { top, bottom, footwear: shoe, accessory, score };
      }
    }
  }

  if (!bestOutfit) return null;

  return {
    top: bestOutfit.top._id,
    bottom: bestOutfit.bottom._id,
    footwear: bestOutfit.footwear?._id || null,
    accessory: bestOutfit.accessory?._id || null,
    score: Math.round(bestScore),
    colorHarmony: getColorHarmonyName(bestOutfit.top, bestOutfit.bottom),
  };
};

const generateWeeklyOutfits = async (userId, options = {}) => {
  const {
    occasion = 'casual',
    weekOffset = 0,
    dayOccasions = {},
  } = options;

  const season = getCurrentSeason();
  const weekDates = getWeekDates(weekOffset);

  const wardrobe = await ClothingItem.find({
    user: userId,
    isActive: true,
  }).lean();

  if (wardrobe.length === 0) {
    throw new Error('Your wardrobe is empty. Please add clothes first.');
  }

  const tops = wardrobe.filter((i) => i.categoryGroup === 'tops');
  const bottoms = wardrobe.filter((i) => i.categoryGroup === 'bottoms');
  if (tops.length === 0 || bottoms.length === 0) {
    throw new Error('You need at least one top and one bottom to generate outfits.');
  }

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const recentHistory = await OutfitHistory.find({
    user: userId,
    date: { $gte: fourWeeksAgo },
  }).lean();

  const alreadySelected = [];
  const days = [];

  for (const { day, date } of weekDates) {
    const dayOccasion = dayOccasions[day] || occasion;
    const outfit = generateDayOutfit(wardrobe, {
      occasion: dayOccasion,
      season,
      recentHistory,
      alreadySelected,
    });

    if (outfit) {
      const topItem = wardrobe.find((i) => i._id.toString() === outfit.top?.toString());
      const bottomItem = wardrobe.find((i) => i._id.toString() === outfit.bottom?.toString());
      const footwearItem = wardrobe.find((i) => i._id.toString() === outfit.footwear?.toString());
      const accessoryItem = wardrobe.find((i) => i._id.toString() === outfit.accessory?.toString());
      alreadySelected.push({ top: topItem, bottom: bottomItem, footwear: footwearItem, accessory: accessoryItem });
    }

    days.push({ day, date, outfit, occasion: dayOccasions[day] || occasion });
  }

  const weekStart = weekDates[0].date;
  const weekEnd = weekDates[6].date;
  const weekNumber = getWeekNumber(weekStart);

  return {
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    weekNumber,
    year: weekStart.getFullYear(),
    days,
    generationContext: { occasion, season },
  };
};

const regenerateDayOutfit = async (userId, dayPlan, excludeOutfit) => {
  const season = getCurrentSeason();
  const wardrobe = await ClothingItem.find({ user: userId, isActive: true }).lean();

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const recentHistory = await OutfitHistory.find({
    user: userId,
    date: { $gte: fourWeeksAgo },
  }).lean();

  const excluded = [excludeOutfit].filter(Boolean);

  const outfit = generateDayOutfit(wardrobe, {
    occasion: dayPlan.occasion || 'casual',
    season,
    recentHistory,
    alreadySelected: excluded,
  });

  return outfit;
};

module.exports = { generateWeeklyOutfits, regenerateDayOutfit, getCurrentSeason, getWeekNumber };
