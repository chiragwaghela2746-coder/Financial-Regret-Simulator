import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatINR, calculateEMI, getErrorMessage } from '../utils/helpers';
import ErrorAlert from '../components/ErrorAlert';

export default function NewPurchasePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    price: '',
    mode: 'full',
    emiMonths: '',
    interestRate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const emiAmount = form.mode === 'emi' && form.price && form.emiMonths && form.interestRate
    ? calculateEMI(Number(form.price), Number(form.interestRate), Number(form.emiMonths))
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        purchase: {
          name: form.name,
          price: Number(form.price),
          mode: form.mode,
          ...(form.mode === 'emi' && {
            emiMonths: Number(form.emiMonths),
            interestRate: Number(form.interestRate),
          }),
        },
      };
      const res = await api.post('/simulations', payload);
      navigate(`/results/${res.data._id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Simulation</h1>
        <p className="text-gray-500 text-sm mt-1">Enter purchase details to see how it affects your financial goals.</p>
      </div>

      <ErrorAlert message={error} />

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">What are you considering buying?</label>
            <input
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g. iPhone 15, Gaming PC, Vacation trip..."
              required
            />
          </div>

          <div>
            <label className="label">Price (₹)</label>
            <input
              name="price"
              type="number"
              min="1"
              step="1"
              value={form.price}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g. 90000"
              required
            />
            {form.price && (
              <p className="text-sm text-gray-500 mt-1">{formatINR(Number(form.price))}</p>
            )}
          </div>

          <div>
            <label className="label">Payment Mode</label>
            <div className="flex gap-3">
              {[
                { value: 'full', label: '💳 Full Payment', desc: 'Pay upfront' },
                { value: 'emi', label: '📅 EMI', desc: 'Pay in installments' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex-1 flex flex-col gap-1 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    form.mode === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={opt.value}
                    checked={form.mode === opt.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className="font-medium text-sm">{opt.label}</span>
                  <span className="text-xs text-gray-500">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {form.mode === 'emi' && (
            <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg">
              <div>
                <label className="label">EMI Duration (months)</label>
                <input
                  name="emiMonths"
                  type="number"
                  min="1"
                  max="120"
                  value={form.emiMonths}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="e.g. 12"
                  required
                />
              </div>
              <div>
                <label className="label">Annual Interest Rate (%)</label>
                <input
                  name="interestRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.interestRate}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="e.g. 14"
                  required
                />
              </div>
              {emiAmount && (
                <div className="col-span-2 bg-white rounded-lg p-3 text-sm">
                  <span className="text-gray-600">Monthly EMI: </span>
                  <span className="font-bold text-blue-700">{formatINR(emiAmount)}</span>
                  <span className="text-gray-500"> × {form.emiMonths} months</span>
                  <span className="text-gray-500"> = </span>
                  <span className="font-semibold">{formatINR(emiAmount * Number(form.emiMonths))}</span>
                  <span className="text-xs text-gray-400 ml-1">
                    (interest: {formatINR(emiAmount * Number(form.emiMonths) - Number(form.price))})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {form.name && form.price && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <p className="font-medium text-gray-700">Simulation Summary</p>
              <p className="text-gray-600">🛒 {form.name} — {formatINR(Number(form.price))}</p>
              <p className="text-gray-600">
                💳 {form.mode === 'full' ? 'Full payment' : `EMI over ${form.emiMonths} months @ ${form.interestRate}% p.a.`}
              </p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Running Simulation...
              </span>
            ) : (
              '🔮 Run Simulation'
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        ⚠️ Educational use only, not financial advice.
      </p>
    </div>
  );
}
