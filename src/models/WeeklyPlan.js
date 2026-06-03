const mongoose = require('mongoose');

const outfitSchema = new mongoose.Schema(
  {
    top: { type: mongoose.Schema.Types.ObjectId, ref: 'ClothingItem', default: null },
    bottom: { type: mongoose.Schema.Types.ObjectId, ref: 'ClothingItem', default: null },
    footwear: { type: mongoose.Schema.Types.ObjectId, ref: 'ClothingItem', default: null },
    accessory: { type: mongoose.Schema.Types.ObjectId, ref: 'ClothingItem', default: null },
    occasion: {
      type: String,
      enum: ['casual', 'formal', 'business', 'sport', 'party'],
      default: 'casual',
    },
    score: { type: Number, default: 0 },
    colorHarmony: { type: String, default: null },
    notes: { type: String, default: null },
    isWorn: { type: Boolean, default: false },
    wornAt: { type: Date, default: null },
    userRating: { type: Number, min: 1, max: 5, default: null },
    userFeedback: { type: String, default: null },
  },
  { _id: true }
);

const dayPlanSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true,
    },
    date: { type: Date, required: true },
    outfit: { type: outfitSchema, default: null },
    weatherForecast: {
      temperature: { type: Number, default: null },
      condition: { type: String, default: null },
      humidity: { type: Number, default: null },
    },
    occasion: {
      type: String,
      enum: ['casual', 'formal', 'business', 'sport', 'party'],
      default: 'casual',
    },
    isRegeneratable: { type: Boolean, default: true },
  },
  { _id: true }
);

const weeklyPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    weekStartDate: { type: Date, required: true },
    weekEndDate: { type: Date, required: true },
    weekNumber: { type: Number, required: true },
    year: { type: Number, required: true },
    days: [dayPlanSchema],
    generationContext: {
      occasion: { type: String, default: 'casual' },
      weather: { type: String, default: null },
      city: { type: String, default: null },
      preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed'],
      default: 'active',
    },
    generatedAt: { type: Date, default: Date.now },
    regeneratedCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

weeklyPlanSchema.index({ user: 1, weekStartDate: -1 });
weeklyPlanSchema.index({ user: 1, year: 1, weekNumber: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyPlan', weeklyPlanSchema);
