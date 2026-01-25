import { type ReactNode } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { SyncStatus } from './SyncStatus';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isMobile } = useAppContext();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <SyncStatus />

      <div className="flex">
        {!isMobile && <Sidebar />}

        <main className={`flex-1 ${isMobile ? 'pb-20' : 'ml-64'}`}>
          <div className="p-4 md:p-6 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {isMobile && <MobileNav />}
    </div>
  );
}
