const mongoose = require('mongoose');

const outfitHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    weeklyPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WeeklyPlan',
      default: null,
    },
    date: { type: Date, required: true, index: true },
    items: [
      {
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'ClothingItem', required: true },
        role: {
          type: String,
          enum: ['top', 'bottom', 'footwear', 'accessory'],
          required: true,
        },
      },
    ],
    occasion: {
      type: String,
      enum: ['casual', 'formal', 'business', 'sport', 'party'],
      default: 'casual',
    },
    weather: {
      temperature: { type: Number, default: null },
      condition: { type: String, default: null },
      city: { type: String, default: null },
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    feedback: {
      type: String,
      maxlength: [500, 'Feedback cannot exceed 500 characters'],
      default: null,
    },
    source: {
      type: String,
      enum: ['ai_generated', 'user_custom', 'ai_assistant'],
      default: 'ai_generated',
    },
    colorScheme: { type: String, default: null },
    tags: [{ type: String, lowercase: true }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

outfitHistorySchema.index({ user: 1, date: -1 });
outfitHistorySchema.index({ user: 1, occasion: 1 });
outfitHistorySchema.index({ user: 1, rating: -1 });

module.exports = mongoose.model('OutfitHistory', outfitHistorySchema);
