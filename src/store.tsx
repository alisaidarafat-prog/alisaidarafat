import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type Role = 'admin' | 'reseller';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  balance?: number;
  active: boolean;
  created_at: string;
}

export type PackageType = 'balance' | 'internet' | 'minutes' | 'sms' | 'esim';

export interface Package {
  id: string;
  name: string;
  type: PackageType;
  price: number;
  active: boolean;
  description?: string;
  duration?: string;
  company?: string;
  created_at: string;
}

export type OrderStatus = 'pending' | 'success' | 'failed';

export interface Order {
  id: string;
  reseller_id: string;
  reseller_name: string;
  reseller_username: string;
  customer_phone?: string;
  customer_whatsapp?: string;
  package_id: string;
  package_name: string;
  package_type: PackageType;
  package_duration?: string;
  package_company?: string;
  price: number;
  status: OrderStatus;
  fail_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface BalanceLog {
  id: string;
  reseller_id: string;
  reseller_name: string;
  amount: number;
  type: 'topup' | 'deduct' | 'order' | 'refund';
  note?: string;
  order_id?: string;
  created_at: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const now = () => new Date().toISOString();
export const fmt = (n: number) => `${n.toFixed(2)} ₪`;
export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  balance: 'رصيد',
  internet: 'إنترنت',
  minutes: 'دقائق',
  sms: 'رسائل',
  esim: 'شريحة eSIM',
};

// ─── Initial Seed Data ────────────────────────────────────────────────────────
const SEED_PACKAGES: Package[] = [
  { id: 'p1', name: 'رصيد 10 ₪', type: 'balance', price: 10, active: true, description: 'شحن رصيد 10 شيكل', created_at: now() },
  { id: 'p2', name: 'رصيد 20 ₪', type: 'balance', price: 20, active: true, description: 'شحن رصيد 20 شيكل', created_at: now() },
  { id: 'p3', name: 'رصيد 50 ₪', type: 'balance', price: 50, active: true, description: 'شحن رصيد 50 شيكل', created_at: now() },
  { id: 'p4', name: 'إنترنت 5GB', type: 'internet', price: 25, active: true, description: '5 جيجابايت لمدة شهر', created_at: now() },
  { id: 'p5', name: 'إنترنت 10GB', type: 'internet', price: 45, active: true, description: '10 جيجابايت لمدة شهر', created_at: now() },
  { id: 'p6', name: '500 دقيقة', type: 'minutes', price: 30, active: true, description: '500 دقيقة مكالمات محلية', created_at: now() },
  { id: 'p7', name: '200 رسالة', type: 'sms', price: 15, active: true, description: '200 رسالة نصية', created_at: now() },
  { id: 'p8', name: 'شريحة Orange 30 يوم', type: 'esim', price: 35, active: true, duration: 'شهر', company: 'Orange', created_at: now() },
  { id: 'p9', name: 'شريحة Jawwal 14 يوم', type: 'esim', price: 25, active: true, duration: '14 يوم', company: 'Jawwal', created_at: now() },
];

const SEED_RESELLERS: User[] = [
  { id: 'r1', username: 'mahmoud', name: 'محمود أحمد', role: 'reseller', balance: 450, active: true, created_at: now() },
  { id: 'r2', username: 'sara', name: 'سارة خالد', role: 'reseller', balance: 280, active: true, created_at: now() },
  { id: 'r3', username: 'ali', name: 'علي حسن', role: 'reseller', balance: 120, active: false, created_at: now() },
];

const SEED_ORDERS: Order[] = [
  {
    id: 'o1', reseller_id: 'r1', reseller_name: 'محمود أحمد', reseller_username: 'mahmoud',
    customer_phone: '0599123456', package_id: 'p4', package_name: 'إنترنت 5GB',
    package_type: 'internet', price: 25, status: 'pending',
    created_at: new Date(Date.now() - 5 * 60000).toISOString(), updated_at: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'o2', reseller_id: 'r2', reseller_name: 'سارة خالد', reseller_username: 'sara',
    customer_phone: '0597654321', package_id: 'p1', package_name: 'رصيد 10 ₪',
    package_type: 'balance', price: 10, status: 'success',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(), updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'o3', reseller_id: 'r1', reseller_name: 'محمود أحمد', reseller_username: 'mahmoud',
    customer_whatsapp: '+970591234567', package_id: 'p8', package_name: 'شريحة Orange 30 يوم',
    package_type: 'esim', package_duration: 'شهر', package_company: 'Orange', price: 35, status: 'pending',
    created_at: new Date(Date.now() - 30 * 60000).toISOString(), updated_at: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: 'o4', reseller_id: 'r2', reseller_name: 'سارة خالد', reseller_username: 'sara',
    customer_phone: '0598888888', package_id: 'p6', package_name: '500 دقيقة',
    package_type: 'minutes', price: 30, status: 'failed', fail_reason: 'الخدمة غير متوفرة حالياً',
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(), updated_at: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
];

const SEED_LOGS: BalanceLog[] = [
  { id: 'l1', reseller_id: 'r1', reseller_name: 'محمود أحمد', amount: 500, type: 'topup', note: 'شحن رصيد أولي', created_at: now() },
  { id: 'l2', reseller_id: 'r1', reseller_name: 'محمود أحمد', amount: -25, type: 'order', order_id: 'o2', created_at: now() },
  { id: 'l3', reseller_id: 'r2', reseller_name: 'سارة خالد', amount: 300, type: 'topup', note: 'شحن رصيد', created_at: now() },
];

// ─── Store ────────────────────────────────────────────────────────────────────
export interface LowBalanceAlert {
  id: string;
  reseller_id: string;
  reseller_name: string;
  balance: number;
  threshold: number;
  seen: boolean;
  created_at: string;
}

interface Store {
  currentUser: User | null;
  users: User[];
  packages: Package[];
  orders: Order[];
  logs: BalanceLog[];
  toasts: Toast[];
  telegramEnabled: boolean;
  telegramChatId: string;
  sidebarOpen: boolean;
  lowBalanceThreshold: number;
  lowBalanceAlerts: LowBalanceAlert[];
}

interface StoreActions {
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addToast: (type: Toast['type'], message: string) => void;
  // admin
  createReseller: (data: { username: string; name: string; password: string; initialBalance: number }) => void;
  updateReseller: (id: string, data: Partial<User & { password?: string }>) => void;
  deleteReseller: (id: string) => void;
  adjustBalance: (resellerId: string, amount: number, note: string) => void;
  createPackage: (data: Omit<Package, 'id' | 'created_at'>) => void;
  updatePackage: (id: string, data: Partial<Package>) => void;
  deletePackage: (id: string) => void;
  approveOrder: (orderId: string) => void;
  rejectOrder: (orderId: string, reason: string) => void;
  updateSettings: (chatId: string, enabled: boolean, threshold: number) => void;
  dismissAlert: (alertId: string) => void;
  dismissAllAlerts: () => void;
  // reseller
  createOrder: (data: { packageId: string; customerPhone?: string; customerWhatsapp?: string }) => boolean;
  // ui
  setSidebarOpen: (open: boolean) => void;
}

const StoreContext = createContext<(Store & StoreActions) | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(SEED_RESELLERS);
  const [packages, setPackages] = useState<Package[]>(SEED_PACKAGES);
  const [orders, setOrders] = useState<Order[]>(SEED_ORDERS);
  const [logs, setLogs] = useState<BalanceLog[]>(SEED_LOGS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [telegramChatId, setTelegramChatId] = useState('123456789');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(50);
  const [lowBalanceAlerts, setLowBalanceAlerts] = useState<LowBalanceAlert[]>([]);
  const toastRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = uuid();
    setToasts(prev => [...prev, { id, type, message }]);
    const t = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
    toastRef.current.push(t);
  }, []);

