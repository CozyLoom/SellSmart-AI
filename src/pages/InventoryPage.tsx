import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Package, Edit2, Trash2, ArrowUpDown, AlertTriangle, CheckCircle2, FolderPlus, X, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Category, InventoryMovement, Product, SupportedCurrency } from '../types';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StudioImage } from '../components/StudioImage';

export const InventoryPage: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();
  const currency = (business?.currency || 'USD') as SupportedCurrency;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'products' | 'movements' | 'categories'>('products');

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'in'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [stockQty, setStockQty] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');

  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('10');
  const [adjustReason, setAdjustReason] = useState('Supplier restock');

  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, cats, movs] = await Promise.all([
        apiRequest<Product[]>('/api/products'),
        apiRequest<Category[]>('/api/categories'),
        apiRequest<InventoryMovement[]>('/api/inventory/movements'),
      ]);
      setProducts(prods);
      setCategories(cats);
      setMovements(movs);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load inventory.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const costValue = products.reduce((s, p) => s + p.purchasePrice * p.stockQty, 0);
    const retailValue = products.reduce((s, p) => s + p.sellingPrice * p.stockQty, 0);
    const lowStock = products.filter((p) => p.stockQty > 0 && p.stockQty <= p.lowStockThreshold).length;
    const outOfStock = products.filter((p) => p.stockQty === 0).length;
    return { total: products.length, costValue, retailValue, lowStock, outOfStock };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = search.trim().toLowerCase();
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      if (catFilter !== 'all' && (p.categoryId || 'none') !== catFilter) return false;
      if (stockFilter === 'out' && p.stockQty !== 0) return false;
      if (stockFilter === 'low' && !(p.stockQty > 0 && p.stockQty <= p.lowStockThreshold)) return false;
      if (stockFilter === 'in' && p.stockQty <= p.lowStockThreshold) return false;
      return true;
    });
  }, [products, search, catFilter, stockFilter]);

  const openCreateModal = () => {
    setEditing(null);
    setName('');
    setSku('');
    setCategoryId(categories[0]?.id || '');
    setPurchasePrice('');
    setSellingPrice('');
    setStockQty('0');
    setLowStockThreshold('5');
    setImageUrl('');
    setDescription('');
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setSku(p.sku);
    setCategoryId(p.categoryId || '');
    setPurchasePrice(String(p.purchasePrice));
    setSellingPrice(String(p.sellingPrice));
    setStockQty(String(p.stockQty));
    setLowStockThreshold(String(p.lowStockThreshold));
    setImageUrl(p.imageUrl);
    setDescription(p.description);
    setModalOpen(true);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid PNG, JPG, or WebP image file.', 'error');
      return;
    }
    if (file.size > 1_800_000) {
      showToast('Image file must be under 1.8 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        sku,
        categoryId: categoryId || null,
        purchasePrice: Number(purchasePrice || 0),
        sellingPrice: Number(sellingPrice || 0),
        stockQty: Number(stockQty || 0),
        lowStockThreshold: Number(lowStockThreshold || 5),
        imageUrl,
        description,
      };
      if (editing) {
        await apiRequest(`/api/products/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('Product updated.', 'success');
      } else {
        await apiRequest('/api/products', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Product added to inventory.', 'success');
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save product.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    setSaving(true);
    try {
      await apiRequest(`/api/products/${adjustTarget.id}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify({ delta: Number(adjustDelta), reason: adjustReason }),
      });
      showToast('Stock level adjusted.', 'success');
      setAdjustTarget(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to adjust stock.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/products/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Product removed.', 'success');
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete product.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim(), description: newCatDesc.trim() }),
      });
      setNewCatName('');
      setNewCatDesc('');
      showToast('Category created.', 'success');
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create category.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Active SKUs</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatNumber(stats.total)}
          </p>
        </div>
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Inventory Cost Value</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
            {formatCurrency(stats.costValue, currency)}
          </p>
        </div>
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Potential Retail Value</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#287BFF] dark:text-[#22D3EE] truncate">
            {formatCurrency(stats.retailValue, currency)}
          </p>
        </div>
        <div className="surface-panel-interactive p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Stock Alerts</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-500">
            {stats.lowStock + stats.outOfStock}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">
            {stats.lowStock} low · {stats.outOfStock} out of stock
          </p>
        </div>
      </div>

      {/* Tabs & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="surface-well flex items-center gap-1 p-1">
          {(
            [
              ['products', 'Product Catalog'],
              ['movements', 'Stock History'],
              ['categories', 'Categories'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                tab === id
                  ? 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-white shadow-[0_6px_16px_-6px_rgba(40,123,255,0.6)]'
                  : 'text-slate-600 dark:text-[#A7B4C7] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-xs sm:text-sm font-semibold text-white flex items-center gap-2 transition-all whitespace-nowrap shadow-[0_8px_20px_-6px_rgba(40,123,255,0.55)]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {tab === 'products' && (
        <div className="surface-panel overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-white/[0.07] flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name or SKU..."
                className="input-field min-h-[40px] pl-10 pr-3"
              />
            </div>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="input-field !w-auto min-h-[40px] px-3 text-xs"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
              className="input-field !w-auto min-h-[40px] px-3 text-xs"
            >
              <option value="all">All Stock Levels</option>
              <option value="in">Healthy Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-[#A7B4C7]">Loading inventory...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-10 h-10 mx-auto text-slate-400 dark:text-[#A7B4C7] mb-3" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">No matching products found</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">
                Add products with purchase cost and selling price to track live stock value and margins.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-xs font-semibold text-white"
              >
                Add First Product
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 dark:bg-[#0A172B]/90 border-b border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#A7B4C7]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Product</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium text-right">Cost</th>
                    <th className="py-3 px-4 font-medium text-right">Selling Price</th>
                    <th className="py-3 px-4 font-medium text-right">Stock</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {filteredProducts.map((p) => {
                    const isOut = p.stockQty === 0;
                    const isLow = p.stockQty > 0 && p.stockQty <= p.lowStockThreshold;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.025] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              <StudioImage
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200/90 dark:border-white/[0.1] shrink-0 shadow-sm"
                                fallbackClassName="w-12 h-12 rounded-xl border border-slate-200/90 dark:border-white/[0.1] bg-slate-100 dark:bg-[#0A172B] shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl surface-well flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 dark:text-white truncate max-w-[220px]">{p.name}</p>
                              <p className="text-xs text-slate-500 dark:text-[#A7B4C7] font-mono">{p.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#A7B4C7]">
                          {p.categoryName || 'Uncategorized'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-[#A7B4C7]">
                          {formatCurrency(p.purchasePrice, currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(p.sellingPrice, currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          {p.stockQty}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 text-rose-500 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" /> Out of stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" /> Low stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> In stock
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustTarget(p);
                                setAdjustDelta('10');
                                setAdjustReason('Supplier restock');
                              }}
                              title="Adjust stock"
                              className="p-2 rounded-lg text-slate-500 dark:text-[#A7B4C7] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-[#287BFF]"
                            >
                              <ArrowUpDown className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              title="Edit product"
                              className="p-2 rounded-lg text-slate-500 dark:text-[#A7B4C7] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              title="Delete product"
                              className="p-2 rounded-lg text-slate-500 dark:text-[#A7B4C7] hover:bg-rose-500/10 hover:text-rose-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'movements' && (
        <div className="surface-panel overflow-hidden">
          {movements.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 dark:text-[#A7B4C7]">
              No stock movements recorded yet. Every sale, order fulfillment, and restock is logged automatically.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 dark:bg-[#0A172B]/90 border-b border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#A7B4C7]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Product</th>
                    <th className="py-3 px-4 font-medium">Type</th>
                    <th className="py-3 px-4 font-medium text-right">Change</th>
                    <th className="py-3 px-4 font-medium text-right">New Qty</th>
                    <th className="py-3 px-4 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.025] transition-colors">
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">
                        {formatDate(m.createdAt, business?.timezone)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{m.productName}</td>
                      <td className="py-3 px-4 text-xs capitalize text-slate-600 dark:text-[#A7B4C7]">
                        {m.movementType.replace('_', ' ')}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                          m.quantityChange > 0 ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                        {m.newQty}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#A7B4C7]">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleCreateCategory}
            className="surface-panel p-5 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-white/[0.07]">
              <FolderPlus className="w-4 h-4 text-[#287BFF] dark:text-[#22D3EE]" />
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">New Category</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Name *</label>
              <input
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g., Footwear"
                className="input-field min-h-[42px] px-3"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Description</label>
              <input
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Optional category notes"
                className="input-field min-h-[42px] px-3"
              />
            </div>
            <button
              type="submit"
              className="w-full min-h-[42px] rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-xs font-semibold text-white"
            >
              Create Category
            </button>
          </form>

          <div className="lg:col-span-2 surface-panel divide-y divide-slate-100 dark:divide-white/[0.06]">
            {categories.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-[#A7B4C7]">
                No custom categories yet. Create categories to organize your catalog and sales analytics.
              </div>
            ) : (
              categories.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</p>
                    <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">{c.description || 'No description'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      apiRequest(`/api/categories/${c.id}`, { method: 'DELETE' }).then(() => {
                        showToast('Category deleted.', 'info');
                        void loadData();
                      })
                    }
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto surface-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-4">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                {editing ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Product Name *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Classic Denim Jacket"
                    className="input-field min-h-[42px] px-3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">SKU / Code</label>
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Auto-generated if empty"
                    className="input-field min-h-[42px] px-3 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="input-field min-h-[42px] px-3"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">
                    Purchase Cost ({currency}) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="input-field min-h-[42px] px-3 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">
                    Selling Price ({currency}) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="input-field min-h-[42px] px-3 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Stock Quantity *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="input-field min-h-[42px] px-3 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Low-Stock Alert Threshold</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="input-field min-h-[42px] px-3 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Product Image</label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="surface-well min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-white cursor-pointer flex items-center gap-2 hover:border-[#287BFF]/60">
                    <Upload className="w-4 h-4" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field p-3"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="surface-well min-h-[42px] px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#A7B4C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md surface-panel p-6 shadow-2xl">
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Adjust Stock · {adjustTarget.name}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">
              Current stock: <strong className="font-mono">{adjustTarget.stockQty}</strong> units. Use positive numbers to restock or negative numbers to deduct damaged/lost items.
            </p>
            <form onSubmit={handleAdjustStock} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Quantity Change</label>
                <input
                  required
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  className="input-field min-h-[42px] px-3 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Reason</label>
                <input
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="input-field min-h-[42px] px-3"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="surface-well min-h-[40px] px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#A7B4C7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-sm font-semibold text-white"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Product?"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? Existing sales history will remain intact, but the SKU will be removed from inventory.`}
        confirmLabel="Delete Product"
        busy={deleting}
        onConfirm={() => void handleDeleteProduct()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
