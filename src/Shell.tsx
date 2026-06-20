import React from 'react';
import { useStore } from './store';

interface ShellProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
  title: string;
}

const AdminNavItems = [
  { id: 'stats', icon: '📊', label: 'لوحة الإحصاءات' },
  { id: 'orders', icon: '📋', label: 'الطلبات' },
  { id: 'resellers', icon: '👥', label: 'الموزعون' },
  { id: 'packages', icon: '📦', label: 'الحزم' },
  { id: 'reports', icon: '📈', label: 'التقارير المالية' },
  { id: 'logs', icon: '📜', label: 'سجل المعاملات' },
  { id: 'settings', icon: '⚙️', label: 'الإعدادات' },
];

const ResellerNavItems = [
  { id: 'dashboard', icon: '🏠', label: 'الرئيسية' },
  { id: 'new-order', icon: '➕', label: 'طلب جديد' },
  { id: 'my-orders', icon: '📋', label: 'طلباتي' },
];

export default function Shell({ children, activePage, onNavigate, title }: ShellProps) {
  const { currentUser, logout, sidebarOpen, setSidebarOpen, orders } = useStore();
  const isAdmin = currentUser?.role === 'admin';
  const navItems = isAdmin ? AdminNavItems : ResellerNavItems;
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <div style={{ minHeight: '100vh', background: '#F4F4F5' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #09090B',
          background: '#0A34A6',
        }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>📡 TELECOM RESELLER</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>نظام إدارة الموزعين</div>
        </div>

        {/* User info */}
        <div style={{ padding: '14px 20px', borderBottom: '2px solid #09090B', background: '#f9f9f9' }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{currentUser?.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span className="badge" style={{ background: isAdmin ? '#0A34A6' : '#bbf7d0', color: isAdmin ? '#fff' : '#14532d', fontSize: 10, padding: '2px 8px' }}>
              {isAdmin ? '👑 مشرف' : '🧑‍💼 موزع'}
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#71717a' }}>
              @{currentUser?.username}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${activePage === item.id ? 'active' : ''}`}
              style={{ width: '100%', background: 'none', border: 'none', textAlign: 'right' }}
              onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'orders' && pendingCount > 0 && isAdmin && (
                <span style={{
                  marginRight: 'auto',
                  background: '#dc2626',
                  color: '#fff',
                  borderRadius: 9999,
                  fontSize: 10,
                  fontWeight: 900,
                  padding: '2px 7px',
                  border: '1.5px solid #09090B',
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px', borderTop: '2px solid #09090B' }}>
          <button
            className="brutal-btn brutal-btn-danger"
            style={{ width: '100%', fontSize: 13 }}
            onClick={logout}
          >
            ← تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Header */}
        <header className="sticky-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Mobile menu button */}
            <button
              className="brutal-btn brutal-btn-sm"
              style={{ display: 'none', padding: '8px 12px' }}
              id="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <h1 style={{ fontWeight: 900, fontSize: 20 }}>{title}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isAdmin && currentUser?.balance !== undefined && (
              <div style={{
                border: '2px solid #09090B',
                background: '#0A34A6',
                color: '#fff',
                padding: '6px 14px',
                fontWeight: 800,
                fontSize: 14,
                boxShadow: '-3px 3px 0 0 #09090B',
              }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {currentUser.balance?.toFixed(2)} ₪
                </span>
              </div>
            )}
            {isAdmin && pendingCount > 0 && (
              <div style={{
                border: '2px solid #09090B',
                background: '#fef08a',
                padding: '6px 14px',
                fontWeight: 800,
                fontSize: 13,
                boxShadow: '-2px 2px 0 0 #09090B',
                cursor: 'pointer',
              }} onClick={() => onNavigate('orders')}>
                ⏳ {pendingCount} طلب معلق
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {children}
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          #mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
