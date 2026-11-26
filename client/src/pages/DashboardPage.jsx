import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  const cards = [
    {
      icon: '🧾',
      title: 'New Simulation',
      desc: 'Check how a purchase affects your goals',
      to: '/simulate',
      color: 'bg-blue-50 border-blue-200',
      btn: 'btn-primary',
      btnText: 'Start Simulation',
    },
    {
      icon: '📊',
      title: 'History',
      desc: 'Review past simulations & provide feedback',
      to: '/history',
      color: 'bg-purple-50 border-purple-200',
      btn: 'btn-secondary',
      btnText: 'View History',
    },
    {
      icon: '🎯',
      title: 'Goals',
      desc: 'Manage your savings goals',
      to: '/goals',
      color: 'bg-green-50 border-green-200',
      btn: 'btn-secondary',
      btnText: 'Manage Goals',
    },
    {
      icon: '👤',
      title: 'Profile',
      desc: 'Update your financial profile',
      to: '/profile',
      color: 'bg-yellow-50 border-yellow-200',
      btn: 'btn-secondary',
      btnText: 'Update Profile',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Make smarter purchase decisions with data-driven insights.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <div key={card.to} className={`card border ${card.color} flex flex-col gap-4`}>
            <div className="text-4xl">{card.icon}</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{card.title}</h2>
              <p className="text-gray-600 text-sm mt-1">{card.desc}</p>
            </div>
            <div className="mt-auto">
              <Link to={card.to} className={card.btn}>
                {card.btnText}
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 card bg-blue-600 text-white border-blue-600">
        <h3 className="font-semibold text-lg mb-2">💡 How it works</h3>
        <ol className="text-sm space-y-1 text-blue-100">
          <li>1. Set up your financial profile (income, expenses, savings)</li>
          <li>2. Add your savings goals with target amounts</li>
          <li>3. Enter a purchase you're considering</li>
          <li>4. Get an AI-powered regret score and goal delay analysis</li>
          <li>5. After 30 days, tell us if you actually regretted it!</li>
        </ol>
        <p className="text-xs text-blue-200 mt-4">⚠️ Educational use only, not financial advice.</p>
      </div>
    </div>
  );
}
