const mongoose = require('mongoose');

const clothingItemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Clothing name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    // Free-text category e.g. "T-Shirt", "Jeans", "Sneakers"
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    categoryGroup: {
      type: String,
      enum: ['tops', 'bottoms', 'footwear', 'accessories', 'outerwear', 'dresses', 'suits', 'activewear'],
      default: 'tops',
    },
    color: {
      primary:   { type: String, required: [true, 'Primary color is required'], lowercase: true, trim: true },
      secondary: { type: String, lowercase: true, trim: true },
      hex:       { type: String, default: '#9E9E9E' },
    },
    brand:    { type: String, trim: true, maxlength: 50, default: null },
    season: {
      type: [String],
      enum: ['spring', 'summer', 'autumn', 'winter', 'all'],
      default: ['all'],
    },
    occasion: {
      type: [String],
      enum: ['casual', 'formal', 'business', 'sport', 'party', 'beach', 'travel'],
      default: ['casual'],
    },
    image: {
      url:       { type: String, required: [true, 'Image URL is required'] },
      publicId:  { type: String, required: true },
      thumbnail: { type: String },
    },
    style: {
      type: String,
      enum: ['classic', 'modern', 'sporty', 'bohemian', 'minimalist', 'streetwear', 'elegant', 'casual'],
      default: 'classic',
    },
    material:     { type: String, trim: true, default: null },
    size:         { type: String, trim: true, default: null },
    purchaseDate: { type: Date, default: null },
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'worn'],
      default: 'excellent',
    },
    notes:    { type: String, maxlength: 500, default: null },
    tags:     [{ type: String, lowercase: true, trim: true }],
    stats: {
      wornCount: { type: Number, default: 0 },
      lastWorn:  { type: Date, default: null },
      rating:    { type: Number, min: 0, max: 5, default: 0 },
    },
    aiDetected: {
      detected:          { type: Boolean, default: false },
      confidence:        { type: Number, default: 0 },
      suggestedCategory: { type: String },
      suggestedColor:    { type: String },
      suggestedStyle:    { type: String },
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

clothingItemSchema.index({ user: 1, categoryGroup: 1 });
clothingItemSchema.index({ user: 1, 'color.primary': 1 });
clothingItemSchema.index({ user: 1, occasion: 1 });
clothingItemSchema.index({ user: 1, season: 1 });
clothingItemSchema.index({ user: 1, 'stats.wornCount': 1 });

module.exports = mongoose.model('ClothingItem', clothingItemSchema);
