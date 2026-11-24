import React, { useCallback, useEffect, useState } from 'react';
import { Plus, FileText, Download, Printer, Share2, Eye, Trash2, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Customer, Invoice, Product, SupportedCurrency } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { generateInvoicePdf } from '../utils/pdf';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StudioImage } from '../components/StudioImage';

export const InvoicesPage: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();
  const currency = (business?.currency || 'USD') as SupportedCurrency;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState(String(business?.taxRate || 0));
  const [amountPaid, setAmountPaid] = useState('0');
  const [notes, setNotes] = useState('Thank you for your business. Payment is due by the specified due date.');
  const [items, setItems] = useState<{ productId: string; description: string; quantity: number; unitPrice: number }[]>([
    { productId: '', description: '', quantity: 1, unitPrice: 0 },
  ]);

  const [previewInv, setPreviewInv] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, cust, prod] = await Promise.all([
        apiRequest<Invoice[]>('/api/invoices'),
        apiRequest<Customer[]>('/api/customers'),
        apiRequest<Product[]>('/api/products'),
      ]);
      setInvoices(inv);
      setCustomers(cust);
      setProducts(prod);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load invoices.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const draftSubtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const draftTaxable = Math.max(0, draftSubtotal - Number(discount || 0));
  const draftTax = (draftTaxable * Number(taxRate || 0)) / 100;
  const draftTotal = draftTaxable + draftTax;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((i) => i.description.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      showToast('Add at least one itemized line.', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId: customerId || null,
          invoiceDate,
          dueDate,
          discount: Number(discount || 0),
          taxRate: Number(taxRate || 0),
          amountPaid: Number(amountPaid || 0),
          notes,
          items: validItems.map((it) => ({
            productId: it.productId || null,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
        }),
      });
      showToast('Invoice generated.', 'success');
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create invoice.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (inv: Invoice) => {
    try {
      await apiRequest(`/api/invoices/${inv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ amountPaid: inv.totalAmount, paymentStatus: 'paid' }),
      });
      showToast(`Invoice ${inv.invoiceNumber} marked as paid.`, 'success');
      await loadData();
      if (previewInv?.id === inv.id) {
        setPreviewInv({ ...inv, amountPaid: inv.totalAmount, paymentStatus: 'paid' });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update invoice.', 'error');
    }
  };

  const handleShare = async (inv: Invoice) => {
    const summary = `Invoice ${inv.invoiceNumber} from ${business?.name || 'SellSmart'}\nCustomer: ${inv.customerName}\nTotal: ${formatCurrency(
      inv.totalAmount,
      currency
    )}\nDue: ${inv.dueDate}\nStatus: ${inv.paymentStatus.toUpperCase()}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Invoice ${inv.invoiceNumber}`, text: summary });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(summary);
    showToast('Invoice summary copied to clipboard for sharing.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">
            Generate tax-ready PDF invoices and payment receipts for local and international clients.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCustomerId('');
            setDiscount('0');
            setTaxRate(String(business?.taxRate || 0));
            setAmountPaid('0');
            setItems(
              products[0]
                ? [{ productId: products[0].id, description: products[0].name, quantity: 1, unitPrice: products[0].sellingPrice }]
                : [{ productId: '', description: '', quantity: 1, unitPrice: 0 }]
            );
            setModalOpen(true);
          }}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-xs sm:text-sm font-semibold text-white flex items-center gap-2 shadow-[0_8px_20px_-6px_rgba(40,123,255,0.55)]"
        >
          <Plus className="w-4 h-4" />
          <span>Create Invoice</span>
        </button>
      </div>

      <div className="surface-panel overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-[#A7B4C7]">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 mx-auto text-slate-400 dark:text-[#A7B4C7] mb-3" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">No invoices generated yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">
              Create your first invoice to download, print, or share a PDF document.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 dark:bg-[#0A172B]/90 border-b border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#A7B4C7]">
                <tr>
                  <th className="py-3 px-4 font-medium">Invoice #</th>
                  <th className="py-3 px-4 font-medium">Customer</th>
                  <th className="py-3 px-4 font-medium">Issued / Due</th>
                  <th className="py-3 px-4 font-medium text-right">Total</th>
                  <th className="py-3 px-4 font-medium text-right">Paid</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.025] transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-white">{inv.customerName}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">
                      {formatDate(inv.invoiceDate, business?.timezone)} · Due {formatDate(inv.dueDate, business?.timezone)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(inv.totalAmount, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-[#A7B4C7]">
                      {formatCurrency(inv.amountPaid, currency)}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold capitalize">
                      <span
                        className={
                          inv.paymentStatus === 'paid'
                            ? 'text-emerald-500'
                            : inv.paymentStatus === 'partial'
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewInv(inv)}
                          title="Preview invoice"
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {business && (
                          <>
                            <button
                              type="button"
                              onClick={() => generateInvoicePdf(inv, business, 'download')}
                              title="Download PDF"
                              className="p-2 rounded-lg text-slate-400 hover:text-[#287BFF] hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => generateInvoicePdf(inv, business, 'print')}
                              title="Print invoice"
                              className="p-2 rounded-lg text-slate-400 hover:text-[#22D3EE] hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleShare(inv)}
                          title="Share summary"
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        {inv.paymentStatus !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => void handleMarkPaid(inv)}
                            title="Mark fully paid"
                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(inv)}
                          title="Delete invoice"
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

      {/* Create Invoice Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto surface-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-4">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Generate Invoice</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="input-field min-h-[40px] px-3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="input-field min-h-[40px] px-3"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Line Items</label>
                  <button
                    type="button"
                    onClick={() => setItems((p) => [...p, { productId: '', description: '', quantity: 1, unitPrice: 0 }])}
                    className="text-xs font-semibold text-[#287BFF] dark:text-[#22D3EE]"
                  >
                    + Add line item
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
                            i === idx
                              ? {
                                  ...row,
                                  productId: e.target.value,
                                  description: prod ? prod.name : row.description,
                                  unitPrice: prod ? prod.sellingPrice : row.unitPrice,
                                }
                              : row
                          )
                        );
                      }}
                      className="input-field col-span-3 min-h-[40px] px-2 text-xs"
                    >
                      <option value="">Custom item</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input
                      required
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, description: e.target.value } : row))
                        )
                      }
                      className="input-field col-span-4 min-h-[40px] px-2.5 text-xs"
                    />
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
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.unitPrice}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, unitPrice: Math.max(0, Number(e.target.value)) } : row))
                        )
                      }
                      className="input-field col-span-2 min-h-[40px] px-2 text-xs font-mono"
                    />
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Discount</label>
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
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="input-field min-h-[40px] px-3 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Amount Paid</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="input-field min-h-[40px] px-3 font-mono"
                  />
                </div>
                <div className="surface-well p-3 flex flex-col justify-center">
                  <span className="text-[11px] text-slate-500 dark:text-[#A7B4C7]">Invoice Total</span>
                  <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(draftTotal, currency)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Payment Terms / Notes</label>
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
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Generating...' : 'Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {previewInv && business && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/[0.12] bg-white text-slate-900 p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-6 no-print">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => generateInvoicePdf(previewInv, business, 'download')}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => generateInvoicePdf(previewInv, business, 'print')}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => void handleShare(previewInv)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>
              <button type="button" onClick={() => setPreviewInv(null)} className="p-2 text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl bg-[#071426] border border-white/[0.1] text-white p-6 flex flex-wrap justify-between gap-4">
              <div className="flex items-center gap-3">
                {business.logoUrl && (
                  <StudioImage
                    src={business.logoUrl}
                    alt={business.name}
                    className="w-12 h-12 rounded-xl object-cover bg-white border border-white/20"
                    fallbackClassName="w-12 h-12 rounded-xl bg-[#12243D]"
                  />
                )}
                <div>
                  <h2 className="font-display font-bold text-xl">{business.name}</h2>
                  <p className="text-xs text-[#A7B4C7] mt-1">
                    {[business.address, business.phone, business.email].filter(Boolean).join(' · ') || business.country}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-[#22D3EE]">INVOICE</p>
                <p className="font-mono font-bold text-lg">{previewInv.invoiceNumber}</p>
                <p className="text-xs text-[#A7B4C7] capitalize mt-1">Status: {previewInv.paymentStatus}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-slate-500">BILL TO</p>
                <p className="text-sm font-bold text-slate-900 mt-1">{previewInv.customerName}</p>
                {previewInv.customerPhone && <p className="text-slate-600">{previewInv.customerPhone}</p>}
                {previewInv.customerEmail && <p className="text-slate-600">{previewInv.customerEmail}</p>}
                {previewInv.customerAddress && <p className="text-slate-600">{previewInv.customerAddress}</p>}
              </div>
              <div className="sm:text-right space-y-1 text-slate-600">
                <p>Issue Date: <strong>{formatDate(previewInv.invoiceDate, business.timezone)}</strong></p>
                <p>Due Date: <strong>{formatDate(previewInv.dueDate, business.timezone)}</strong></p>
                <p>Currency: <strong>{business.currency}</strong></p>
              </div>
            </div>

            <table className="w-full mt-6 text-left text-xs border-t border-slate-200">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5">Description</th>
                  <th className="py-2.5 text-right">Qty</th>
                  <th className="py-2.5 text-right">Unit Price</th>
                  <th className="py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewInv.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 font-medium">{it.description}</td>
                    <td className="py-2.5 text-right font-mono">{it.quantity}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(it.unitPrice, currency)}</td>
                    <td className="py-2.5 text-right font-mono font-semibold">{formatCurrency(it.lineTotal, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(previewInv.subtotal, currency)}</span>
                </div>
                {previewInv.discount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount</span>
                    <span className="font-mono">-{formatCurrency(previewInv.discount, currency)}</span>
                  </div>
                )}
                {previewInv.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({previewInv.taxRate}%)</span>
                    <span className="font-mono">{formatCurrency(previewInv.taxAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span className="font-mono">{formatCurrency(previewInv.totalAmount, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Amount Paid</span>
                  <span className="font-mono">{formatCurrency(previewInv.amountPaid, currency)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-[#287BFF]">
                  <span>Balance Due</span>
                  <span className="font-mono">
                    {formatCurrency(Math.max(0, previewInv.totalAmount - previewInv.amountPaid), currency)}
                  </span>
                </div>
              </div>
            </div>

            {previewInv.notes && (
              <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Notes</p>
                <p className="mt-1">{previewInv.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Invoice?"
        description={`Delete invoice ${deleteTarget?.invoiceNumber}? This action cannot be undone.`}
        confirmLabel="Delete Invoice"
        onConfirm={() => {
          if (!deleteTarget) return;
          apiRequest(`/api/invoices/${deleteTarget.id}`, { method: 'DELETE' }).then(() => {
            showToast('Invoice deleted.', 'success');
            setDeleteTarget(null);
            void loadData();
          });
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
