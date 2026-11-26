const mongoose = require('mongoose');

const goalResultSchema = new mongoose.Schema({
  name: { type: String, required: true },
  delayMonths: { type: Number, default: null }, // null = not reached in 60 months
  onTimeProbability: { type: Number, min: 0, max: 1 },
}, { _id: false });

const scenarioSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['buy_now', 'wait', 'cheaper'],
    required: true,
  },
  goals: [goalResultSchema],
}, { _id: false });

const simulationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  input: {
    monthlyIncome: { type: Number, required: true },
    monthlyExpenses: { type: Number, required: true },
    savings: { type: Number, required: true },
    goals: [{
      name: String,
      amount: Number,
      targetMonths: Number,
      _id: false,
    }],
    purchase: {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      mode: { type: String, enum: ['full', 'emi'], required: true },
      emiMonths: Number,
      interestRate: Number,
    },
  },
  result: {
    regretScore: { type: Number, min: 0, max: 100, required: true },
    scenarios: [scenarioSchema],
    explanation: { type: String, required: true },
  },
  feedback: {
    response: {
      type: String,
      enum: ['yes', 'no', 'not_bought'],
      default: null,
    },
    note: { type: String, maxlength: 1000, default: '' },
    submittedAt: { type: Date, default: null },
  },
}, { timestamps: true });

simulationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Simulation', simulationSchema);
