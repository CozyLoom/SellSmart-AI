import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, Copy, RefreshCw, Download, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { AIGeneration, Product, SupportedCurrency } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { StudioImage } from '../components/StudioImage';

const CONTENT_TYPES = [
  'Product description',
  'Social media caption',
  'Instagram advertisement',
  'TikTok video script',
  'WhatsApp promotional message',
  'Marketing campaign',
  'Product benefits',
  'Hashtags',
  'Sales announcement',
];

const PLATFORMS = ['Instagram', 'TikTok', 'WhatsApp', 'Facebook', 'Shopify / Online Store', 'Email'];
const TONES = ['Persuasive', 'Warm & Conversational', 'Luxury & Editorial', 'Bold & Direct', 'Informative'];
const STYLES = ['Professional', 'Luxury', 'Friendly', 'Persuasive', 'Creative', 'Urgent promotion'];

interface MarketingResult {
  headline: string;
  primaryCopy: string;
  variations: string[];
  hashtags: string[];
  callToAction: string;
  platformTip: string;
}

export const MarketingStudioPage: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();
  const currency = (business?.currency || 'USD') as SupportedCurrency;

  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<AIGeneration[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const [contentType, setContentType] = useState(CONTENT_TYPES[0]);
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState(business?.category || '');
  const [productPrice, setProductPrice] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [productFeatures, setProductFeatures] = useState('');
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [tone, setTone] = useState(TONES[0]);
  const [style, setStyle] = useState(STYLES[0]);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MarketingResult | null>(null);
  const [editableCopy, setEditableCopy] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [prods, hist] = await Promise.all([
        apiRequest<Product[]>('/api/products'),
        apiRequest<AIGeneration[]>('/api/ai/history'),
      ]);
      setProducts(prods);
      setHistory(hist.filter((h) => h.generationType !== 'advisor'));
    } catch {
      // Non-fatal on initial load
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setProductName(p.name);
      setProductCategory(p.categoryName || business?.category || '');
      setProductPrice(formatCurrency(p.sellingPrice, currency));
      setProductFeatures(p.description || '');
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!productName.trim()) {
      showToast('Enter a product name first.', 'error');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await apiRequest<{ id: string; result: MarketingResult }>('/api/ai/marketing', {
        method: 'POST',
        body: JSON.stringify({
          contentType,
          productName,
          productCategory,
          productPrice,
          targetAudience,
          productFeatures,
          platform,
          tone,
          style,
        }),
      });
      setResult(res.result);
      const composed = [
        res.result.headline,
        '',
        res.result.primaryCopy,
        '',
        res.result.callToAction,
        '',
        (res.result.hashtags || []).join(' '),
      ]
        .filter((line) => line !== undefined)
        .join('\n');
      setEditableCopy(composed);
      showToast('Marketing copy generated and saved to history.', 'success');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI service unavailable.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard.', 'success');
  };

  const handleExportTxt = () => {
    const content = editableCopy || result?.primaryCopy || '';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(productName || 'marketing').toLowerCase().replace(/\s+/g, '-')}-copy.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Studio Editorial Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/85 dark:border-white/[0.1] shadow-[0_18px_48px_-20px_rgba(7,20,38,0.55)]">
        <StudioImage
          src="/src/assets/images/studio_marketing_desk_1795511632445.jpg"
          alt="Editorial creative marketing studio flatlay"
          className="absolute inset-0 w-full h-full object-cover object-center"
          fallbackClassName="absolute inset-0 bg-[#0A172B]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071426]/95 via-[#071426]/82 to-[#071426]/35" />
        <div className="relative z-10 p-5 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#22D3EE]">
              Editorial Copy Engine · Gemini AI
            </p>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight mt-1">
              High-Converting Brand Campaigns in Seconds
            </h2>
            <p className="text-xs sm:text-sm text-[#A7B4C7] mt-1.5 leading-relaxed">
              Generate tailored product descriptions, TikTok scripts, WhatsApp broadcasts, and luxury launch copy grounded in your live catalog pricing.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-xl border border-white/[0.14] bg-[#071426]/70 backdrop-blur-md px-4 py-2.5 text-right">
              <p className="text-[11px] uppercase tracking-wider text-[#A7B4C7]">Catalog Linked</p>
              <p className="font-mono font-semibold text-sm text-white tabular-nums">{products.length} Products</p>
            </div>
            <div className="rounded-xl border border-white/[0.14] bg-[#071426]/70 backdrop-blur-md px-4 py-2.5 text-right">
              <p className="text-[11px] uppercase tracking-wider text-[#A7B4C7]">Archived</p>
              <p className="font-mono font-semibold text-sm text-[#22D3EE] tabular-nums">{history.length} Drafts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Configuration Form */}
        <form
          onSubmit={handleGenerate}
          className="xl:col-span-5 surface-panel p-5 sm:p-6 space-y-4 h-fit"
        >
          <div className="pb-3 border-b border-slate-100 dark:border-white/[0.07]">
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">Campaign Brief</h2>
            <p className="text-xs text-slate-500 dark:text-[#A7B4C7] mt-0.5">
              Auto-fill from an inventory product or enter custom campaign details.
            </p>
          </div>

          {products.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">
                Import from Inventory (Optional)
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="input-field min-h-[42px] px-3"
              >
                <option value="">Select a product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.sellingPrice, currency)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Content Type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="input-field min-h-[42px] px-3"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="input-field min-h-[42px] px-3"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Product Name *</label>
            <input
              required
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Aurore Cognac Leather Tote"
              className="input-field min-h-[42px] px-3"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Category</label>
              <input
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                placeholder="e.g., Leather Goods"
                className="input-field min-h-[42px] px-3"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Price</label>
              <input
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                placeholder={`e.g., ${formatCurrency(99, currency)}`}
                className="input-field min-h-[42px] px-3 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Target Audience</label>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., Working professionals aged 25-45"
              className="input-field min-h-[42px] px-3"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Key Features & Offer</label>
            <textarea
              rows={3}
              value={productFeatures}
              onChange={(e) => setProductFeatures(e.target.value)}
              placeholder="Describe materials, benefits, warranty, or limited-time discounts..."
              className="input-field p-3"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="input-field min-h-[42px] px-3"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="input-field min-h-[42px] px-3"
              >
                {STYLES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={generating}
            className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-[0_10px_24px_-8px_rgba(40,123,255,0.6)] disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            <span>{generating ? 'Generating with Gemini AI...' : 'Generate Marketing Content'}</span>
          </button>
        </form>

        {/* Right Output & History */}
        <div className="xl:col-span-7 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-950/60 p-4 flex items-start gap-3 text-sm text-rose-200">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">AI Connection Error</p>
                <p className="text-xs mt-1 text-rose-200/90">{error}</p>
              </div>
            </div>
          )}

          <div className="surface-panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-4 border-b border-slate-100 dark:border-white/[0.07]">
              <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                Generated Output Editor
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={generating || !productName.trim()}
                  onClick={() => void handleGenerate()}
                  className="surface-well min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-white flex items-center gap-1.5 hover:border-[#287BFF]/50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  <span>Regenerate</span>
                </button>
                <button
                  type="button"
                  disabled={!editableCopy}
                  onClick={() => void handleCopy(editableCopy)}
                  className="surface-well min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-white flex items-center gap-1.5 hover:border-[#287BFF]/50 transition-colors disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  disabled={!editableCopy}
                  onClick={handleExportTxt}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#287BFF]/30 bg-[#287BFF]/12 text-[#287BFF] dark:text-[#22D3EE] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#287BFF]/20 transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export .TXT</span>
                </button>
              </div>
            </div>

            <textarea
              rows={10}
              value={editableCopy}
              onChange={(e) => setEditableCopy(e.target.value)}
              placeholder="Your AI-generated marketing copy will appear here ready for editing, copying, and exporting."
              className="input-field p-4 leading-relaxed"
            />

            {result && (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="surface-well p-4">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Alternative Hooks</p>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-[#A7B4C7]">
                    {(result.variations || []).map((v, i) => (
                      <li key={i} className="flex items-start justify-between gap-2">
                        <span>{v}</span>
                        <button
                          type="button"
                          onClick={() => void handleCopy(v)}
                          className="text-[#287BFF] dark:text-[#22D3EE] shrink-0"
                          title="Copy variation"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="surface-well p-4">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                    Platform Strategy ({platform})
                  </p>
                  <p className="text-xs text-slate-600 dark:text-[#A7B4C7] leading-relaxed">{result.platformTip}</p>
                </div>
              </div>
            )}
          </div>

          {/* Saved History */}
          <div className="surface-panel p-5 sm:p-6">
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white pb-3 mb-2 border-b border-slate-100 dark:border-white/[0.07]">
              Saved Generation History
            </h3>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-[#A7B4C7] py-2">
                Generated campaigns are automatically archived here.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {history.map((h) => (
                  <div key={h.id} className="py-3 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setEditableCopy(h.outputText)}
                      className="text-left min-w-0 flex-1"
                    >
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{h.promptSummary}</p>
                      <p className="text-xs text-slate-500 dark:text-[#A7B4C7] mt-0.5">
                        {h.platform} · {h.style} · {formatDate(h.createdAt, business?.timezone)}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopy(h.outputText)}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          apiRequest(`/api/ai/history/${h.id}`, { method: 'DELETE' }).then(() => void loadData())
                        }
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
