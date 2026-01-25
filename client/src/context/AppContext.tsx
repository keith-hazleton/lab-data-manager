import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface OfflineQueueItem {
  id: string;
  method: string;
  endpoint: string;
  body?: unknown;
  timestamp: number;
}

interface AppContextValue {
  isOnline: boolean;
  offlineQueue: OfflineQueueItem[];
  addToQueue: (item: Omit<OfflineQueueItem, 'id' | 'timestamp'>) => void;
  clearQueue: () => void;
  isMobile: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => {
    const saved = localStorage.getItem('offlineQueue');
    return saved ? JSON.parse(saved) : [];
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleResize = () => setIsMobile(window.innerWidth < 768);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  const addToQueue = (item: Omit<OfflineQueueItem, 'id' | 'timestamp'>) => {
    setOfflineQueue((prev) => [
      ...prev,
      {
        ...item,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    ]);
  };

  const clearQueue = () => {
    setOfflineQueue([]);
  };

  return (
    <AppContext.Provider
      value={{
        isOnline,
        offlineQueue,
        addToQueue,
        clearQueue,
        isMobile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
