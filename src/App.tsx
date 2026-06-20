import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getBasename } from './utils/router';
import { StoreProvider, useStore } from './store';
import { ToastContainer } from './components';
import Shell from './Shell';
import LoginPage from './pages/LoginPage';
import {
  AdminStats, AdminOrders, AdminResellers,
  AdminPackages, AdminLogs, AdminSettings
} from './pages/AdminDashboard';
import { AdminReports } from './pages/Reports';
import {
  ResellerDashboard, ResellerNewOrder, ResellerOrders
} from './pages/ResellerDashboard';

const PAGE_TITLES: Record<string, string> = {
  stats: 'لوحة الإحصاءات',
  orders: 'الطلبات',
  resellers: 'الموزعون',
  packages: 'الحزم',
  reports: 'التقارير المالية',
  logs: 'سجل المعاملات',
  settings: 'الإعدادات',
  dashboard: 'الرئيسية',
  'new-order': 'طلب جديد',
  'my-orders': 'طلباتي',
};

function AppContent() {
  const { currentUser } = useStore();
  const [page, setPage] = useState<string>('');

  useEffect(() => {
    if (currentUser?.role === 'admin') setPage('stats');
    else if (currentUser?.role === 'reseller') setPage('dashboard');
  }, [currentUser?.id, currentUser?.role]);

  if (!currentUser) return <LoginPage />;

  const renderPage = () => {
    if (currentUser.role === 'admin') {
      switch (page) {
        case 'stats': return <AdminStats />;
        case 'orders': return <AdminOrders />;
        case 'resellers': return <AdminResellers />;
        case 'packages': return <AdminPackages />;
        case 'reports': return <AdminReports />;
        case 'logs': return <AdminLogs />;
        case 'settings': return <AdminSettings />;
        default: return <AdminStats />;
      }
    } else {
      switch (page) {
        case 'dashboard': return <ResellerDashboard />;
        case 'new-order': return <ResellerNewOrder />;
        case 'my-orders': return <ResellerOrders />;
        default: return <ResellerDashboard />;
      }
    }
  };

  return (
    <Shell activePage={page} onNavigate={setPage} title={PAGE_TITLES[page] || ''}>
      {renderPage()}
    </Shell>
  );
}

function App() {
  // ⚠️ CRITICAL: DO NOT DELETE THIS LINE ⚠️
  const basename = getBasename();

  return (
    <BrowserRouter basename={basename}>
      <StoreProvider>
        <Routes>
          <Route path="/*" element={<AppContent />} />
        </Routes>
        <ToastContainer />
      </StoreProvider>
    </BrowserRouter>
  );
}

export default App;
