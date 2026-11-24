import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Users, Edit2, Trash2, X, Repeat } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Customer, SupportedCurrency } from '../types';
import { CURRENCY_CONFIG, formatCurrency, formatDate } from '../utils/format';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const CustomersPage: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();
  const currency = (business?.currency || 'USD') as SupportedCurrency;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [selectedProfile, setSelectedProfile] = useState<Customer | null>(null);
  const [history, setHistory] = useState<{ sales: Record<string, unknown>[]; orders: Record<string, unknown>[] } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiRequest<Customer[]>('/api/customers');
      setCustomers(list);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load customers.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const repeatCount = useMemo(() => customers.filter((c) => c.orderCount > 1).length, [customers]);

  const openModal = (cust?: Customer) => {
    if (cust) {
      setEditing(cust);
      setName(cust.name);
      setPhone(cust.phone);
      setEmail(cust.email);
      setAddress(cust.address);
      setNotes(cust.notes);
    } else {
      setEditing(null);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, phone, email, address, notes };
      if (editing) {
        await apiRequest(`/api/customers/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('Customer updated.', 'success');
      } else {
        await apiRequest('/api/customers', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Customer added.', 'success');
      }
      setModalOpen(false);
      await loadCustomers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save customer.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openProfile = async (cust: Customer) => {
    setSelectedProfile(cust);
    setHistory(null);
    try {
      const h = await apiRequest<{ sales: Record<string, unknown>[]; orders: Record<string, unknown>[] }>(
        `/api/customers/${cust.id}/history`
      );
      setHistory(h);
    } catch {
      setHistory({ sales: [], orders: [] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Total Customers</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {customers.length}
          </p>
        </div>
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Repeat Customers</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#287BFF] dark:text-[#22D3EE]">
            {repeatCount}
          </p>
        </div>
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Total Outstanding Receivables</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-500">
            {formatCurrency(
              customers.reduce((s, c) => s + c.outstandingBalance, 0),
              currency
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="input-field min-h-[42px] pl-10 pr-3"
          />
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-xs sm:text-sm font-semibold text-white flex items-center gap-2 shadow-[0_8px_20px_-6px_rgba(40,123,255,0.55)]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      <div className="surface-panel overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-[#A7B4C7]">Loading customers...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto text-slate-400 dark:text-[#A7B4C7] mb-3" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">No customers added yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">
              Store customer contact profiles to link sales, invoices, and repeat-purchase insights.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 dark:bg-[#0A172B]/90 border-b border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#A7B4C7]">
                <tr>
                  <th className="py-3 px-4 font-medium">Customer</th>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium text-right">Purchases</th>
                  <th className="py-3 px-4 font-medium text-right">Total Spent</th>
                  <th className="py-3 px-4 font-medium text-right">Outstanding</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => void openProfile(c)}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.025] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
                      {c.orderCount > 1 && (
                        <p className="text-xs text-[#287BFF] dark:text-[#22D3EE] inline-flex items-center gap-1 mt-0.5">
                          <Repeat className="w-3 h-3" /> Repeat customer
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">
                      <p>{c.phone || '—'}</p>
                      <p>{c.email || '—'}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                      {c.orderCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(c.totalPurchases, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-500">
                      {formatCurrency(c.outstandingBalance, currency)}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openModal(c)}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                          title="Edit customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                          title="Delete customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md surface-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-4">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                {editing ? 'Edit Customer' : 'Add Customer'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Full Name *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field min-h-[42px] px-3"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Phone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={CURRENCY_CONFIG[currency].phoneHint}
                    className="input-field min-h-[42px] px-3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field min-h-[42px] px-3"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Address</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input-field min-h-[42px] px-3"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Customer Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field p-3"
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
                <button type="submit" disabled={saving} className="min-h-[40px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-sm font-semibold text-white">
                  {saving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Profile Drawer */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#071426]/70 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full overflow-y-auto border-l border-slate-200/85 dark:border-white/[0.1] bg-white dark:bg-[#0A172B] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-white/[0.08] pb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">{selectedProfile.name}</h3>
                <p className="text-xs text-slate-500 dark:text-[#A7B4C7] mt-1">
                  {selectedProfile.phone || 'No phone'} · {selectedProfile.email || 'No email'}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedProfile(null)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="surface-well p-3.5">
                <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">Lifetime Value</p>
                <p className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(selectedProfile.totalPurchases, currency)}
                </p>
              </div>
              <div className="surface-well p-3.5">
                <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">Outstanding Balance</p>
                <p className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-500">
                  {formatCurrency(selectedProfile.outstandingBalance, currency)}
                </p>
              </div>
            </div>

            {selectedProfile.address && (
              <p className="mt-4 text-xs text-slate-600 dark:text-[#A7B4C7]">
                <strong className="text-slate-900 dark:text-white">Address:</strong> {selectedProfile.address}
              </p>
            )}
            {selectedProfile.notes && (
              <p className="mt-2 text-xs text-slate-600 dark:text-[#A7B4C7]">
                <strong className="text-slate-900 dark:text-white">Notes:</strong> {selectedProfile.notes}
              </p>
            )}

            <div className="mt-6">
              <h4 className="font-display font-semibold text-sm text-slate-900 dark:text-white mb-3">
                Purchase & Order History
              </h4>
              {!history ? (
                <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">Loading history...</p>
              ) : history.sales.length === 0 && history.orders.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">No previous purchases or orders yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {history.sales.map((s) => (
                    <div
                      key={String(s.id)}
                      className="surface-well p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          Sale {String(s.sale_number)}
                        </p>
                        <p className="text-slate-500 dark:text-[#A7B4C7]">
                          {formatDate(String(s.sale_date), business?.timezone)} · {String(s.payment_status)}
                        </p>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(Number(s.total_amount), currency)}
                      </span>
                    </div>
                  ))}
                  {history.orders.map((o) => (
                    <div
                      key={String(o.id)}
                      className="surface-well p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          Order {String(o.order_number)}
                        </p>
                        <p className="text-slate-500 dark:text-[#A7B4C7] capitalize">
                          {formatDate(String(o.order_date), business?.timezone)} · {String(o.status)}
                        </p>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(Number(o.total_amount), currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Customer?"
        description={`Delete "${deleteTarget?.name}" from your customer directory? Historical sales and orders will remain intact.`}
        confirmLabel="Delete Customer"
        onConfirm={() => {
          if (!deleteTarget) return;
          apiRequest(`/api/customers/${deleteTarget.id}`, { method: 'DELETE' }).then(() => {
            showToast('Customer removed.', 'success');
            setDeleteTarget(null);
            void loadCustomers();
          });
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
