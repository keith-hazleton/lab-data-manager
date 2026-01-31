import { useAppContext } from '../context/AppContext';

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useAppContext();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div
        className={`px-4 py-2 flex items-center justify-between text-sm font-medium ${
          !isOnline
            ? 'bg-yellow-500 text-yellow-900'
            : 'bg-blue-500 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              !isOnline ? 'bg-yellow-800' : 'bg-blue-200'
            }`}
          />
          <span>
            {!isOnline ? 'Offline' : 'Online'}
            {pendingCount > 0 && ` — ${pendingCount} pending`}
          </span>
        </div>
        {isOnline && pendingCount > 0 && (
          <button
            onClick={syncNow}
            disabled={isSyncing}
            className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>
    </div>
  );
}
