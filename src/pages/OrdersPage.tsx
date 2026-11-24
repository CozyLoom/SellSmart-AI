import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, ShoppingBag, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Customer, Order, OrderStatus, Product, SupportedCurrency } from '../types';
import { formatCurrency, formatDate } from '../utils/format';

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'dispatched', 'completed', 'cancelled'];

export const OrdersPage: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();
  const currency = (business?.currency || 'USD') as SupportedCurrency;

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [initialStatus, setInitialStatus] = useState<OrderStatus>('pending');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: number; unitPrice: number }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [o, p, c] = await Promise.all([
        apiRequest<Order[]>('/api/orders'),
        apiRequest<Product[]>('/api/products'),
        apiRequest<Customer[]>('/api/customers'),
      ]);
      setOrders(o);
      setProducts(p);
      setCustomers(c);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load orders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (q && !o.orderNumber.toLowerCase().includes(q) && !(o.customerName || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, statusFilter, search]);

  const openModal = () => {
    setCustomerId('');
    setInitialStatus('pending');
    setNotes('');
    const first = products[0];
    setItems(first ? [{ productId: first.id, quantity: 1, unitPrice: first.sellingPrice }] : []);
    setModalOpen(true);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setSaving(true);
    try {
      await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: customerId || null,
          status: initialStatus,
          items,
          notes,
        }),
      });
      showToast('Order created.', 'success');
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create order.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      await apiRequest(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast(`Order marked ${nextStatus}. Inventory synced cleanly.`, 'success');
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update order status.', 'error');
    }
  };

  const statusColor = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-500';
      case 'dispatched':
      case 'processing':
      case 'confirmed':
        return 'text-[#22D3EE]';
      case 'cancelled':
        return 'text-rose-500';
      default:
        return 'text-amber-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="surface-well flex flex-wrap items-center gap-1 p-1">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-white shadow-[0_6px_16px_-6px_rgba(40,123,255,0.6)]'
                : 'text-slate-600 dark:text-[#A7B4C7]'
            }`}
          >
            All ({orders.length})
          </button>
          {ORDER_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                statusFilter === st
                  ? 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-white shadow-[0_6px_16px_-6px_rgba(40,123,255,0.6)]'
                  : 'text-slate-600 dark:text-[#A7B4C7]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openModal}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-xs sm:text-sm font-semibold text-white flex items-center gap-2 whitespace-nowrap shadow-[0_8px_20px_-6px_rgba(40,123,255,0.55)]"
        >
          <Plus className="w-4 h-4" />
          <span>Create Order</span>
        </button>
      </div>

      <div className="surface-panel overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-white/[0.07]">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order number or customer..."
              className="input-field min-h-[40px] pl-10 pr-3"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-[#A7B4C7]">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="w-10 h-10 mx-auto text-slate-400 dark:text-[#A7B4C7] mb-3" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">No orders found</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">
              Create customer orders and track fulfillment stages without double-deducting inventory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 dark:bg-[#0A172B]/90 border-b border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#A7B4C7]">
                <tr>
                  <th className="py-3 px-4 font-medium">Order #</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Customer</th>
                  <th className="py-3 px-4 font-medium">Items</th>
                  <th className="py-3 px-4 font-medium text-right">Total</th>
                  <th className="py-3 px-4 font-medium">Stock Sync</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.025] transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      {o.orderNumber}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">
                      {formatDate(o.orderDate, business?.timezone)}
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-white">
                      <p className="font-medium">{o.customerName}</p>
                      {o.customerPhone && <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">{o.customerPhone}</p>}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">
                      {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(o.totalAmount, currency)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">
                      {o.inventoryDeducted ? 'Deducted once' : 'Reserved / Not deducted'}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={o.status}
                        onChange={(e) => void handleStatusChange(o.id, e.target.value as OrderStatus)}
                        className={`input-field !w-auto min-h-[36px] px-2.5 text-xs font-semibold capitalize ${statusColor(
                          o.status
                        )}`}
                      >
                        {ORDER_STATUSES.map((st) => (
                          <option key={st} value={st} className="text-slate-900 dark:text-white">
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto surface-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-4">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Create Customer Order</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateOrder} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Customer</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="input-field min-h-[42px] px-3"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Initial Status</label>
                  <select
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value as OrderStatus)}
                    className="input-field min-h-[42px] px-3 capitalize"
                  >
                    {ORDER_STATUSES.filter((s) => s !== 'cancelled').map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Order Items</label>
                  <button
                    type="button"
                    onClick={() => {
                      const first = products[0];
                      if (first) setItems((p) => [...p, { productId: first.id, quantity: 1, unitPrice: first.sellingPrice }]);
                    }}
                    className="text-xs font-semibold text-[#287BFF] dark:text-[#22D3EE]"
                  >
                    + Add product
                  </button>
                </div>

                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <select
                      value={it.productId}
                      onChange={(e) => {
                        const prod = products.find((p) => p.id === e.target.value);
                        setItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, productId: e.target.value, unitPrice: prod?.sellingPrice || 0 } : row
                          )
                        );
                      }}
                      className="input-field col-span-7 min-h-[40px] px-2.5 text-xs"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.stockQty} available)
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, quantity: Math.max(1, Number(e.target.value)) } : row))
                        )
                      }
                      className="input-field col-span-2 min-h-[40px] px-2 text-xs font-mono"
                    />
                    <div className="col-span-2 text-right font-mono text-xs text-slate-900 dark:text-white">
                      {formatCurrency(it.quantity * it.unitPrice, currency)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="col-span-1 flex justify-center text-slate-400 hover:text-rose-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Delivery / Order Notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field min-h-[42px] px-3"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="surface-well min-h-[40px] px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#A7B4C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || items.length === 0}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
