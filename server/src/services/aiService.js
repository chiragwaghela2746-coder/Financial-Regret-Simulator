const axios = require('axios');

const MOCK_RESULT = {
  regretScore: 72,
  scenarios: [
    {
      type: 'buy_now',
      goals: [
        { name: 'Emergency Fund', delayMonths: 3, onTimeProbability: 0.6 },
        { name: 'Vacation', delayMonths: 8, onTimeProbability: 0.45 },
        { name: 'Car', delayMonths: null, onTimeProbability: 0.1 },
      ],
    },
    {
      type: 'wait',
      goals: [
        { name: 'Emergency Fund', delayMonths: 0, onTimeProbability: 0.95 },
        { name: 'Vacation', delayMonths: 2, onTimeProbability: 0.75 },
        { name: 'Car', delayMonths: 18, onTimeProbability: 0.5 },
      ],
    },
    {
      type: 'cheaper',
      goals: [
        { name: 'Emergency Fund', delayMonths: 1, onTimeProbability: 0.85 },
        { name: 'Vacation', delayMonths: 4, onTimeProbability: 0.65 },
        { name: 'Car', delayMonths: 24, onTimeProbability: 0.4 },
      ],
    },
  ],
  explanation:
    'This purchase has a high regret score of 72/100. Buying now will significantly delay your financial goals. Consider waiting 3 months or finding a cheaper alternative to reduce the impact on your savings trajectory.',
};

/**
 * Calls the AI simulation service or returns mock data.
 * @param {Object} payload - The simulation request payload per API_CONTRACT.md
 * @returns {Object} - Simulation result per API_CONTRACT.md
 */
const callAI = async (payload) => {
  if (process.env.MOCK_AI === 'true') {
    // Return mock data with actual goal names from payload
    const goalNames = payload.goals.map((g) => g.name);
    const mock = JSON.parse(JSON.stringify(MOCK_RESULT));
    mock.scenarios.forEach((scenario) => {
      scenario.goals = goalNames.map((name, i) => ({
        name,
        delayMonths: scenario.type === 'buy_now'
          ? (i === goalNames.length - 1 ? null : (i + 1) * 3)
          : (i === 0 ? 0 : i * 2),
        onTimeProbability: Math.max(0.1, 0.95 - i * 0.15 - (scenario.type === 'buy_now' ? 0.2 : 0)),
      }));
    });
    mock.explanation = `Mock simulation for "${payload.purchase.name}" (₹${payload.purchase.price.toLocaleString('en-IN')}). ${
      MOCK_RESULT.explanation
    }`;
    return mock;
  }

  const aiUrl = process.env.AI_URL || 'http://localhost:8000';
  const response = await axios.post(`${aiUrl}/simulate`, payload, {
    timeout: 15000, // 15 second timeout
  });

  return response.data;
};

module.exports = { callAI };
