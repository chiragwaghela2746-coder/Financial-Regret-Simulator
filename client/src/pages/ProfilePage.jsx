import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatINR, getErrorMessage } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';

export default function ProfilePage() {
  const [form, setForm] = useState({ monthlyIncome: '', monthlyExpenses: '', savings: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/profile')
      .then(res => {
        setForm({
          monthlyIncome: res.data.monthlyIncome,
          monthlyExpenses: res.data.monthlyExpenses,
          savings: res.data.savings,
        });
      })
      .catch(err => {
        if (err.response?.status !== 404) setError(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);
    try {
      await api.put('/profile', {
        monthlyIncome: Number(form.monthlyIncome),
        monthlyExpenses: Number(form.monthlyExpenses),
        savings: Number(form.savings),
      });
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const monthlySavings = Number(form.monthlyIncome) - Number(form.monthlyExpenses);

  if (loading) return <LoadingSpinner text="Loading profile..." />;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Financial Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Your profile is used as the base for all simulations.</p>
      </div>

      <ErrorAlert message={error} />

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm mb-4">
          ✅ {success}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Monthly Income (₹)</label>
            <input
              name="monthlyIncome"
              type="number"
              min="0"
              step="100"
              value={form.monthlyIncome}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g. 80000"
              required
            />
          </div>
          <div>
            <label className="label">Monthly Expenses (₹)</label>
            <input
              name="monthlyExpenses"
              type="number"
              min="0"
              step="100"
              value={form.monthlyExpenses}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g. 40000"
              required
            />
          </div>
          <div>
            <label className="label">Current Savings (₹)</label>
            <input
              name="savings"
              type="number"
              min="0"
              step="100"
              value={form.savings}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g. 200000"
              required
            />
          </div>

          {form.monthlyIncome && form.monthlyExpenses && (
            <div className={`rounded-lg p-4 text-sm ${monthlySavings >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <strong>Monthly Net Savings:</strong>{' '}
              <span className={monthlySavings >= 0 ? 'text-green-700' : 'text-red-700'}>
                {formatINR(monthlySavings)}
              </span>
              {monthlySavings < 0 && (
                <p className="text-red-600 mt-1 text-xs">⚠️ Your expenses exceed your income.</p>
              )}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
