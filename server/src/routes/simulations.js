const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { AppError } = require('../middleware/errorHandler');
const FinanceProfile = require('../models/FinanceProfile');
const Goal = require('../models/Goal');
const Simulation = require('../models/Simulation');
const { callAI } = require('../services/aiService');

const router = express.Router();

// POST /api/simulations - run a simulation
router.post(
  '/',
  protect,
  [
    body('purchase.name').trim().notEmpty().withMessage('Purchase name is required'),
    body('purchase.price').isFloat({ min: 1 }).withMessage('Purchase price must be positive'),
    body('purchase.mode').isIn(['full', 'emi']).withMessage('Mode must be full or emi'),
    body('purchase.emiMonths')
      .if(body('purchase.mode').equals('emi'))
      .isInt({ min: 1 })
      .withMessage('EMI months required when mode is emi'),
    body('purchase.interestRate')
      .if(body('purchase.mode').equals('emi'))
      .isFloat({ min: 0 })
      .withMessage('Interest rate required when mode is emi'),
  ],
  validate,
  async (req, res) => {
    // Fetch user's profile and goals
    const [profile, goals] = await Promise.all([
      FinanceProfile.findOne({ user: req.user._id }),
      Goal.find({ user: req.user._id }).sort({ order: 1 }),
    ]);

    if (!profile) throw new AppError('Finance profile not found. Please set up your profile first.', 400);
    if (!goals.length) throw new AppError('No goals found. Please add at least one goal.', 400);

    const { purchase } = req.body;

    // Build AI payload per API_CONTRACT.md
    const payload = {
      monthlyIncome: profile.monthlyIncome,
      monthlyExpenses: profile.monthlyExpenses,
      savings: profile.savings,
      goals: goals.map((g) => ({
        name: g.name,
        amount: g.amount,
        targetMonths: g.targetMonths,
      })),
      purchase: {
        name: purchase.name,
        price: purchase.price,
        mode: purchase.mode,
        ...(purchase.mode === 'emi' && {
          emiMonths: purchase.emiMonths,
          interestRate: purchase.interestRate,
        }),
      },
    };

    let result;
    try {
      result = await callAI(payload);
    } catch (aiErr) {
      if (aiErr.response?.status === 422) {
        throw new AppError('AI service rejected input: ' + JSON.stringify(aiErr.response.data), 422);
      }
      if (aiErr.code === 'ECONNABORTED') {
        throw new AppError('AI service timed out. Please try again.', 504);
      }
      throw new AppError('AI service unavailable. Try enabling MOCK_AI=true.', 502);
    }

    // Save simulation
    const simulation = await Simulation.create({
      user: req.user._id,
      input: payload,
      result,
      feedback: { response: null, note: '', submittedAt: null },
    });

    res.status(201).json(simulation);
  }
);

// GET /api/simulations - list user's simulations (paginated)
router.get('/', protect, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [simulations, total] = await Promise.all([
    Simulation.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('input.purchase result.regretScore feedback createdAt'),
    Simulation.countDocuments({ user: req.user._id }),
  ]);

  res.json({ simulations, total, page, totalPages: Math.ceil(total / limit) });
});

// GET /api/simulations/:id - get single simulation
router.get('/:id', protect, async (req, res) => {
  const simulation = await Simulation.findOne({ _id: req.params.id, user: req.user._id });
  if (!simulation) throw new AppError('Simulation not found', 404);
  res.json(simulation);
});

// DELETE /api/simulations/:id
router.delete('/:id', protect, async (req, res) => {
  const simulation = await Simulation.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!simulation) throw new AppError('Simulation not found', 404);
  res.json({ message: 'Simulation deleted' });
});

module.exports = router;
