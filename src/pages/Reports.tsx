import React, { useState, useMemo } from 'react';
import { useStore, fmt } from '../store';
import type { Order } from '../store';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function getMonthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function getMonthLabel(key: string) {
  const [, m] = key.split('-');
  return MONTHS_AR[parseInt(m, 10) - 1];
}
function getLast6Months() {
  const result: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────
interface BarChartProps {
  data: { label: string; value: number; color: string }[];
  maxVal: number;
  height?: number;
  unit?: string;
}
function BarChart({ data, maxVal, height = 180, unit = '₪' }: BarChartProps) {
  const barW = Math.floor(420 / (data.length * 1.6));
  const gap = Math.floor(420 / data.length) - barW;
  const chartH = height;
  const padL = 52, padB = 36, padT = 20, padR = 10;
  const innerW = 420;
  const innerH = chartH;

  const yTicks = 4;
  const tickVal = maxVal > 0 ? Math.ceil(maxVal / yTicks) : 1;

  return (
    <svg
      viewBox={`0 0 ${innerW + padL + padR} ${innerH + padT + padB}`}
      style={{ width: '100%', overflow: 'visible', direction: 'ltr' }}
    >
      {/* Y grid lines */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = padT + innerH - (i / yTicks) * innerH;
        const val = i * tickVal;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="#e4e4e7" strokeWidth={1} strokeDasharray="4,3" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#71717a" fontFamily="JetBrains Mono, monospace" fontWeight="600">
              {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = padL + i * (barW + gap) + gap / 2;
        const barH = maxVal > 0 ? Math.max(2, (d.value / maxVal) * innerH) : 2;
        const y = padT + innerH - barH;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={barW} height={barH}
              fill={d.color} stroke="#09090B" strokeWidth={1.5}
              style={{ filter: 'drop-shadow(-2px 2px 0 #09090B)' }}
            />
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#09090B" fontFamily="JetBrains Mono, monospace" fontWeight="700">
                {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value}
              </text>
            )}
            <text x={x + barW / 2} y={padT + innerH + 18} textAnchor="middle" fontSize={11} fill="#09090B" fontFamily="Cairo, sans-serif" fontWeight="700">
              {d.label}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#09090B" strokeWidth={2} />
      <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#09090B" strokeWidth={2} />
    </svg>
  );
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────
interface LineChartProps {
  datasets: { label: string; data: number[]; color: string }[];
  labels: string[];
  maxVal: number;
  height?: number;
}
function LineChart({ datasets, labels, maxVal, height = 180 }: LineChartProps) {
  const padL = 52, padB = 36, padT = 20, padR = 16;
  const innerW = 420;
  const innerH = height;
  const yTicks = 4;
  const tickVal = maxVal > 0 ? Math.ceil(maxVal / yTicks) : 1;
  const n = labels.length;

  const getX = (i: number) => padL + (i / Math.max(n - 1, 1)) * innerW;
  const getY = (v: number) => padT + innerH - (maxVal > 0 ? (v / maxVal) * innerH : 0);

  return (
    <svg viewBox={`0 0 ${innerW + padL + padR} ${innerH + padT + padB}`} style={{ width: '100%', overflow: 'visible', direction: 'ltr' }}>
      {/* Y grid */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = padT + innerH - (i / yTicks) * innerH;
        const val = i * tickVal;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="#e4e4e7" strokeWidth={1} strokeDasharray="4,3" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#71717a" fontFamily="JetBrains Mono, monospace" fontWeight="600">
              {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
            </text>
          </g>
        );
      })}

      {/* Lines + dots */}
      {datasets.map((ds, di) => {
        const points = ds.data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
        return (
          <g key={di}>
            <polyline points={points} fill="none" stroke={ds.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {ds.data.map((v, i) => (
              <circle key={i} cx={getX(i)} cy={getY(v)} r={4} fill={ds.color} stroke="#09090B" strokeWidth={1.5} />
            ))}
          </g>
        );
      })}

      {/* X labels */}
      {labels.map((l, i) => (
        <text key={i} x={getX(i)} y={padT + innerH + 18} textAnchor="middle" fontSize={11} fill="#09090B" fontFamily="Cairo, sans-serif" fontWeight="700">{l}</text>
      ))}

      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#09090B" strokeWidth={2} />
      <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#09090B" strokeWidth={2} />
    </svg>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return (
    <div style={{ textAlign: 'center', padding: 30, color: '#71717a', fontWeight: 700 }}>لا توجد بيانات</div>
  );
  let cumAngle = -Math.PI / 2;
  const cx = 80, cy = 80, r = 60, innerR = 36;

  const paths = slices.map(s => {
    const angle = (s.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const xi1 = cx + innerR * Math.cos(cumAngle - angle);
    const yi1 = cy + innerR * Math.sin(cumAngle - angle);
    const xi2 = cx + innerR * Math.cos(cumAngle);
    const yi2 = cy + innerR * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...s, d: `M${xi1},${yi1} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${innerR},${innerR} 0 ${large},0 ${xi1},${yi1} Z` };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg viewBox="0 0 160 160" style={{ width: 160, minWidth: 160 }}>
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="#09090B" strokeWidth={1.5} />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={13} fontWeight="900" fill="#09090B" fontFamily="JetBrains Mono, monospace">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#71717a" fontFamily="Cairo, sans-serif" fontWeight="700">إجمالي</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, background: s.color, border: '1.5px solid #09090B', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>{s.label}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13, marginRight: 'auto', color: '#0A34A6' }}>
              {s.value} ({total > 0 ? Math.round(s.value / total * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────
export function AdminReports() {
  const { orders, users, logs } = useStore();
  const months = getLast6Months();
  const resellers = users.filter(u => u.role === 'reseller');

  // Revenue per month
  const revenueByMonth = useMemo(() => months.map(mk => ({
    label: getMonthLabel(mk),
    value: Math.round(orders.filter(o => o.status === 'success' && getMonthKey(o.created_at) === mk).reduce((s, o) => s + o.price, 0)),
    color: '#0A34A6',
  })), [orders, months]);

  // Orders count per month (success + pending)
  const ordersByMonth = useMemo(() => months.map(mk => ({
    label: getMonthLabel(mk),
    success: orders.filter(o => o.status === 'success' && getMonthKey(o.created_at) === mk).length,
    pending: orders.filter(o => o.status === 'pending' && getMonthKey(o.created_at) === mk).length,
    failed: orders.filter(o => o.status === 'failed' && getMonthKey(o.created_at) === mk).length,
  })), [orders, months]);

  // Topup per month
  const topupByMonth = useMemo(() => months.map(mk => ({
    label: getMonthLabel(mk),
    value: Math.round(logs.filter(l => l.type === 'topup' && getMonthKey(l.created_at) === mk).reduce((s, l) => s + l.amount, 0)),
    color: '#16a34a',
  })), [logs, months]);

  // Per reseller revenue
  const resellerRevenue = useMemo(() => resellers.map(r => ({
    label: r.name.split(' ')[0],
    value: Math.round(orders.filter(o => o.reseller_id === r.id && o.status === 'success').reduce((s, o) => s + o.price, 0)),
    color: ['#0A34A6', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed'][resellers.indexOf(r) % 5],
  })).filter(r => r.value > 0), [orders, resellers]);

  // KPIs
  const totalRevenue = orders.filter(o => o.status === 'success').reduce((s, o) => s + o.price, 0);
  const totalOrders = orders.length;
  const successRate = totalOrders > 0 ? Math.round(orders.filter(o => o.status === 'success').length / totalOrders * 100) : 0;
  const avgOrderVal = orders.filter(o => o.status === 'success').length > 0
    ? totalRevenue / orders.filter(o => o.status === 'success').length : 0;

  const maxRev = Math.max(...revenueByMonth.map(d => d.value), 1);
  const maxTopup = Math.max(...topupByMonth.map(d => d.value), 1);
  const maxResRev = Math.max(...resellerRevenue.map(d => d.value), 1);
  const maxOrders = Math.max(...ordersByMonth.map(d => d.success + d.pending + d.failed), 1);

  const lineData = [
    { label: 'منجزة', data: ordersByMonth.map(m => m.success), color: '#16a34a' },
    { label: 'معلقة', data: ordersByMonth.map(m => m.pending), color: '#ca8a04' },
    { label: 'مرفوضة', data: ordersByMonth.map(m => m.failed), color: '#dc2626' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'إجمالي الإيرادات', value: fmt(totalRevenue), icon: '💰', color: '#bbf7d0' },
          { label: 'معدل النجاح', value: `${successRate}%`, icon: '📈', color: '#bfdbfe' },
          { label: 'متوسط قيمة الطلب', value: fmt(avgOrderVal), icon: '🧮', color: '#fef08a' },
          { label: 'إجمالي الطلبات', value: totalOrders, icon: '📋', color: '#f4f4f5' },
        ].map((k, i) => (
          <div key={i} className="brutal-card" style={{ padding: '18px 16px', background: k.color }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{k.icon}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 22, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: '#3f3f46' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="brutal-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '2px solid #09090B', paddingBottom: 12 }}>
          <h2 style={{ fontWeight: 900, fontSize: 16 }}>📊 الإيرادات الشهرية</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, background: '#0A34A6', border: '1.5px solid #09090B' }} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>إيرادات الطلبات المنجزة (₪)</span>
          </div>
        </div>
        <BarChart data={revenueByMonth} maxVal={maxRev} height={180} unit="₪" />
      </div>

      {/* Orders trend */}
      <div className="brutal-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '2px solid #09090B', paddingBottom: 12 }}>
          <h2 style={{ fontWeight: 900, fontSize: 16 }}>📉 اتجاه الطلبات الشهري</h2>
          <div style={{ display: 'flex', gap: 14 }}>
            {lineData.map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 24, height: 3, background: d.color, borderRadius: 2 }} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        <LineChart datasets={lineData} labels={months.map(getMonthLabel)} maxVal={maxOrders} height={180} />
      </div>

      {/* Bottom row: topup + donut + reseller */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Topup chart */}
        <div className="brutal-card" style={{ padding: '20px 24px' }}>
          <div style={{ borderBottom: '2px solid #09090B', paddingBottom: 12, marginBottom: 20 }}>
            <h2 style={{ fontWeight: 900, fontSize: 16 }}>💳 شحن الأرصدة الشهري</h2>
          </div>
          <BarChart data={topupByMonth} maxVal={maxTopup} height={160} unit="₪" />
        </div>

        {/* Order status donut */}
        <div className="brutal-card" style={{ padding: '20px 24px' }}>
          <div style={{ borderBottom: '2px solid #09090B', paddingBottom: 12, marginBottom: 20 }}>
            <h2 style={{ fontWeight: 900, fontSize: 16 }}>🍩 توزيع حالات الطلبات</h2>
          </div>
          <DonutChart slices={[
            { label: 'منجزة', value: orders.filter(o => o.status === 'success').length, color: '#bbf7d0' },
            { label: 'معلقة', value: orders.filter(o => o.status === 'pending').length, color: '#fef08a' },
            { label: 'مرفوضة', value: orders.filter(o => o.status === 'failed').length, color: '#fecaca' },
          ]} />
        </div>
      </div>

      {/* Per-reseller revenue */}
      {resellerRevenue.length > 0 && (
        <div className="brutal-card" style={{ padding: '20px 24px' }}>
          <div style={{ borderBottom: '2px solid #09090B', paddingBottom: 12, marginBottom: 20 }}>
            <h2 style={{ fontWeight: 900, fontSize: 16 }}>👥 إيرادات كل موزع</h2>
          </div>
          <BarChart data={resellerRevenue} maxVal={maxResRev} height={160} unit="₪" />
        </div>
      )}

      {/* Top packages table */}
      <div className="brutal-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '2px solid #09090B' }}>
          <h2 style={{ fontWeight: 900, fontSize: 16 }}>🏆 أكثر الحزم مبيعاً</h2>
        </div>
        <TopPackagesTable orders={orders} />
      </div>
    </div>
  );
}

function TopPackagesTable({ orders }: { orders: Order[] }) {
  const map: Record<string, { name: string; count: number; revenue: number }> = {};
  orders.filter(o => o.status === 'success').forEach(o => {
    if (!map[o.package_id]) map[o.package_id] = { name: o.package_name, count: 0, revenue: 0 };
    map[o.package_id].count++;
    map[o.package_id].revenue += o.price;
  });
  const sorted = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const maxRev = sorted[0]?.revenue || 1;

  if (sorted.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#71717a', fontWeight: 700 }}>لا توجد طلبات منجزة بعد</div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="brutal-table">
        <thead>
          <tr>
            <th>#</th>
            <th>اسم الحزمة</th>
            <th>عدد الطلبات</th>
            <th>الإيرادات</th>
            <th>النسبة من الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr key={i} className="row-animate" style={{ animationDelay: `${i * 40}ms` }}>
              <td>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 18,
                  color: i === 0 ? '#ca8a04' : i === 1 ? '#71717a' : i === 2 ? '#b45309' : '#09090B'
                }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
              </td>
              <td style={{ fontWeight: 700 }}>{p.name}</td>
              <td><span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>{p.count}</span></td>
              <td><span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#16a34a' }}>{fmt(p.revenue)}</span></td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    height: 12, background: '#0A34A6', border: '1.5px solid #09090B',
                    width: `${Math.round(p.revenue / maxRev * 100)}%`,
                    minWidth: 4, maxWidth: 160,
                    boxShadow: '-1px 1px 0 0 #09090B',
                  }} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>
                    {Math.round(p.revenue / maxRev * 100)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