  // check if reseller crossed below threshold and fire alert
  const checkLowBalance = useCallback((resellerId: string, resellerName: string, newBalance: number, threshold: number) => {
    if (newBalance < threshold) {
      setLowBalanceAlerts(prev => {
        // avoid duplicate unseen alert for same reseller
        const existing = prev.find(a => a.reseller_id === resellerId && !a.seen);
        if (existing) return prev;
        const alert: LowBalanceAlert = {
          id: uuid(),
          reseller_id: resellerId,
          reseller_name: resellerName,
          balance: newBalance,
          threshold,
          seen: false,
          created_at: now(),
        };
        return [alert, ...prev];
      });
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username === 'alisaidarafat' && password === 'alisaidarafat@7') {
      const admin: User = { id: 'admin1', username: 'alisaidarafat', name: 'علي سعيد عرفات', role: 'admin', active: true, created_at: now() };
      setCurrentUser(admin);
      return true;
    }
    const reseller = users.find(u => u.username === username && u.active);
    if (reseller && password === username + '123') {
      setCurrentUser(reseller);
      return true;
    }
    return false;
  };

  const logout = () => setCurrentUser(null);

  const createReseller = (data: { username: string; name: string; password: string; initialBalance: number }) => {
    const id = uuid();
    const newUser: User = { id, username: data.username, name: data.name, role: 'reseller', balance: data.initialBalance, active: true, created_at: now() };
    setUsers(prev => [...prev, newUser]);
    if (data.initialBalance > 0) {
      setLogs(prev => [...prev, { id: uuid(), reseller_id: id, reseller_name: data.name, amount: data.initialBalance, type: 'topup', note: 'رصيد أولي عند الإنشاء', created_at: now() }]);
    }
    addToast('success', `تم إنشاء حساب ${data.name} بنجاح`);
  };

  const updateReseller = (id: string, data: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    addToast('success', 'تم تحديث بيانات الموزع');
  };

  const deleteReseller = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    addToast('info', 'تم حذف الموزع');
  };

