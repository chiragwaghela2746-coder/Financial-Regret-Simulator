import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatINR, getErrorMessage } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import EmptyState from '../components/EmptyState';

function GoalForm({ onSave, onCancel, initial }) {
  const [form, setForm] = useState(initial || { name: '', amount: '', targetMonths: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({ name: form.name, amount: Number(form.amount), targetMonths: Number(form.targetMonths) });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div>
        <label className="label">Goal Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input-field"
          placeholder="e.g. Emergency Fund"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount (₹)</label>
          <input
            type="number"
            min="1"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="input-field"
            placeholder="200000"
            required
          />
        </div>
        <div>
          <label className="label">Target Months</label>
          <input
            type="number"
            min="1"
            max="600"
            value={form.targetMonths}
            onChange={(e) => setForm({ ...form, targetMonths: e.target.value })}
            className="input-field"
            placeholder="12"
            required
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving ? 'Saving...' : initial ? 'Update Goal' : 'Add Goal'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary text-sm">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const fetchGoals = async () => {
    try {
      const res = await api.get('/goals');
      setGoals(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGoals(); }, []);

  const handleAdd = async (data) => {
    await api.post('/goals', data);
    await fetchGoals();
    setShowAddForm(false);
  };

  const handleUpdate = async (id, data) => {
    await api.put(`/goals/${id}`, data);
    await fetchGoals();
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await api.delete(`/goals/${id}`);
      setGoals(goals.filter(g => g._id !== id));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) return <LoadingSpinner text="Loading goals..." />;

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Savings Goals</h1>
          <p className="text-gray-500 text-sm mt-1">Goals are simulated in order.</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn-primary">
          + Add Goal
        </button>
      </div>

      <ErrorAlert message={error} />

      {showAddForm && (
        <div className="mb-4">
          <GoalForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {goals.length === 0 && !showAddForm ? (
        <EmptyState
          icon="🎯"
          title="No goals yet"
          description="Add savings goals to run simulations."
          action={<button onClick={() => setShowAddForm(true)} className="btn-primary">Add First Goal</button>}
        />
      ) : (
        <div className="space-y-3">
          {goals.map((goal, idx) => (
            <div key={goal._id} className="card">
              {editingId === goal._id ? (
                <GoalForm
                  initial={{ name: goal.name, amount: goal.amount, targetMonths: goal.targetMonths }}
                  onSave={(data) => handleUpdate(goal._id, data)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{goal.name}</h3>
                    <p className="text-sm text-gray-500">
                      {formatINR(goal.amount)} · {goal.targetMonths} months
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setEditingId(goal._id)} className="btn-secondary text-sm py-1">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(goal._id)} className="btn-danger text-sm py-1">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
