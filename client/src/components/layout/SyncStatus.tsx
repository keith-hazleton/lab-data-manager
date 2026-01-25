import { useAppContext } from '../../context/AppContext';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';

export function SyncStatus() {
  const { isOnline } = useAppContext();
  const { pendingCount } = useOfflineQueue();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`fixed top-14 left-0 right-0 px-4 py-2 text-center text-sm font-medium z-40 ${
        isOnline
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      {isOnline ? (
        <span>Syncing {pendingCount} pending changes...</span>
      ) : (
        <span>You are offline. Changes will sync when reconnected.</span>
      )}
      {pendingCount > 0 && (
        <span className="ml-2 bg-white px-2 py-0.5 rounded">
          {pendingCount} pending
        </span>
      )}
    </div>
  );
}