  const adjustBalance = (resellerId: string, amount: number, note: string) => {
    const reseller = users.find(u => u.id === resellerId);
    const newBalance = (reseller?.balance || 0) + amount;
    setUsers(prev => prev.map(u => u.id === resellerId ? { ...u, balance: newBalance } : u));
    setLogs(prev => [...prev, {
      id: uuid(), reseller_id: resellerId,
      reseller_name: reseller?.name || '',
      amount, type: amount > 0 ? 'topup' : 'deduct',
      note, created_at: now()
    }]);
    // clear unseen alerts for this reseller if topped up above threshold
    if (amount > 0 && newBalance >= lowBalanceThreshold) {
      setLowBalanceAlerts(prev => prev.filter(a => a.reseller_id !== resellerId || a.seen));
    }
    // fire alert if deduction brings below threshold
    if (amount < 0 && reseller) {
      checkLowBalance(resellerId, reseller.name, newBalance, lowBalanceThreshold);
      if (newBalance < lowBalanceThreshold) {
        setTimeout(() => addToast('error', `⚠️ تحذير: رصيد ${reseller.name} انخفض إلى ${fmt(newBalance)}`), 300);
      }
    }
    addToast('success', amount > 0 ? `تم شحن ${fmt(amount)} للموزع` : `تم خصم ${fmt(Math.abs(amount))} من الموزع`);
  };

  const createPackage = (data: Omit<Package, 'id' | 'created_at'>) => {
    setPackages(prev => [...prev, { ...data, id: uuid(), created_at: now() }]);
    addToast('success', 'تم إضافة الحزمة بنجاح');
  };

