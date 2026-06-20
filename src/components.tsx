import React from 'react';
import { useStore } from './store';

export function ToastContainer() {
  const { toasts } = useStore();
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span style={{ fontSize: 18 }}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: wide ? 640 : 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: '2px solid #09090B', paddingBottom: 16 }}>
          <h2 style={{ fontWeight: 800, fontSize: 18 }}>{title}</h2>
          <button onClick={onClose} style={{ border: '2px solid #09090B', background: '#f4f4f5', width: 32, height: 32, cursor: 'pointer', fontWeight: 900, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}

export function FormField({ label, children, required }: FormFieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'badge badge-pending', label: '⏳ قيد الانتظار' },
    success: { cls: 'badge badge-success', label: '✓ تم التنفيذ' },
    failed: { cls: 'badge badge-failed', label: '✕ مرفوض' },
    active: { cls: 'badge badge-active', label: '● نشط' },
    inactive: { cls: 'badge badge-inactive', label: '○ معطل' },
  };
  const item = map[status] || { cls: 'badge', label: status };
  return <span className={item.cls}>{item.label}</span>;
}

export function EmptyState({ message, icon }: { message: string; icon?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#71717a' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon || '📭'}</div>
      <p style={{ fontWeight: 700, fontSize: 15 }}>{message}</p>
    </div>
  );
}
