import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Download, Trash2, Edit2, X, Receipt, BadgeDollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Customer, Expense, Product, Sale, SupportedCurrency } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { downloadCsv } from '../utils/export';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const SalesPage: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();
  const currency = (business?.currency || 'USD') as SupportedCurrency;

  const [tab, setTab] = useState<'sales' | 'expenses'>('sales');
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Record Sale modal
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [discount, setDiscount] = useState('0');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [lineItems, setLineItems] = useState<{ productId: string; quantity: number; unitPrice: number }[]>([]);

  // Edit sale modal
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [editPaid, setEditPaid] = useState('0');
  const [editMethod, setEditMethod] = useState('Cash');
  const [editNotes, setEditNotes] = useState('');

  // Add expense modal
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expCategory, setExpCategory] = useState('Marketing');
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expNotes, setExpNotes] = useState('');

  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [deleteExpTarget, setDeleteExpTarget] = useState<Expense | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e, p, c] = await Promise.all([
        apiRequest<Sale[]>('/api/sales'),
        apiRequest<Expense[]>('/api/expenses'),
        apiRequest<Product[]>('/api/products'),
        apiRequest<Customer[]>('/api/customers'),
      ]);
      setSales(s);
      setExpenses(e);
      setProducts(p);
      setCustomers(c);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load sales records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(() => {
    const grossRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const collected = sales.reduce((sum, s) => sum + s.amountPaid, 0);
    const cogs = sales.reduce((sum, s) => sum + s.totalCogs, 0);
    const grossProfit = sales.reduce((sum, s) => sum + s.grossProfit, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    return {
      grossRevenue,
      collected,
      outstanding: Math.max(0, grossRevenue - collected),
      cogs,
      grossProfit,
      totalExpenses,
      netProfit,
    };
  }, [sales, expenses]);

  const draftSubtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [lineItems]);
  const draftTotal = Math.max(0, draftSubtotal - Number(discount || 0));

  const openNewSaleModal = () => {
    setIdempotencyKey(`sale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    setSaleDate(new Date().toISOString().slice(0, 10));
    setCustomerId('');
    setPaymentMethod('Cash');
    setDiscount('0');
    setAmountPaid('');
    setNotes('');
    const firstAvailable = products.find((p) => p.stockQty > 0);
    setLineItems(
      firstAvailable
        ? [{ productId: firstAvailable.id, quantity: 1, unitPrice: firstAvailable.sellingPrice }]
        : []
    );
    setSaleModalOpen(true);
  };

  const addLineItem = () => {
    const first = products.find((p) => p.stockQty > 0) || products[0];
    if (!first) return;
    setLineItems((prev) => [...prev, { productId: first.id, quantity: 1, unitPrice: first.sellingPrice }]);
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      showToast('Add at least one product to record a sale.', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          customerId: customerId || null,
          items: lineItems,
          discount: Number(discount || 0),
          taxRate: business?.taxRate || 0,
          amountPaid: amountPaid === '' ? draftTotal : Number(amountPaid),
          paymentMethod,
          notes,
          saleDate,
          idempotencyKey,
        }),
      });
      showToast('Sale recorded and inventory updated.', 'success');
      setSaleModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record sale.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSaleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSale) return;
    setSaving(true);
    try {
      await apiRequest(`/api/sales/${editSale.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          amountPaid: Number(editPaid || 0),
          paymentMethod: editMethod,
          notes: editNotes,
        }),
      });
      showToast('Transaction updated.', 'success');
      setEditSale(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update transaction.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVoidSale = async () => {
    if (!voidTarget) return;
    try {
      await apiRequest(`/api/sales/${voidTarget.id}`, { method: 'DELETE' });
      showToast('Sale voided and stock restored.', 'success');
      setVoidTarget(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not void sale.', 'error');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category: expCategory,
          title: expTitle,
          amount: Number(expAmount),
          expenseDate: expDate,
          notes: expNotes,
        }),
      });
      showToast('Business expense logged.', 'success');
      setExpModalOpen(false);
      setExpTitle('');
      setExpAmount('');
      setExpNotes('');
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to log expense.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      'sellsmart-sales-report.csv',
      ['Sale Number', 'Date', 'Customer', 'Subtotal', 'Discount', 'Total', 'Paid', 'Status', 'COGS', 'Gross Profit', 'Payment Method'],
      sales.map((s) => [
        s.saleNumber,
        s.saleDate,
        s.customerName || 'Walk-in',
        s.subtotal,
        s.discount,
        s.totalAmount,
        s.amountPaid,
        s.paymentStatus,
        s.totalCogs,
        s.grossProfit,
        s.paymentMethod,
      ])
    );
    showToast('Sales report CSV exported.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Profit & Accounting Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Gross Revenue</p>
          <p className="mt-2 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
            {formatCurrency(totals.grossRevenue, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">
            Outstanding {formatCurrency(totals.outstanding, currency)}
          </p>
        </div>
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Cost of Goods Sold</p>
          <p className="mt-2 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
            {formatCurrency(totals.cogs, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">Qty sold × unit cost</p>
        </div>
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Gross Profit</p>
          <p className="mt-2 text-xl font-bold font-mono tabular-nums text-[#287BFF] dark:text-[#22D3EE] truncate">
            {formatCurrency(totals.grossProfit, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">Revenue − COGS</p>
        </div>
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Business Expenses</p>
          <p className="mt-2 text-xl font-bold font-mono tabular-nums text-amber-500 truncate">
            {formatCurrency(totals.totalExpenses, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">{expenses.length} recorded entries</p>
        </div>
        <div className="col-span-2 lg:col-span-1 surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Net Profit</p>
          <p
            className={`mt-2 text-xl font-bold font-mono tabular-nums truncate ${
              totals.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
            }`}
          >
            {formatCurrency(totals.netProfit, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">Gross profit − expenses</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="surface-well flex items-center gap-1 p-1">
          <button
            type="button"
            onClick={() => setTab('sales')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === 'sales'
                ? 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-white shadow-[0_6px_16px_-6px_rgba(40,123,255,0.6)]'
                : 'text-slate-600 dark:text-[#A7B4C7]'
            }`}
          >
            Sales Ledger ({sales.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('expenses')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === 'expenses'
                ? 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-white shadow-[0_6px_16px_-6px_rgba(40,123,255,0.6)]'
                : 'text-slate-600 dark:text-[#A7B4C7]'
            }`}
          >
            Expenses ({expenses.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={sales.length === 0}
            className="surface-well min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-white flex items-center gap-2 hover:border-[#287BFF]/50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setExpModalOpen(true)}
            className="surface-well min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-white flex items-center gap-2 hover:border-[#287BFF]/50"
          >
            <Receipt className="w-4 h-4 text-amber-500" />
            <span>Add Expense</span>
          </button>
          <button
            type="button"
            onClick={openNewSaleModal}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-xs font-semibold text-white flex items-center gap-2 shadow-[0_8px_20px_-6px_rgba(40,123,255,0.55)]"
          >
            <Plus className="w-4 h-4" />
            <span>Record Sale</span>
          </button>
        </div>
      </div>

      {tab === 'sales' ? (
        <div className="surface-panel overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-[#A7B4C7]">Loading sales...</div>
          ) : sales.length === 0 ? (
            <div className="p-12 text-center">
              <BadgeDollarSign className="w-10 h-10 mx-auto text-slate-400 dark:text-[#A7B4C7] mb-3" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">No sales recorded yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">
                Record a sale to automatically deduct inventory, compute COGS, and track gross profit.
              </p>
              <button
                type="button"
                onClick={openNewSaleModal}
                className="mt-4 min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-xs font-semibold text-white"
              >
                Record First Sale
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 dark:bg-[#0A172B]/90 border-b border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#A7B4C7]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Sale #</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Customer</th>
                    <th className="py-3 px-4 font-medium">Items</th>
                    <th className="py-3 px-4 font-medium text-right">Total</th>
                    <th className="py-3 px-4 font-medium text-right">Paid</th>
                    <th className="py-3 px-4 font-medium text-right">Gross Profit</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {sales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.025] transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                        {s.saleNumber}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">
                        {formatDate(s.saleDate, business?.timezone)}
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-white">{s.customerName}</td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">
                        {s.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(s.totalAmount, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                        <span
                          className={
                            s.paymentStatus === 'paid'
                              ? 'text-emerald-500'
                              : s.paymentStatus === 'partial'
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }
                        >
                          {formatCurrency(s.amountPaid, currency)} ({s.paymentStatus})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatCurrency(s.grossProfit, currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditSale(s);
                              setEditPaid(String(s.amountPaid));
                              setEditMethod(s.paymentMethod);
                              setEditNotes(s.notes);
                            }}
                            title="Update payment or notes"
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setVoidTarget(s)}
                            title="Void sale & restore stock"
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
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
      ) : (
        <div className="surface-panel overflow-hidden">
          {expenses.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 dark:text-[#A7B4C7]">
              No expenses recorded yet. Log rent, marketing, shipping, or payroll expenses to calculate true net profit.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 dark:bg-[#0A172B]/90 border-b border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#A7B4C7]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Title</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium text-right">Amount</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {expenses.map((ex) => (
                    <tr key={ex.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.025] transition-colors">
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">
                        {formatDate(ex.expenseDate, business?.timezone)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{ex.title}</td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">{ex.category}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-500">
                        {formatCurrency(ex.amount, currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteExpTarget(ex)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Sale Modal */}
      {saleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto surface-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-4">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Record New Sale</h3>
              <button type="button" onClick={() => setSaleModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordSale} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Sale Date</label>
                  <input
                    type="date"
                    required
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="input-field min-h-[40px] px-3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Customer</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="input-field min-h-[40px] px-3"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="input-field min-h-[40px] px-3"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Line Items</label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    disabled={products.length === 0}
                    className="text-xs font-semibold text-[#287BFF] dark:text-[#22D3EE] hover:underline disabled:opacity-50"
                  >
                    + Add product line
                  </button>
                </div>

                {products.length === 0 ? (
                  <p className="text-xs text-amber-500">Add products in Products & Inventory before recording product sales.</p>
                ) : (
                  lineItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const p = products.find((x) => x.id === e.target.value);
                          setLineItems((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, productId: e.target.value, unitPrice: p?.sellingPrice || 0 } : row
                            )
                          );
                        }}
                        className="input-field col-span-6 min-h-[40px] px-2.5 text-xs"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.stockQty <= 0}>
                            {p.name} ({p.stockQty} in stock)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          setLineItems((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, quantity: Math.max(1, Number(e.target.value)) } : row))
                          )
                        }
                        className="input-field col-span-2 min-h-[40px] px-2.5 text-xs font-mono"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          setLineItems((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, unitPrice: Math.max(0, Number(e.target.value)) } : row))
                          )
                        }
                        className="input-field col-span-3 min-h-[40px] px-2.5 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 flex justify-center text-slate-400 hover:text-rose-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">
                    Discount ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="input-field min-h-[40px] px-3 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">
                    Amount Collected ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={String(draftTotal)}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="input-field min-h-[40px] px-3 font-mono"
                  />
                </div>
                <div className="surface-well p-3 flex flex-col justify-center">
                  <span className="text-[11px] text-slate-500 dark:text-[#A7B4C7]">Sale Total</span>
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(draftTotal, currency)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional receipt notes"
                  className="input-field min-h-[40px] px-3"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSaleModalOpen(false)}
                  className="surface-well min-h-[42px] px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#A7B4C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || lineItems.length === 0}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Recording...' : 'Complete Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Sale Payment Modal */}
      {editSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md surface-panel p-6 shadow-2xl">
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Update Transaction · {editSale.saleNumber}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">
              Total amount: <strong className="font-mono">{formatCurrency(editSale.totalAmount, currency)}</strong>
            </p>
            <form onSubmit={handleSaveSaleEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Amount Paid</label>
                <input
                  type="number"
                  min="0"
                  max={editSale.totalAmount}
                  step="0.01"
                  value={editPaid}
                  onChange={(e) => setEditPaid(e.target.value)}
                  className="input-field min-h-[42px] px-3 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Payment Method</label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  className="input-field min-h-[42px] px-3"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Notes</label>
                <input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="input-field min-h-[42px] px-3"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditSale(null)}
                  className="surface-well min-h-[40px] px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#A7B4C7]"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-sm font-semibold text-white">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {expModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md surface-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">Log Business Expense</h3>
              <button type="button" onClick={() => setExpModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Expense Title *</label>
                <input
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="e.g., Facebook Ad Spend"
                  className="input-field min-h-[42px] px-3"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="input-field min-h-[42px] px-3"
                  >
                    <option value="Marketing">Marketing</option>
                    <option value="Shipping & Logistics">Shipping & Logistics</option>
                    <option value="Operations">Operations</option>
                    <option value="Rent & Utilities">Rent & Utilities</option>
                    <option value="Payroll">Payroll</option>
                    <option value="Software & Tools">Software & Tools</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">
                    Amount ({currency}) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="input-field min-h-[42px] px-3 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="input-field min-h-[42px] px-3"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExpModalOpen(false)}
                  className="surface-well min-h-[40px] px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#A7B4C7]"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-sm font-semibold text-white">
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(voidTarget)}
        title="Void Sale Transaction?"
        description={`Voiding ${voidTarget?.saleNumber} will remove the sale record and automatically restore deducted stock quantities back into inventory.`}
        confirmLabel="Void Sale"
        onConfirm={() => void handleVoidSale()}
        onCancel={() => setVoidTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteExpTarget)}
        title="Delete Expense?"
        description={`Remove "${deleteExpTarget?.title}" from your business expenses?`}
        confirmLabel="Delete Expense"
        onConfirm={() => {
          if (!deleteExpTarget) return;
          apiRequest(`/api/expenses/${deleteExpTarget.id}`, { method: 'DELETE' }).then(() => {
            showToast('Expense deleted.', 'success');
            setDeleteExpTarget(null);
            void loadData();
          });
        }}
        onCancel={() => setDeleteExpTarget(null)}
      />
    </div>
  );
};
