import React, { useState } from 'react';
import { useStore, fmt, fmtDate, PACKAGE_TYPE_LABELS } from '../store';
import type { PackageType } from '../store';
import { StatusBadge, EmptyState } from '../components';

// ─── Reseller Dashboard ───────────────────────────────────────────────────────
export function ResellerDashboard() {
  const { currentUser, orders, users } = useStore();
  const myOrders = orders.filter(o => o.reseller_id === currentUser?.id);
  const pendingCount = myOrders.filter(o => o.status === 'pending').length;
  const successCount = myOrders.filter(o => o.status === 'success').length;
  const totalSpent = myOrders.filter(o => o.status !== 'failed').reduce((s, o) => s + o.price, 0);

  // get fresh balance from users store
  const freshUser = users.find(u => u.id === currentUser?.id);
  const balance = freshUser?.balance ?? currentUser?.balance ?? 0;

  return (
    <div>
      {/* Balance Card */}
      <div
        className="brutal-card blue-grid-pattern"
        style={{
          background: '#0A34A6',
          padding: '32px 28px',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            رصيدك الحالي
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 900,
            fontSize: 'clamp(40px, 8vw, 64px)',
            color: '#fff',
            lineHeight: 1,
            letterSpacing: -1,
          }}>
            {balance.toFixed(2)}
            <span style={{ fontSize: '0.4em', marginRight: 8, opacity: 0.8 }}>₪</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, marginTop: 10 }}>
            مرحباً، {currentUser?.name} 👋
          </div>
        </div>
        {/* Decorative */}
        <div style={{
          position: 'absolute',
          left: -20,
          top: -20,
          width: 120,
          height: 120,
          border: '3px solid rgba(255,255,255,0.1)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute',
          left: 30,
          bottom: -30,
          width: 80,
          height: 80,
          border: '2px solid rgba(255,255,255,0.08)',
          borderRadius: '50%',
        }} />
      </div>

      {/* Mini stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'طلبات معلقة', value: pendingCount, icon: '⏳', color: '#fef08a', textColor: '#09090B' },
          { label: 'طلبات منجزة', value: successCount, icon: '✓', color: '#bbf7d0', textColor: '#09090B' },
          { label: 'إجمالي المصروف', value: fmt(totalSpent), icon: '💸', color: '#f4f4f5', textColor: '#09090B' },
        ].map((s, i) => (
          <div key={i} className="brutal-card" style={{ padding: '16px', background: s.color, color: s.textColor }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 22 }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, opacity: 0.7 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="brutal-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '2px solid #09090B' }}>
          <h2 style={{ fontWeight: 900, fontSize: 16 }}>آخر طلباتي</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="brutal-table">
            <thead>
              <tr>
                <th>الحزمة</th>
                <th>المبلغ</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {myOrders.slice(0, 5).map((o, i) => (
                <tr key={o.id} className="row-animate" style={{ animationDelay: `${i * 40}ms` }}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{o.package_name}</div>
                    <div style={{ fontSize: 11, color: '#71717a' }}>{o.customer_phone || o.customer_whatsapp}</div>
                  </td>
                  <td><span className="num">{fmt(o.price)}</span></td>
                  <td>
                    <StatusBadge status={o.status} />
                    {o.fail_reason && <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 3 }}>{o.fail_reason}</div>}
                  </td>
                  <td style={{ fontSize: 12, color: '#71717a' }}>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {myOrders.length === 0 && <EmptyState message="لا توجد طلبات بعد" icon="📭" />}
        </div>
      </div>
    </div>
  );
}

// ─── New Order Page ───────────────────────────────────────────────────────────
export function ResellerNewOrder() {
  const { packages, createOrder, currentUser, users } = useStore();
  const freshUser = users.find(u => u.id === currentUser?.id);
  const balance = freshUser?.balance ?? currentUser?.balance ?? 0;

  const [serviceType, setServiceType] = useState<PackageType | ''>('');
  const [packageId, setPackageId] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const filteredPackages = serviceType ? packages.filter(p => p.type === serviceType && p.active) : [];
  const selectedPkg = packages.find(p => p.id === packageId);
  const isESim = serviceType === 'esim';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageId) return;
    setLoading(true);
    setTimeout(() => {
      const ok = createOrder({ packageId, customerPhone: phone || undefined, customerWhatsapp: whatsapp || undefined });
      setLoading(false);
      if (ok) {
        setSuccess(true);
        setServiceType('');
        setPackageId('');
        setPhone('');
        setWhatsapp('');
        setTimeout(() => setSuccess(false), 3000);
      }
    }, 600);
  };

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Balance indicator */}
      <div className="brutal-card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>رصيدك المتاح:</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 20, color: balance < 20 ? '#dc2626' : '#16a34a' }}>
          {fmt(balance)}
        </span>
      </div>

      {success && (
        <div style={{ background: '#bbf7d0', border: '2px solid #09090B', boxShadow: '-3px 3px 0 0 #16a34a', padding: '16px 20px', marginBottom: 20, fontWeight: 700, fontSize: 15 }}>
          ✅ تم إرسال الطلب بنجاح! سيتم تنفيذه قريباً.
        </div>
      )}

      <div className="brutal-card" style={{ padding: '24px' }}>
        <h2 style={{ fontWeight: 900, fontSize: 18, marginBottom: 20, borderBottom: '2px solid #09090B', paddingBottom: 12 }}>
          ➕ طلب جديد
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Service type */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              1. نوع الخدمة
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(Object.entries(PACKAGE_TYPE_LABELS) as [PackageType, string][]).map(([type, label]) => {
                const count = packages.filter(p => p.type === type && p.active).length;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`brutal-btn ${serviceType === type ? 'brutal-btn-primary' : ''}`}
                    style={{ padding: '10px 8px', flexDirection: 'column', gap: 4, fontSize: 13 }}
                    onClick={() => { setServiceType(type); setPackageId(''); }}
                    disabled={count === 0}
                  >
                    <span>{label}</span>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>{count} حزمة</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Package selection */}
          {serviceType && (
            <div style={{ marginBottom: 20, animation: 'fadeInUp 0.3s ease' }}>
              <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                2. اختر الحزمة
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredPackages.map(pkg => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setPackageId(pkg.id)}
                    style={{
                      border: `2px solid ${packageId === pkg.id ? '#0A34A6' : '#09090B'}`,
                      background: packageId === pkg.id ? '#EFF6FF' : '#fff',
                      boxShadow: packageId === pkg.id ? '-3px 3px 0 0 #0A34A6' : '-2px 2px 0 0 #09090B',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'right',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{pkg.name}</div>
                      {pkg.description && <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{pkg.description}</div>}
                      {pkg.company && <div style={{ fontSize: 12, fontWeight: 700, color: '#0A34A6', marginTop: 2 }}>{pkg.company} · {pkg.duration}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 18, color: '#0A34A6' }}>{fmt(pkg.price)}</span>
                      {(balance) < pkg.price && (
                        <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>رصيد غير كافٍ</span>
                      )}
                    </div>
                  </button>
                ))}
                {filteredPackages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#71717a', fontWeight: 700, border: '2px dashed #e4e4e7' }}>
                    لا توجد حزم متاحة لهذا النوع
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Customer info */}
          {packageId && (
            <div style={{ marginBottom: 20, animation: 'fadeInUp 0.3s ease' }}>
              <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                3. {isESim ? 'رقم واتساب الزبون' : 'رقم هاتف الزبون'}
              </label>
              {isESim ? (
                <input
                  className="brutal-input"
                  placeholder="+970591234567"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  required
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  dir="ltr"
                />
              ) : (
                <input
                  className="brutal-input"
                  placeholder="05XXXXXXXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  dir="ltr"
                />
              )}
              {isESim && (
                <p style={{ fontSize: 12, color: '#71717a', marginTop: 4, fontWeight: 600 }}>
                  📱 سيفتح الأدمن واتساب مباشرة لإرسال رمز QR للزبون
                </p>
              )}
            </div>
          )}

          {/* Summary */}
          {selectedPkg && (phone || whatsapp) && (
            <div style={{ background: '#EFF6FF', border: '2px solid #0A34A6', padding: '14px 16px', marginBottom: 20, boxShadow: '-3px 3px 0 0 #0A34A6' }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: '#0A34A6' }}>ملخص الطلب</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717a' }}>الحزمة:</span>
                  <span style={{ fontWeight: 700 }}>{selectedPkg.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717a' }}>{isESim ? 'واتساب:' : 'الرقم:'}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{phone || whatsapp}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #0A34A6', paddingTop: 6, marginTop: 4 }}>
                  <span style={{ fontWeight: 800 }}>سيُخصم:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 16, color: '#0A34A6' }}>{fmt(selectedPkg.price)}</span>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="brutal-btn brutal-btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: 16, fontWeight: 900 }}
            disabled={!packageId || (!phone && !whatsapp) || loading || balance < (selectedPkg?.price || 0)}
          >
            {loading ? '⏳ جاري الإرسال...' : '📤 إرسال الطلب'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── My Orders Page ───────────────────────────────────────────────────────────
export function ResellerOrders() {
  const { orders, currentUser } = useStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'success' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const myOrders = orders.filter(o => o.reseller_id === currentUser?.id);
  const byStatus = filter === 'all' ? myOrders : myOrders.filter(o => o.status === filter);
  const filtered = search.trim()
    ? byStatus.filter(o =>
        o.package_name.includes(search) ||
        (o.customer_phone || '').includes(search) ||
        (o.customer_whatsapp || '').includes(search)
      )
    : byStatus;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'pending', 'success', 'failed'] as const).map(f => (
          <button
            key={f}
            className={`brutal-btn brutal-btn-sm ${filter === f ? 'brutal-btn-primary' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? `الكل (${myOrders.length})` : f === 'pending' ? `معلقة (${myOrders.filter(o => o.status === 'pending').length})` : f === 'success' ? `منجزة (${myOrders.filter(o => o.status === 'success').length})` : `مرفوضة (${myOrders.filter(o => o.status === 'failed').length})`}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
          <input
            className="brutal-input"
            placeholder="بحث بالحزمة أو الرقم..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingRight: 34 }}
          />
        </div>
        {search && (
          <button className="brutal-btn brutal-btn-sm" onClick={() => setSearch('')}>✕ مسح</button>
        )}
      </div>
      {search && (
        <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#71717a' }}>
          نتائج البحث عن "<span style={{ color: '#0A34A6' }}>{search}</span>": {filtered.length} نتيجة
        </div>
      )}

      <div className="brutal-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="brutal-table">
            <thead>
              <tr>
                <th>الحزمة / النوع</th>
                <th>رقم الزبون</th>
                <th>السعر</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={o.id} className="row-animate" style={{ animationDelay: `${i * 30}ms` }}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{o.package_name}</div>
                    <span className="badge" style={{ background: '#f4f4f5', border: '1px solid #09090B', fontSize: 10 }}>
                      {PACKAGE_TYPE_LABELS[o.package_type]}
                    </span>
                    {o.package_company && (
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{o.package_company} · {o.package_duration}</div>
                    )}
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                    {o.customer_phone || o.customer_whatsapp || '—'}
                  </td>
                  <td><span className="num" style={{ fontWeight: 800 }}>{fmt(o.price)}</span></td>
                  <td>
                    <StatusBadge status={o.status} />
                    {o.fail_reason && (
                      <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 4, background: '#fecaca', border: '1px solid #09090B', padding: '2px 6px', maxWidth: 160 }}>
                        {o.fail_reason}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: '#71717a' }}>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState message="لا توجد طلبات في هذا الفلتر" icon="🔍" />}
        </div>
      </div>
    </div>
  );
}
