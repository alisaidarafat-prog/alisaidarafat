import React, { useState } from 'react';
import { useStore } from '../store';

export default function LoginPage() {
  const { login, addToast } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const ok = login(username, password);
      if (!ok) {
        addToast('error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F4F5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background grid pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(#09090B1A 1px, transparent 1px), linear-gradient(90deg, #09090B1A 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        {/* Logo / Header */}
        <div className="brutal-card" style={{ padding: '28px 32px', marginBottom: 24 }}>
          <div style={{
            background: '#0A34A6',
            border: '2px solid #09090B',
            boxShadow: '-4px 4px 0 0 #09090B',
            padding: '16px 20px',
            marginBottom: 24,
            display: 'inline-block',
            width: '100%',
            textAlign: 'center',
          }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, letterSpacing: 1 }}>
              📡 TELECOM RESELLER
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, marginTop: 4 }}>
              نظام إدارة الموزعين
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                اسم المستخدم
              </label>
              <input
                className="brutal-input"
                placeholder="أدخل اسم المستخدم"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                كلمة المرور
              </label>
              <input
                className="brutal-input"
                type="password"
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="brutal-btn brutal-btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: 16, fontWeight: 900 }}
              disabled={loading}
            >
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول ←'}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div style={{ border: '2px solid #09090B', background: '#fef08a', padding: '14px 16px', boxShadow: '-3px 3px 0 0 #09090B' }}>
          <p style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>🔑 بيانات تجريبية:</p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>
            مشرف: alisaidarafat / alisaidarafat@7
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
            موزع: mahmoud / mahmoud123
          </p>
        </div>
      </div>
    </div>
  );
}
