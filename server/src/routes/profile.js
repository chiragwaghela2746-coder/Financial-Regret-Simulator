const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const FinanceProfile = require('../models/FinanceProfile');

const router = express.Router();

const profileValidation = [
  body('monthlyIncome').isFloat({ min: 0 }).withMessage('Monthly income must be a non-negative number'),
  body('monthlyExpenses').isFloat({ min: 0 }).withMessage('Monthly expenses must be a non-negative number'),
  body('savings').isFloat({ min: 0 }).withMessage('Savings must be a non-negative number'),
];

// GET /api/profile
router.get('/', protect, async (req, res) => {
  const profile = await FinanceProfile.findOne({ user: req.user._id });
  if (!profile) return res.status(404).json({ message: 'Profile not found' });
  res.json(profile);
});

// PUT /api/profile
router.put('/', protect, profileValidation, validate, async (req, res) => {
  const { monthlyIncome, monthlyExpenses, savings } = req.body;
  const profile = await FinanceProfile.findOneAndUpdate(
    { user: req.user._id },
    { monthlyIncome, monthlyExpenses, savings },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(profile);
});

module.exports = router;
