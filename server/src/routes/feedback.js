const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { AppError } = require('../middleware/errorHandler');
const Simulation = require('../models/Simulation');

const router = express.Router();

// POST /api/simulations/:id/feedback
router.post(
  '/:id/feedback',
  protect,
  [
    body('response')
      .isIn(['yes', 'no', 'not_bought'])
      .withMessage('Response must be yes, no, or not_bought'),
    body('note').optional().isString().isLength({ max: 1000 }).withMessage('Note too long'),
  ],
  validate,
  async (req, res) => {
    const simulation = await Simulation.findOne({ _id: req.params.id, user: req.user._id });
    if (!simulation) throw new AppError('Simulation not found', 404);

    // Check if feedback already submitted
    if (simulation.feedback?.response !== null && simulation.feedback?.response !== undefined) {
      throw new AppError('Feedback already submitted', 409);
    }

    // Check 30-day window (unless DEMO_MODE=true)
    const isDemoMode = process.env.DEMO_MODE === 'true';
    if (!isDemoMode) {
      const thirtyDaysLater = new Date(simulation.createdAt);
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      if (new Date() < thirtyDaysLater) {
        const daysLeft = Math.ceil((thirtyDaysLater - new Date()) / (1000 * 60 * 60 * 24));
        throw new AppError(`Feedback available in ${daysLeft} day(s)`, 403);
      }
    }

    simulation.feedback = {
      response: req.body.response,
      note: req.body.note || '',
      submittedAt: new Date(),
    };
    await simulation.save();

    res.json({ message: 'Feedback submitted', feedback: simulation.feedback });
  }
);

module.exports = router;
