const express = require('express');
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const Goal = require('../models/Goal');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

const goalValidation = [
  body('name').trim().notEmpty().withMessage('Goal name is required'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number'),
  body('targetMonths').isInt({ min: 1, max: 600 }).withMessage('Target months must be between 1 and 600'),
];

// GET /api/goals - list user goals ordered
router.get('/', protect, async (req, res) => {
  const goals = await Goal.find({ user: req.user._id }).sort({ order: 1, createdAt: 1 });
  res.json(goals);
});

// POST /api/goals
router.post('/', protect, goalValidation, validate, async (req, res) => {
  const { name, amount, targetMonths } = req.body;
  const count = await Goal.countDocuments({ user: req.user._id });
  const goal = await Goal.create({ user: req.user._id, name, amount, targetMonths, order: count });
  res.status(201).json(goal);
});

// PUT /api/goals/reorder - reorder goals array [{id, order}]
router.put('/reorder', protect, async (req, res) => {
  const items = req.body; // [{id, order}]
  if (!Array.isArray(items)) return res.status(422).json({ message: 'Body must be an array' });
  const ops = items.map(({ id, order }) => ({
    updateOne: {
      filter: { _id: id, user: req.user._id },
      update: { order },
    },
  }));
  await Goal.bulkWrite(ops);
  const goals = await Goal.find({ user: req.user._id }).sort({ order: 1 });
  res.json(goals);
});

// PUT /api/goals/:id
router.put(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Invalid goal ID'), ...goalValidation],
  validate,
  async (req, res) => {
    const { name, amount, targetMonths } = req.body;
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { name, amount, targetMonths },
      { new: true, runValidators: true }
    );
    if (!goal) throw new AppError('Goal not found', 404);
    res.json(goal);
  }
);

// DELETE /api/goals/:id
router.delete('/:id', protect, async (req, res) => {
  const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!goal) throw new AppError('Goal not found', 404);
  res.json({ message: 'Goal deleted' });
});

module.exports = router;
