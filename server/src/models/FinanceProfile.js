const mongoose = require('mongoose');

const financeProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  monthlyIncome: {
    type: Number,
    required: [true, 'Monthly income is required'],
    min: [0, 'Monthly income cannot be negative'],
  },
  monthlyExpenses: {
    type: Number,
    required: [true, 'Monthly expenses is required'],
    min: [0, 'Monthly expenses cannot be negative'],
  },
  savings: {
    type: Number,
    required: [true, 'Savings is required'],
    min: [0, 'Savings cannot be negative'],
  },
}, { timestamps: true });

module.exports = mongoose.model('FinanceProfile', financeProfileSchema);
