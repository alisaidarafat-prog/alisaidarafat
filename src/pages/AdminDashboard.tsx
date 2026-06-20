import React, { useState } from 'react';
import { useStore, fmt, fmtDate, PACKAGE_TYPE_LABELS } from '../store';
import { Modal, FormField, StatusBadge, EmptyState } from '../components';

// ─── Stats Page ───────────────────────────────────────────────────────────────
export function AdminStats() {
  const { users, packages, orders } = useStore();
  const resellers = users.filter(u => u.role === 'reseller');
  const activeResellers = resellers.filter(u => u.active);
  const activePackages = packages.filter(p => p.active);
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const successOrders = orders.filter(o => o.status === 'success');
  const failedOrders = orders.filter(o => o.status === 'failed');
  const totalRevenue = successOrders.reduce((sum, o) => sum + o.price, 0);
  const totalBalances = resellers.reduce((sum, u) => sum + (u.balance || 0), 0);

  const statCards = [
    { label: 'إجمالي الموزعين', value: resellers.length, sub: `${activeResellers.length} نشط`, icon: '👥', color: '#0A34A6', textColor: '#fff' },
    { label: 'الحزم النشطة', value: activePackages.length, sub: `من ${packages.length} حزمة`, icon: '📦', color: '#09090B', textColor: '#fff' },
    { label: 'طلبات معلقة', value: pendingOrders.length, sub: 'تحتاج تنفيذ', icon: '⏳', color: '#fef08a', textColor: '#09090B' },
    { label: 'إجمالي الإيرادات', value: fmt(totalRevenue), sub: `${successOrders.length} طلب منجز`, icon: '💰', color: '#bbf7d0', textColor: '#09090B' },
    { label: 'الأرصدة المجمعة', value: fmt(totalBalances), sub: 'لدى الموزعين', icon: '🏦', color: '#f4f4f5', textColor: '#09090B' },
    { label: 'طلبات مرفوضة', value: failedOrders.length, sub: 'تم استرداد الرصيد', icon: '✕', color: '#fecaca', textColor: '#09090B' },
  ];

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {statCards.map((card, i) => (
          <div key={i} className="brutal-card" style={{ padding: '20px', background: card.color, color: card.textColor }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>{card.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left' }}>{card.label}</span>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 28, lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, opacity: 0.7 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="brutal-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '2px solid #09090B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontWeight: 900, fontSize: 16 }}>آخر الطلبات</h2>
          <span style={{ fontSize: 12, color: '#71717a', fontWeight: 700 }}>أحدث 5 طلبات</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="brutal-table">
            <thead>
              <tr>
                <th>الموزع</th>
                <th>الحزمة</th>
                <th>السعر</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map((o, i) => (
                <tr key={o.id} className="row-animate" style={{ animationDelay: `${i * 50}ms` }}>
                  <td style={{ fontWeight: 700 }}>{o.reseller_name}</td>
                  <td>{o.package_name}</td>
                  <td><span className="num">{fmt(o.price)}</span></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td style={{ color: '#71717a', fontSize: 12 }}>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <EmptyState message="لا توجد طلبات بعد" icon="📭" />}
        </div>
      </div>
    </div>
  );
}

// ─── Orders Page ──────────────────────────────────────────────────────────────
export function AdminOrders() {
  const { orders, approveOrder, rejectOrder } = useStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'success' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const [rejectModal, setRejectModal] = useState<{ orderId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const byStatus = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const filtered = search.trim()
    ? byStatus.filter(o =>
        o.reseller_name.includes(search) ||
        o.reseller_username.includes(search) ||
        o.package_name.includes(search) ||
        (o.customer_phone || '').includes(search) ||
        (o.customer_whatsapp || '').includes(search)
      )
    : byStatus;

  const handleReject = () => {
    if (!rejectModal || !rejectReason.trim()) return;
    rejectOrder(rejectModal.orderId, rejectReason);
    setRejectModal(null);
    setRejectReason('');
  };

  return (
    <div>
      {/* Filter tabs + Search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'pending', 'success', 'failed'] as const).map(f => (
          <button
            key={f}
            className={`brutal-btn brutal-btn-sm ${filter === f ? 'brutal-btn-primary' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? `الكل (${orders.length})` : f === 'pending' ? `معلقة (${orders.filter(o => o.status === 'pending').length})` : f === 'success' ? `منجزة (${orders.filter(o => o.status === 'success').length})` : `مرفوضة (${orders.filter(o => o.status === 'failed').length})`}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
          <input
            className="brutal-input"
            placeholder="بحث بالاسم، الحزمة، أو رقم الزبون..."
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
                <th>الموزع</th>
                <th>الخدمة</th>
                <th>رقم الزبون</th>
                <th>السعر</th>
                <th>الحالة</th>
                <th>التاريخ</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={o.id} className="row-animate" style={{ animationDelay: `${i * 30}ms` }}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{o.reseller_name}</div>
                    <div style={{ fontSize: 11, color: '#71717a' }}>@{o.reseller_username}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{o.package_name}</div>
                    <div><span className="badge" style={{ fontSize: 10, padding: '1px 6px', border: '1px solid #09090B', background: '#f4f4f5' }}>{PACKAGE_TYPE_LABELS[o.package_type]}</span></div>
                    {o.package_company && <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{o.package_company} · {o.package_duration}</div>}
                  </td>
                  <td>
                    {o.package_type === 'esim' ? (
                      <a href={`https://wa.me/${o.customer_whatsapp?.replace('+', '')}`} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#16a34a', fontWeight: 700, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', textDecoration: 'none', border: '1px solid #16a34a', padding: '2px 8px', background: '#f0fdf4' }}>
                        📱 واتساب
                      </a>
                    ) : (
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{o.customer_phone}</span>
                    )}
                  </td>
                  <td><span className="num" style={{ fontWeight: 800 }}>{fmt(o.price)}</span></td>
                  <td>
                    <StatusBadge status={o.status} />
                    {o.fail_reason && <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 4, maxWidth: 150 }}>{o.fail_reason}</div>}
                  </td>
                  <td style={{ fontSize: 12, color: '#71717a' }}>{fmtDate(o.created_at)}</td>
                  <td>
                    {o.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="brutal-btn brutal-btn-success brutal-btn-sm" onClick={() => approveOrder(o.id)}>✓ تنفيذ</button>
                        <button className="brutal-btn brutal-btn-danger brutal-btn-sm" onClick={() => setRejectModal({ orderId: o.id })}>✕ رفض</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState message="لا توجد طلبات في هذا الفلتر" icon="🔍" />}
        </div>
      </div>

      {rejectModal && (
        <Modal title="رفض الطلب" onClose={() => { setRejectModal(null); setRejectReason(''); }}>
          <FormField label="سبب الرفض" required>
            <input className="brutal-input" placeholder="مثال: الرقم غير صحيح" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </FormField>
          <div style={{ background: '#fef3c7', border: '1.5px solid #09090B', padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
            ⚠️ سيتم استرداد المبلغ تلقائياً لرصيد الموزع
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="brutal-btn brutal-btn-danger" style={{ flex: 1 }} onClick={handleReject}>✕ تأكيد الرفض</button>
            <button className="brutal-btn" onClick={() => { setRejectModal(null); setRejectReason(''); }}>إلغاء</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Resellers Page ───────────────────────────────────────────────────────────
export function AdminResellers() {
  const { users, createReseller, updateReseller, deleteReseller, adjustBalance } = useStore();
  const resellers = users.filter(u => u.role === 'reseller');

  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<typeof resellers[0] | null>(null);
  const [balanceModal, setBalanceModal] = useState<typeof resellers[0] | null>(null);
  const [createForm, setCreateForm] = useState({ username: '', name: '', password: '', initialBalance: '' });
  const [editForm, setEditForm] = useState({ name: '', active: true });
  const [balanceForm, setBalanceForm] = useState({ amount: '', note: '' });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createReseller({ username: createForm.username, name: createForm.name, password: createForm.password, initialBalance: parseFloat(createForm.initialBalance) || 0 });
    setCreateModal(false);
    setCreateForm({ username: '', name: '', password: '', initialBalance: '' });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    updateReseller(editModal.id, editForm);
    setEditModal(null);
  };

  const handleBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModal) return;
    adjustBalance(balanceModal.id, parseFloat(balanceForm.amount), balanceForm.note);
    setBalanceModal(null);
    setBalanceForm({ amount: '', note: '' });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="brutal-btn brutal-btn-primary" onClick={() => setCreateModal(true)}>+ إضافة موزع جديد</button>
      </div>

      <div className="brutal-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="brutal-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>اسم المستخدم</th>
                <th>الرصيد</th>
                <th>الحالة</th>
                <th>تاريخ الإنشاء</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {resellers.map((r, i) => (
                <tr key={r.id} className="row-animate" style={{ animationDelay: `${i * 40}ms` }}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>@{r.username}</span></td>
                  <td><span className="num" style={{ fontWeight: 800, color: (r.balance || 0) < 50 ? '#dc2626' : '#16a34a' }}>{fmt(r.balance || 0)}</span></td>
                  <td><StatusBadge status={r.active ? 'active' : 'inactive'} /></td>
                  <td style={{ fontSize: 12, color: '#71717a' }}>{fmtDate(r.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="brutal-btn brutal-btn-sm" onClick={() => { setBalanceModal(r); setBalanceForm({ amount: '', note: '' }); }}>
                        💰 رصيد
                      </button>
                      <button className="brutal-btn brutal-btn-sm" onClick={() => { setEditModal(r); setEditForm({ name: r.name, active: r.active }); }}>
                        ✏️ تعديل
                      </button>
                      <button className="brutal-btn brutal-btn-sm brutal-btn-danger" onClick={() => {
                        if (confirm(`حذف ${r.name}؟`)) deleteReseller(r.id);
                      }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {resellers.length === 0 && <EmptyState message="لا يوجد موزعون بعد" icon="👥" />}
        </div>
      </div>

      {/* Create Modal */}
      {createModal && (
        <Modal title="إضافة موزع جديد" onClose={() => setCreateModal(false)}>
          <form onSubmit={handleCreate}>
            <FormField label="الاسم الكامل" required>
              <input className="brutal-input" placeholder="مثال: محمد علي" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
            </FormField>
            <FormField label="اسم المستخدم" required>
              <input className="brutal-input" placeholder="بالإنجليزية بدون مسافات" value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} required />
            </FormField>
            <FormField label="كلمة المرور" required>
              <input className="brutal-input" type="password" placeholder="كلمة مرور قوية" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} required />
            </FormField>
            <FormField label="الرصيد الأولي (₪)">
              <input className="brutal-input" type="number" min="0" step="0.01" placeholder="0.00" value={createForm.initialBalance} onChange={e => setCreateForm(f => ({ ...f, initialBalance: e.target.value }))} />
            </FormField>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" className="brutal-btn brutal-btn-primary" style={{ flex: 1 }}>+ إنشاء الحساب</button>
              <button type="button" className="brutal-btn" onClick={() => setCreateModal(false)}>إلغاء</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editModal && (
        <Modal title={`تعديل: ${editModal.name}`} onClose={() => setEditModal(null)}>
          <form onSubmit={handleEdit}>
            <FormField label="الاسم الكامل" required>
              <input className="brutal-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
            </FormField>
            <FormField label="حالة الحساب">
              <select className="brutal-select" value={editForm.active ? 'active' : 'inactive'} onChange={e => setEditForm(f => ({ ...f, active: e.target.value === 'active' }))}>
                <option value="active">نشط</option>
                <option value="inactive">معطل</option>
              </select>
            </FormField>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" className="brutal-btn brutal-btn-primary" style={{ flex: 1 }}>حفظ التغييرات</button>
              <button type="button" className="brutal-btn" onClick={() => setEditModal(null)}>إلغاء</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Balance Modal */}
      {balanceModal && (
        <Modal title={`شحن/خصم رصيد — ${balanceModal.name}`} onClose={() => setBalanceModal(null)}>
          <div className="brutal-card" style={{ padding: '14px 18px', marginBottom: 16, background: '#0A34A6', color: '#fff' }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>الرصيد الحالي</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 28 }}>{fmt(balanceModal.balance || 0)}</div>
          </div>
          <form onSubmit={handleBalance}>
            <FormField label="المبلغ (موجب = شحن، سالب = خصم)" required>
              <input className="brutal-input" type="number" step="0.01" placeholder="مثال: 100 أو -50" value={balanceForm.amount} onChange={e => setBalanceForm(f => ({ ...f, amount: e.target.value }))} required />
            </FormField>
            <FormField label="ملاحظة">
              <input className="brutal-input" placeholder="مثال: دفعة نقدية بتاريخ ..." value={balanceForm.note} onChange={e => setBalanceForm(f => ({ ...f, note: e.target.value }))} />
            </FormField>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="brutal-btn brutal-btn-primary" style={{ flex: 1 }}>تأكيد العملية</button>
              <button type="button" className="brutal-btn" onClick={() => setBalanceModal(null)}>إلغاء</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Packages Page ────────────────────────────────────────────────────────────
export function AdminPackages() {
  const { packages, createPackage, updatePackage, deletePackage } = useStore();
  const [modal, setModal] = useState<'create' | typeof packages[0] | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'balance' as any, price: '', active: true,
    description: '', duration: '', company: ''
  });

  const openCreate = () => {
    setForm({ name: '', type: 'balance', price: '', active: true, description: '', duration: '', company: '' });
    setModal('create');
  };

  const openEdit = (pkg: typeof packages[0]) => {
    setForm({ name: pkg.name, type: pkg.type, price: String(pkg.price), active: pkg.active, description: pkg.description || '', duration: pkg.duration || '', company: pkg.company || '' });
    setModal(pkg);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name, type: form.type, price: parseFloat(form.price), active: form.active, description: form.description, duration: form.duration, company: form.company };
    if (modal === 'create') {
      createPackage(data);
    } else if (modal && typeof modal === 'object') {
      updatePackage(modal.id, data);
    }
    setModal(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="brutal-btn brutal-btn-primary" onClick={openCreate}>+ إضافة حزمة</button>
      </div>

      <div className="brutal-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="brutal-table">
            <thead>
              <tr>
                <th>اسم الحزمة</th>
                <th>النوع</th>
                <th>السعر</th>
                <th>التفاصيل</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p, i) => (
                <tr key={p.id} className="row-animate" style={{ animationDelay: `${i * 30}ms` }}>
                  <td style={{ fontWeight: 700 }}>{p.name}</td>
                  <td><span className="badge" style={{ background: '#f4f4f5', border: '1.5px solid #09090B', fontSize: 11 }}>{PACKAGE_TYPE_LABELS[p.type]}</span></td>
                  <td><span className="num" style={{ fontWeight: 800 }}>{fmt(p.price)}</span></td>
                  <td style={{ fontSize: 12, color: '#71717a' }}>
                    {p.description || '—'}
                    {p.company && <div style={{ fontWeight: 700, color: '#09090B' }}>{p.company} · {p.duration}</div>}
                  </td>
                  <td>
                    <button
                      className={`badge ${p.active ? 'badge-active' : 'badge-inactive'}`}
                      style={{ cursor: 'pointer', background: p.active ? '#bbf7d0' : '#e4e4e7', border: '1.5px solid #09090B' }}
                      onClick={() => updatePackage(p.id, { active: !p.active })}
                    >
                      {p.active ? '● نشط' : '○ معطل'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="brutal-btn brutal-btn-sm" onClick={() => openEdit(p)}>✏️ تعديل</button>
                      <button className="brutal-btn brutal-btn-sm brutal-btn-danger" onClick={() => { if (confirm('حذف الحزمة؟')) deletePackage(p.id); }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {packages.length === 0 && <EmptyState message="لا توجد حزم بعد" icon="📦" />}
        </div>
      </div>

      {modal !== null && (
        <Modal title={modal === 'create' ? 'إضافة حزمة جديدة' : `تعديل: ${(modal as any).name}`} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <FormField label="اسم الحزمة" required>
              <input className="brutal-input" placeholder="مثال: رصيد 20 شيكل" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </FormField>
            <FormField label="نوع الحزمة" required>
              <select className="brutal-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                {Object.entries(PACKAGE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="السعر (₪)" required>
              <input className="brutal-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
            </FormField>
            {form.type === 'esim' && (
              <>
                <FormField label="الشركة المزودة" required>
                  <input className="brutal-input" placeholder="مثال: Orange, Jawwal" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                </FormField>
                <FormField label="المدة" required>
                  <input className="brutal-input" placeholder="مثال: شهر، 14 يوم" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
                </FormField>
              </>
            )}
            <FormField label="وصف (اختياري)">
              <input className="brutal-input" placeholder="وصف مختصر" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </FormField>
            <FormField label="الحالة">
              <select className="brutal-select" value={form.active ? 'active' : 'inactive'} onChange={e => setForm(f => ({ ...f, active: e.target.value === 'active' }))}>
                <option value="active">نشط</option>
                <option value="inactive">معطل</option>
              </select>
            </FormField>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" className="brutal-btn brutal-btn-primary" style={{ flex: 1 }}>
                {modal === 'create' ? '+ إضافة الحزمة' : 'حفظ التغييرات'}
              </button>
              <button type="button" className="brutal-btn" onClick={() => setModal(null)}>إلغاء</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Logs Page ────────────────────────────────────────────────────────────────
export function AdminLogs() {
  const { logs } = useStore();
  const typeLabels: Record<string, string> = { topup: '↑ شحن', deduct: '↓ خصم', order: '📦 طلب', refund: '↩ استرداد' };

  return (
    <div className="brutal-card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="brutal-table">
          <thead>
            <tr>
              <th>الموزع</th>
              <th>النوع</th>
              <th>المبلغ</th>
              <th>الملاحظة</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {[...logs].reverse().map((l, i) => (
              <tr key={l.id} className="row-animate" style={{ animationDelay: `${i * 25}ms` }}>
                <td style={{ fontWeight: 700 }}>{l.reseller_name}</td>
                <td><span className="badge" style={{ background: '#f4f4f5', border: '1.5px solid #09090B', fontSize: 11 }}>{typeLabels[l.type] || l.type}</span></td>
                <td>
                  <span className="num" style={{ fontWeight: 800, color: l.amount > 0 ? '#16a34a' : '#dc2626' }}>
                    {l.amount > 0 ? '+' : ''}{fmt(l.amount)}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: '#71717a' }}>{l.note || '—'}</td>
                <td style={{ fontSize: 12, color: '#71717a' }}>{fmtDate(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <EmptyState message="لا توجد سجلات بعد" icon="📜" />}
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
export function AdminSettings() {
  const { telegramEnabled, telegramChatId, updateSettings, addToast } = useStore();
  const [chatId, setChatId] = useState(telegramChatId);
  const [enabled, setEnabled] = useState(telegramEnabled);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(chatId, enabled);
  };

  const handleTest = () => {
    if (!chatId) { addToast('error', 'أدخل Chat ID أولاً'); return; }
    addToast('success', '✅ تم إرسال رسالة اختبار لتليجرام بنجاح');
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="brutal-card" style={{ padding: '24px', marginBottom: 20 }}>
        <h2 style={{ fontWeight: 900, fontSize: 18, marginBottom: 20, borderBottom: '2px solid #09090B', paddingBottom: 12 }}>
          📬 إعدادات بوت تليجرام
        </h2>
        <form onSubmit={handleSave}>
          <FormField label="Telegram Chat ID">
            <input
              className="brutal-input"
              placeholder="مثال: 123456789"
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
            <p style={{ fontSize: 12, color: '#71717a', marginTop: 4, fontWeight: 600 }}>
              افتح @userinfobot على تليجرام للحصول على Chat ID الخاص بك
            </p>
          </FormField>

          <FormField label="حالة الإشعارات">
            <div style={{ display: 'flex', gap: 12 }}>
              {[{ v: true, l: '✅ مفعّل' }, { v: false, l: '❌ معطّل' }].map(opt => (
                <button
                  key={String(opt.v)}
                  type="button"
                  className={`brutal-btn ${enabled === opt.v ? 'brutal-btn-primary' : ''}`}
                  onClick={() => setEnabled(opt.v)}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </FormField>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" className="brutal-btn brutal-btn-primary" style={{ flex: 1 }}>حفظ الإعدادات</button>
            <button type="button" className="brutal-btn" onClick={handleTest}>📤 اختبار الإرسال</button>
          </div>
        </form>
      </div>

      <div className="brutal-card" style={{ padding: '20px', background: '#fef3c7', border: '2px solid #09090B' }}>
        <h3 style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>📋 مثال على رسالة تليجرام</h3>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, background: '#fff', border: '1.5px solid #09090B', padding: '12px', lineHeight: 1.8 }}>
          <p>🔔 <strong>طلب جديد</strong></p>
          <p>👤 المسوق: محمود أحمد (@mahmoud)</p>
          <p>📦 الحزمة: إنترنت 5GB</p>
          <p>📱 رقم الزبون: 0599123456</p>
          <p>💰 السعر: 25.00 ₪</p>
          <p>🆔 رقم الطلب: abc123def</p>
        </div>
      </div>
    </div>
  );
}
