const ClothingItem = require('../models/ClothingItem');
const User = require('../models/User');
const { deleteFromCloudinary } = require('../config/cloudinary');
const { detectClothingFromImage } = require('../services/clothingDetectionService');

// Helper: parse a field that may arrive as JSON string, plain string, or array
const parseArrayField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return [value]; }
};

exports.addClothing = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload a clothing image.' });
    }

    const {
      name, category, categoryGroup,
      colorPrimary, colorHex, colorSecondary,
      brand, style, material, size, notes, tags,
    } = req.body;

    const season   = parseArrayField(req.body['season[]'] || req.body.season);
    const occasion = parseArrayField(req.body['occasion[]'] || req.body.occasion);

    // AI detection is optional — fails silently
    let aiDetected = { detected: false, confidence: 0 };
    try {
      aiDetected = await detectClothingFromImage(req.file.path);
    } catch (err) {
      console.error('AI detection skipped:', err.message);
    }

    const clothing = await ClothingItem.create({
      user:          req.user._id,
      name:          name || 'Unnamed Item',
      category:      category || aiDetected.category || 'Other',
      categoryGroup: categoryGroup || 'tops',
      color: {
        primary:   colorPrimary || aiDetected.primaryColor || 'unknown',
        secondary: colorSecondary || null,
        hex:       colorHex || '#9E9E9E',
      },
      brand:    brand    || null,
      season:   season.length   ? season   : ['all'],
      occasion: occasion.length ? occasion : ['casual'],
      style:    style    || aiDetected.style || 'classic',
      material: material || null,
      size:     size     || null,
      notes:    notes    || null,
      tags:     parseArrayField(tags),
      image: {
        url:       req.file.path,
        publicId:  req.file.filename,
        thumbnail: req.file.path,
      },
      aiDetected: {
        detected:          aiDetected.detected      || false,
        confidence:        aiDetected.confidence    || 0,
        suggestedCategory: aiDetected.category      || null,
        suggestedColor:    aiDetected.primaryColor  || null,
        suggestedStyle:    aiDetected.style         || null,
      },
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.totalClothes': 1 } });

    const populated = await ClothingItem.findById(clothing._id);
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.detectClothing = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload an image.' });
    }
    const result = await detectClothingFromImage(req.file.path);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getWardrobe = async (req, res, next) => {
  try {
    const {
      categoryGroup, color, occasion, season, search,
      sort = '-createdAt', page = 1, limit = 50,
    } = req.query;

    const query = { user: req.user._id, isActive: true };

    if (categoryGroup) query.categoryGroup = categoryGroup;
    if (color)         query['color.primary'] = { $regex: color, $options: 'i' };
    if (occasion)      query.occasion = occasion;
    if (season)        query.season = season;
    if (search)        query.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      ClothingItem.find(query).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      ClothingItem.countDocuments(query),
    ]);

    res.status(200).json({ success: true, data: { items, total } });
  } catch (error) {
    next(error);
  }
};

exports.getClothingItem = async (req, res, next) => {
  try {
    const item = await ClothingItem.findOne({ _id: req.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ success: false, error: 'Clothing item not found.' });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

exports.updateClothing = async (req, res, next) => {
  try {
    const item = await ClothingItem.findOne({ _id: req.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ success: false, error: 'Clothing item not found.' });

    const allowed = ['name', 'category', 'categoryGroup', 'brand', 'style', 'material', 'size', 'notes'];
    const updates = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (req.body.colorPrimary)   updates['color.primary']   = req.body.colorPrimary;
    if (req.body.colorHex)       updates['color.hex']        = req.body.colorHex;
    if (req.body.colorSecondary) updates['color.secondary']  = req.body.colorSecondary;

    const season   = parseArrayField(req.body['season[]']   || req.body.season);
    const occasion = parseArrayField(req.body['occasion[]'] || req.body.occasion);
    if (season.length)   updates.season   = season;
    if (occasion.length) updates.occasion = occasion;

    if (req.file) {
      if (item.image?.publicId) await deleteFromCloudinary(item.image.publicId);
      updates['image.url']      = req.file.path;
      updates['image.publicId'] = req.file.filename;
      updates['image.thumbnail']= req.file.path;
    }

    const updated = await ClothingItem.findByIdAndUpdate(
      req.params.id, { $set: updates }, { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteClothing = async (req, res, next) => {
  try {
    const item = await ClothingItem.findOne({ _id: req.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ success: false, error: 'Clothing item not found.' });

    if (item.image?.publicId) await deleteFromCloudinary(item.image.publicId);

    await ClothingItem.findByIdAndUpdate(req.params.id, { isActive: false });
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.totalClothes': -1 } });

    res.status(200).json({ success: true, message: 'Clothing item deleted.' });
  } catch (error) {
    next(error);
  }
};

exports.getWardrobeStats = async (req, res, next) => {
  try {
    const [categoryStats, colorStats, total, neverWorn] = await Promise.all([
      ClothingItem.aggregate([
        { $match: { user: req.user._id, isActive: true } },
        { $group: { _id: '$categoryGroup', count: { $sum: 1 }, avgWornCount: { $avg: '$stats.wornCount' } } },
      ]),
      ClothingItem.aggregate([
        { $match: { user: req.user._id, isActive: true } },
        { $group: { _id: '$color.primary', hex: { $first: '$color.hex' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      ClothingItem.countDocuments({ user: req.user._id, isActive: true }),
      ClothingItem.countDocuments({ user: req.user._id, isActive: true, 'stats.wornCount': 0 }),
    ]);

    res.status(200).json({
      success: true,
      data: { total, neverWorn, categoryStats, colorStats },
    });
  } catch (error) {
    next(error);
  }
};
