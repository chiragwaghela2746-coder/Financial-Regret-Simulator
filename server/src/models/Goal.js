const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Goal name is required'],
    trim: true,
    maxlength: [200, 'Goal name too long'],
  },
  amount: {
    type: Number,
    required: [true, 'Goal amount is required'],
    min: [1, 'Goal amount must be positive'],
  },
  targetMonths: {
    type: Number,
    required: [true, 'Target months is required'],
    min: [1, 'Target months must be at least 1'],
    max: [600, 'Target months cannot exceed 600'],
  },
  order: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

goalSchema.index({ user: 1, order: 1 });

module.exports = mongoose.model('Goal', goalSchema);