  const updatePackage = (id: string, data: Partial<Package>) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    addToast('success', 'تم تحديث الحزمة');
  };

  const deletePackage = (id: string) => {
    setPackages(prev => prev.filter(p => p.id !== id));
    addToast('info', 'تم حذف الحزمة');
  };

  const approveOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'success', updated_at: now() } : o));
    addToast('success', 'تم تنفيذ الطلب بنجاح ✓');
    // notify reseller via simulated WS
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const reseller = users.find(u => u.id === order.reseller_id);
      if (reseller) addToast('info', `إشعار تليجرام: تم إبلاغ ${reseller.name}`);
    }
  };

  const rejectOrder = (orderId: string, reason: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'failed', fail_reason: reason, updated_at: now() } : o));
    // refund
    setUsers(prev => prev.map(u => u.id === order.reseller_id ? { ...u, balance: (u.balance || 0) + order.price } : u));
    setLogs(prev => [...prev, { id: uuid(), reseller_id: order.reseller_id, reseller_name: order.reseller_name, amount: order.price, type: 'refund', order_id: orderId, note: `استرداد: ${reason}`, created_at: now() }]);
    addToast('error', 'تم رفض الطلب واسترداد الرصيد');
  };

  const updateSettings = (chatId: string, enabled: boolean) => {
    setTelegramChatId(chatId);
    setTelegramEnabled(enabled);
    addToast('success', 'تم حفظ إعدادات تليجرام');
  };

  const createOrder = (data: { packageId: string; customerPhone?: string; customerWhatsapp?: string }): boolean => {
    if (!currentUser || currentUser.role !== 'reseller') return false;
    const pkg = packages.find(p => p.id === data.packageId && p.active);
    if (!pkg) { addToast('error', 'الحزمة غير متوفرة'); return false; }
    const reseller = users.find(u => u.id === currentUser.id);
    if (!reseller || (reseller.balance || 0) < pkg.price) {
      addToast('error', 'رصيدك غير كافٍ لهذه الحزمة');
      return false;
    }
    // atomic deduct
    const newBalance = (reseller.balance || 0) - pkg.price;
    setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, balance: newBalance } : u));
    // update currentUser balance too
    setCurrentUser(prev => prev ? { ...prev, balance: newBalance } : prev);

    const orderId = uuid();
    const newOrder: Order = {
      id: orderId,
      reseller_id: currentUser.id,
      reseller_name: currentUser.name,
      reseller_username: currentUser.username,
      customer_phone: data.customerPhone,
      customer_whatsapp: data.customerWhatsapp,
      package_id: pkg.id,
      package_name: pkg.name,
      package_type: pkg.type,
      package_duration: pkg.duration,
      package_company: pkg.company,
      price: pkg.price,
      status: 'pending',
      created_at: now(),
      updated_at: now(),
    };
    setOrders(prev => [newOrder, ...prev]);
    setLogs(prev => [...prev, { id: uuid(), reseller_id: currentUser.id, reseller_name: currentUser.name, amount: -pkg.price, type: 'order', order_id: orderId, created_at: now() }]);
    addToast('success', `تم إرسال الطلب بنجاح — ${pkg.name}`);
    // check low balance after order deduction
    checkLowBalance(currentUser.id, currentUser.name, newBalance, lowBalanceThreshold);

    // simulate admin notification
    setTimeout(() => addToast('info', '📬 تم إرسال إشعار تليجرام للمشرف'), 600);
    return true;
  };

  // sync reseller balance from users store
  useEffect(() => {
    if (currentUser?.role === 'reseller') {
      const updated = users.find(u => u.id === currentUser.id);
      if (updated && updated.balance !== currentUser.balance) {
        setCurrentUser(prev => prev ? { ...prev, balance: updated.balance } : prev);
      }
    }
  }, [users]);

  return (
    <StoreContext.Provider value={{
      currentUser, users, packages, orders, logs, toasts,
      telegramEnabled, telegramChatId, sidebarOpen,
      login, logout, addToast,
      createReseller, updateReseller, deleteReseller, adjustBalance,
      createPackage, updatePackage, deletePackage,
      approveOrder, rejectOrder, updateSettings,
      createOrder, setSidebarOpen,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
