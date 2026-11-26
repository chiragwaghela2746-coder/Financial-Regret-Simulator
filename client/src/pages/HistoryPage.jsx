import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatINR, getRegretColor, getRegretLabel, getErrorMessage } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import EmptyState from '../components/EmptyState';

function RegretBadge({ score }) {
  const color = score <= 30 ? 'bg-green-100 text-green-800' : score <= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{score}/100</span>;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ simulations: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const fetchHistory = async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/simulations?page=${p}&limit=10`);
      setData(res.data);
      setPage(p);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this simulation?')) return;
    try {
      await api.delete(`/simulations/${id}`);
      fetchHistory(page);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) return <LoadingSpinner text="Loading history..." />;

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Simulation History</h1>
          <p className="text-gray-500 text-sm mt-1">{data.total} simulation{data.total !== 1 ? 's' : ''} total</p>
        </div>
        <Link to="/simulate" className="btn-primary">+ New Simulation</Link>
      </div>

      <ErrorAlert message={error} />

      {data.simulations.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No simulations yet"
          description="Run your first simulation to see it here."
          action={<Link to="/simulate" className="btn-primary">Start Simulating</Link>}
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.simulations.map((sim) => {
              const feedbackLabels = { yes: '😔 Regret', no: '😊 Worth it', not_bought: "🚫 Not bought" };
              const hasFeedback = sim.feedback?.response;
              return (
                <div
                  key={sim._id}
                  onClick={() => navigate(`/results/${sim._id}`)}
                  className="card hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {sim.input?.purchase?.name}
                        </h3>
                        <RegretBadge score={sim.result?.regretScore} />
                        {hasFeedback && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                            {feedbackLabels[sim.feedback.response]}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatINR(sim.input?.purchase?.price)} ·{' '}
                        {sim.input?.purchase?.mode === 'emi'
                          ? `EMI ${sim.input.purchase.emiMonths}mo`
                          : 'Full payment'} ·{' '}
                        {new Date(sim.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className={`text-xs mt-1 font-medium ${getRegretColor(sim.result?.regretScore)}`}>
                        {getRegretLabel(sim.result?.regretScore)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => handleDelete(sim._id, e)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
                        title="Delete"
                      >
                        🗑️
                      </button>
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => fetchHistory(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    p === page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
