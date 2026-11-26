import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  RadialBarChart, RadialBar, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import {
  formatINR, getRegretColor, getRegretBgColor, getRegretLabel,
  formatDelay, formatProbability, getErrorMessage,
} from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';

// Regret Gauge using RadialBarChart
function RegretGauge({ score }) {
  const color = getRegretBgColor(score);
  const data = [
    { name: 'Regret', value: score, fill: color },
    { name: 'Remaining', value: 100 - score, fill: '#f3f4f6' },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 200, height: 120 }}>
        <RadialBarChart
          cx={100}
          cy={110}
          innerRadius={65}
          outerRadius={95}
          startAngle={180}
          endAngle={0}
          data={data}
          width={200}
          height={120}
        >
          <RadialBar dataKey="value" cornerRadius={8}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </RadialBar>
        </RadialBarChart>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className="text-4xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold mt-1 ${getRegretColor(score)}`}>
        {getRegretLabel(score)}
      </span>
    </div>
  );
}

// Goal Delay Bar Chart
function GoalDelayChart({ scenarios }) {
  if (!scenarios?.length) return null;

  const goalNames = scenarios[0]?.goals?.map(g => g.name) || [];
  const scenarioColors = { buy_now: '#ef4444', wait: '#22c55e', cheaper: '#3b82f6' };
  const scenarioLabels = { buy_now: 'Buy Now', wait: 'Wait', cheaper: 'Cheaper Alt.' };

  const chartData = goalNames.map(name => {
    const point = { name: name.length > 15 ? name.slice(0, 15) + '…' : name };
    scenarios.forEach(s => {
      const g = s.goals.find(g => g.name === name);
      point[s.type] = g?.delayMonths === null ? 61 : (g?.delayMonths ?? 0);
      point[`${s.type}_raw`] = g?.delayMonths;
    });
    return point;
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow p-3 text-sm">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.dataKey} style={{ color: p.fill }}>
            {scenarioLabels[p.dataKey]}: {
              p.payload[`${p.dataKey}_raw`] === null
                ? 'Not reached (60+ months)'
                : `${p.payload[`${p.dataKey}_raw`]} months delay`
            }
          </p>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={v => v >= 61 ? '60+' : v}
          label={{ value: 'Months Delayed', angle: -90, position: 'insideLeft', fontSize: 11, offset: 10 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={(v) => scenarioLabels[v] || v} />
        {Object.entries(scenarioColors).map(([key, color]) => (
          <Bar key={key} dataKey={key} fill={color} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Scenario Card
function ScenarioCard({ scenario }) {
  const labels = { buy_now: 'Buy Now', wait: 'Wait', cheaper: 'Cheaper Alt.' };
  const icons = { buy_now: '🛒', wait: '⏳', cheaper: '💡' };
  const colors = {
    buy_now: 'border-red-200 bg-red-50',
    wait: 'border-green-200 bg-green-50',
    cheaper: 'border-blue-200 bg-blue-50',
  };

  return (
    <div className={`rounded-xl border-2 p-4 ${colors[scenario.type]}`}>
      <h3 className="font-bold text-gray-900 mb-3">
        {icons[scenario.type]} {labels[scenario.type]}
      </h3>
      <div className="space-y-2">
        {scenario.goals.map((g) => (
          <div key={g.name} className="bg-white rounded-lg p-3 text-sm">
            <div className="font-medium text-gray-800 truncate">{g.name}</div>
            <div className="flex justify-between mt-1 text-gray-600">
              <span>{formatDelay(g.delayMonths)}</span>
              <span className="font-semibold">{formatProbability(g.onTimeProbability)} on time</span>
            </div>
            <div className="mt-1 h-1.5 bg-gray-100 rounded-full">
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${Math.round((g.onTimeProbability ?? 0) * 100)}%`,
                  backgroundColor: g.onTimeProbability >= 0.7 ? '#22c55e' : g.onTimeProbability >= 0.4 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Feedback Form
function FeedbackForm({ simulationId, existingFeedback, onDone }) {
  const [form, setForm] = useState({ response: '', note: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (existingFeedback?.response) {
    const labels = { yes: '😔 Yes, I regret it', no: '😊 No, it was worth it', not_bought: "🚫 Didn't buy it" };
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="font-semibold text-green-800">✅ Feedback Submitted</p>
        <p className="text-green-700 text-sm mt-1">{labels[existingFeedback.response]}</p>
        {existingFeedback.note && <p className="text-gray-600 text-sm mt-1 italic">"{existingFeedback.note}"</p>}
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post(`/simulations/${simulationId}/feedback`, form);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card border-purple-200 bg-purple-50">
      <h3 className="font-bold text-gray-900 mb-3">🤔 Do you regret it?</h3>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'yes', label: '😔 Yes, I regret it' },
            { value: 'no', label: '😊 Worth it!' },
            { value: 'not_bought', label: "🚫 Didn't buy" },
          ].map((opt) => (
            <label key={opt.value} className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors ${
              form.response === opt.value ? 'border-purple-500 bg-purple-100 text-purple-800' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
              <input type="radio" name="response" value={opt.value} checked={form.response === opt.value}
                onChange={(e) => setForm({ ...form, response: e.target.value })} className="sr-only" />
              {opt.label}
            </label>
          ))}
        </div>
        <textarea
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          className="input-field resize-none"
          rows={2}
          placeholder="Optional note..."
          maxLength={1000}
        />
        <button type="submit" disabled={!form.response || loading} className="btn-primary text-sm">
          {loading ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>
    </div>
  );
}

export default function ResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSim = async () => {
    try {
      const res = await api.get(`/simulations/${id}`);
      setSimulation(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSim(); }, [id]);

  if (loading) return <LoadingSpinner text="Loading result..." />;
  if (error) return <ErrorAlert message={error} onRetry={fetchSim} />;
  if (!simulation) return null;

  const { input, result, feedback } = simulation;
  const { purchase } = input;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Simulation Result</h1>
          <p className="text-gray-500 text-sm mt-1">
            {purchase.name} — {formatINR(purchase.price)}
            {purchase.mode === 'emi' && ` (EMI ${purchase.emiMonths}mo @ ${purchase.interestRate}%)`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/simulate" className="btn-primary text-sm">New Simulation</Link>
          <Link to="/history" className="btn-secondary text-sm">History</Link>
        </div>
      </div>

      {/* Regret Score */}
      <div className="card text-center">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Regret Score</h2>
        <RegretGauge score={result.regretScore} />
        <p className="text-sm text-gray-600 mt-4 max-w-xl mx-auto leading-relaxed">
          {result.explanation}
        </p>
      </div>

      {/* Scenarios comparison */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">📊 Scenario Comparison</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {result.scenarios.map((s) => (
            <ScenarioCard key={s.type} scenario={s} />
          ))}
        </div>
      </div>

      {/* Goal delay chart */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📅 Goal Delay Chart</h2>
        <p className="text-xs text-gray-500 mb-3">
          60+ months = goal not reachable within 5 years
        </p>
        <GoalDelayChart scenarios={result.scenarios} />
      </div>

      {/* On-time probability table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🎯 On-Time Probability</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-semibold text-gray-700 rounded-tl-lg">Goal</th>
                <th className="text-center p-3 font-semibold text-red-700">🛒 Buy Now</th>
                <th className="text-center p-3 font-semibold text-green-700">⏳ Wait</th>
                <th className="text-center p-3 font-semibold text-blue-700 rounded-tr-lg">💡 Cheaper</th>
              </tr>
            </thead>
            <tbody>
              {(result.scenarios[0]?.goals || []).map((g, i) => (
                <tr key={g.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-medium text-gray-800">{g.name}</td>
                  {result.scenarios.map((s) => {
                    const goal = s.goals.find(sg => sg.name === g.name);
                    const prob = goal?.onTimeProbability ?? 0;
                    return (
                      <td key={s.type} className="p-3 text-center">
                        <span className={`font-semibold ${prob >= 0.7 ? 'text-green-700' : prob >= 0.4 ? 'text-yellow-700' : 'text-red-700'}`}>
                          {formatProbability(prob)}
                        </span>
                        <div className="text-xs text-gray-400 mt-0.5">{formatDelay(goal?.delayMonths)}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback */}
      <FeedbackForm simulationId={id} existingFeedback={feedback} onDone={fetchSim} />

      <p className="text-center text-xs text-gray-400">
        ⚠️ Educational use only, not financial advice.
      </p>
    </div>
  );
}
