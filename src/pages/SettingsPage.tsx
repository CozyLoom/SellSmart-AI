import React, { useEffect, useState } from 'react';
import { Save, Upload, FlaskConical, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import { BUSINESS_CATEGORIES, COUNTRIES_LIST, CURRENCY_CONFIG, TIMEZONES_LIST } from '../utils/format';
import type { BusinessProfile, BusinessSettings, SupportedCurrency } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StudioImage } from '../components/StudioImage';

export const SettingsPage: React.FC = () => {
  const { user, business, settings, theme, setTheme, setBusiness, setSettings, setUser } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [bizName, setBizName] = useState(business?.name || '');
  const [category, setCategory] = useState(business?.category || BUSINESS_CATEGORIES[0]);
  const [country, setCountry] = useState(business?.country || 'United States');
  const [currency, setCurrency] = useState<SupportedCurrency>((business?.currency || 'USD') as SupportedCurrency);
  const [timezone, setTimezone] = useState(business?.timezone || 'UTC');
  const [phone, setPhone] = useState(business?.phone || '');
  const [email, setEmail] = useState(business?.email || '');
  const [address, setAddress] = useState(business?.address || '');
  const [description, setDescription] = useState(business?.description || '');
  const [logoUrl, setLogoUrl] = useState(business?.logoUrl || '');
  const [taxRate, setTaxRate] = useState(String(business?.taxRate || 0));
  const [invoicePrefix, setInvoicePrefix] = useState(settings?.invoicePrefix || 'INV-');
  const [orderPrefix, setOrderPrefix] = useState(settings?.orderPrefix || 'ORD-');

  const [saving, setSaving] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [providers, setProviders] = useState<{ googleConfigured: boolean; smtpConfigured: boolean; paymentGatewayConfigured: boolean } | null>(null);

  useEffect(() => {
    apiRequest<{ googleConfigured: boolean; smtpConfigured: boolean; paymentGatewayConfigured: boolean }>('/api/auth/providers')
      .then(setProviders)
      .catch(() => undefined);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      showToast('Select a valid image file.', 'error');
      return;
    }
    if (file.size > 1_800_000) {
      showToast('Logo image must be under 1.8 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName }),
      });
      const res = await apiRequest<{ business: BusinessProfile; settings: BusinessSettings }>('/api/business', {
        method: 'PATCH',
        body: JSON.stringify({
          name: bizName,
          category,
          country,
          currency,
          timezone,
          phone,
          email,
          address,
          description,
          logoUrl,
          taxRate: Number(taxRate || 0),
          settings: {
            invoicePrefix,
            orderPrefix,
            themePreference: theme,
          },
        }),
      });
      if (user) setUser({ ...user, fullName });
      setBusiness(res.business);
      setSettings(res.settings);
      showToast('Workspace & localization settings saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadDemo = async () => {
    setDemoBusy(true);
    try {
      const res = await apiRequest<{ business: BusinessProfile }>('/api/business/load-demo', { method: 'POST' });
      setBusiness(res.business);
      showToast('Demo Mode sample data loaded into workspace.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load demo data.', 'error');
    } finally {
      setDemoBusy(false);
    }
  };

  const handleClearData = async () => {
    setDemoBusy(true);
    try {
      const res = await apiRequest<{ business: BusinessProfile }>('/api/business/clear-data', { method: 'POST' });
      setBusiness(res.business);
      setClearOpen(false);
      showToast('All business records cleared.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear workspace.', 'error');
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <form onSubmit={handleSaveSettings} className="surface-panel p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-white/[0.08] pb-4">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
              Business Profile & International Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">
              Configure currency, country, timezone, tax defaults, and invoice branding.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-xs sm:text-sm font-semibold text-white flex items-center gap-2 shadow-[0_8px_20px_-6px_rgba(40,123,255,0.55)] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>

        {/* Owner & Logo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Owner Full Name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field min-h-[42px] px-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Business Logo (Invoices)</label>
            <div className="flex items-center gap-3">
              {logoUrl && (
                <StudioImage
                  src={logoUrl}
                  alt="Business Logo"
                  className="w-11 h-11 rounded-xl object-cover border border-slate-200/90 dark:border-white/[0.12] shadow-sm"
                  fallbackClassName="w-11 h-11 rounded-xl border border-slate-200/90 dark:border-white/[0.12] bg-slate-100 dark:bg-[#0A172B]"
                />
              )}
              <label className="surface-well min-h-[42px] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-white cursor-pointer flex items-center gap-2 hover:border-[#287BFF]/60 transition-colors">
                <Upload className="w-4 h-4" />
                <span>Upload Logo</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Business Name *</label>
            <input
              required
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              className="input-field min-h-[42px] px-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field min-h-[42px] px-3"
            >
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* International Localization */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="input-field min-h-[42px] px-3"
            >
              {COUNTRIES_LIST.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
              className="input-field min-h-[42px] px-3"
            >
              {(Object.keys(CURRENCY_CONFIG) as SupportedCurrency[]).map((code) => (
                <option key={code} value={code}>{code} — {CURRENCY_CONFIG[code].name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Time Zone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="input-field min-h-[42px] px-3"
            >
              {TIMEZONES_LIST.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Business Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field min-h-[42px] px-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Default Tax Rate (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="input-field min-h-[42px] px-3 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Invoice Prefix</label>
            <input
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              className="input-field min-h-[42px] px-3 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Order Prefix</label>
            <input
              value={orderPrefix}
              onChange={(e) => setOrderPrefix(e.target.value)}
              className="input-field min-h-[42px] px-3 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Interface Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
              className="input-field min-h-[42px] px-3"
            >
              <option value="dark">Midnight Navy (Dark)</option>
              <option value="light">Crisp Daylight (Light)</option>
            </select>
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
          <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Business Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field p-3"
          />
        </div>
      </form>

      {/* Demo Data & Workspace Reset */}
      <div className="surface-panel p-6">
        <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">Demo Mode & Workspace Data</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7]">
          Load realistic sample retail data to test dashboards, AI advisors, and invoices, or wipe your workspace to start fresh.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={demoBusy}
            onClick={() => void handleLoadDemo()}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-[#22D3EE]/40 bg-[#22D3EE]/10 hover:bg-[#22D3EE]/20 text-[#22D3EE] text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <FlaskConical className="w-4 h-4" />
            <span>Load Demo Sample Data</span>
          </button>
          <button
            type="button"
            disabled={demoBusy}
            onClick={() => setClearOpen(true)}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All Business Data</span>
          </button>
        </div>
      </div>

      {/* External Provider Integration Readiness */}
      {providers && (
        <div className="surface-panel p-6 space-y-3">
          <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">External Integration Configuration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="surface-well p-3.5 flex items-center gap-2.5">
              {providers.googleConfigured ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Google OAuth</p>
                <p className="text-slate-500 dark:text-[#A7B4C7]">
                  {providers.googleConfigured ? 'Configured' : 'Set GOOGLE_CLIENT_ID'}
                </p>
              </div>
            </div>
            <div className="surface-well p-3.5 flex items-center gap-2.5">
              {providers.paymentGatewayConfigured ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Stripe Billing</p>
                <p className="text-slate-500 dark:text-[#A7B4C7]">
                  {providers.paymentGatewayConfigured ? 'Configured' : 'Set STRIPE_SECRET_KEY'}
                </p>
              </div>
            </div>
            <div className="surface-well p-3.5 flex items-center gap-2.5">
              {providers.smtpConfigured ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">SMTP Email</p>
                <p className="text-slate-500 dark:text-[#A7B4C7]">
                  {providers.smtpConfigured ? 'Configured' : 'Set SMTP_HOST'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={clearOpen}
        title="Clear All Business Records?"
        description="This permanently removes all products, sales, orders, expenses, customers, and invoices from this business workspace."
        confirmLabel="Clear Workspace"
        busy={demoBusy}
        onConfirm={() => void handleClearData()}
        onCancel={() => setClearOpen(false)}
      />
    </div>
  );
};
