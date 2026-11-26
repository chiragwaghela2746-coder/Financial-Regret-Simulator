export default function ErrorAlert({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
      <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
      <div className="flex-1">
        <p className="text-red-800 text-sm">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 text-sm text-red-600 hover:underline">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
