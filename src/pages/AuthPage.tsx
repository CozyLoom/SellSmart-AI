import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, FlaskConical, KeyRound, Lock, Mail, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import { BUSINESS_CATEGORIES, COUNTRIES_LIST, CURRENCY_CONFIG, TIMEZONES_LIST } from '../utils/format';
import type { BusinessProfile, SupportedCurrency, UserProfile } from '../types';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export const AuthPage: React.FC<{ onboardingOnly?: boolean }> = ({ onboardingOnly = false }) => {
  const { user, applyAuthResponse, setBusiness, logout } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);

  // Auth form fields
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [previewResetCode, setPreviewResetCode] = useState('');

  // Business Onboarding fields
  const [bizName, setBizName] = useState('');
  const [category, setCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [country, setCountry] = useState('United States');
  const [currency, setCurrency] = useState<SupportedCurrency>('USD');
  const [timezone, setTimezone] = useState('America/New_York');
  const [phone, setPhone] = useState('');
  const [bizEmail, setBizEmail] = useState(user?.email || '');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [loadDemo, setLoadDemo] = useState(false);

  useEffect(() => {
    apiRequest<{ googleConfigured: boolean }>('/api/auth/providers')
      .then((p) => setGoogleConfigured(p.googleConfigured))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (user && !bizEmail) setBizEmail(user.email);
  }, [user, bizEmail]);

  const handleCountryChange = (nextCountry: string) => {
    setCountry(nextCountry);
    const match = COUNTRIES_LIST.find((c) => c.name === nextCountry);
    if (match) {
      setCurrency(match.currency);
      setTimezone(match.timezone);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const res = await apiRequest<{ token: string; user: UserProfile; business: BusinessProfile | null }>('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ fullName, email, password }),
        });
        applyAuthResponse(res);
        showToast('Account created. Complete your business profile to enter your workspace.', 'success');
      } else if (mode === 'login') {
        const res = await apiRequest<{ token: string; user: UserProfile; business: BusinessProfile | null }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        applyAuthResponse(res);
        showToast(`Welcome back, ${res.user.fullName}.`, 'success');
      } else if (mode === 'forgot') {
        const res = await apiRequest<{ message: string; previewResetCode?: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        if (res.previewResetCode) {
          setPreviewResetCode(res.previewResetCode);
          setResetCode(res.previewResetCode);
        }
        showToast(res.message, 'info');
        setMode('reset');
      } else if (mode === 'reset') {
        const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, code: resetCode, newPassword: password }),
        });
        showToast(res.message, 'success');
        setPassword('');
        setMode('login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDemoLaunch = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ token: string; user: UserProfile; business: BusinessProfile }>('/api/auth/demo', {
        method: 'POST',
      });
      applyAuthResponse(res);
      showToast('Demo Workspace launched with sample retail records.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not launch demo workspace.');
    } finally {
      setBusy(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ business: BusinessProfile }>('/api/business/register', {
        method: 'POST',
        body: JSON.stringify({
          name: bizName,
          category,
          country,
          currency,
          timezone,
          phone,
          email: bizEmail,
          address,
          description,
          loadDemo,
        }),
      });
      setBusiness(res.business);
      showToast('Business workspace created.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register business.');
    } finally {
      setBusy(false);
    }
  };

  if (onboardingOnly && user) {
    return (
      <div className="min-h-screen app-canvas-bg bg-[#071426] text-white flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-3xl surface-panel overflow-hidden">
          <div className="relative h-40 sm:h-48 w-full overflow-hidden border-b border-white/[0.1]">
            <img
              src="/src/assets/images/studio_marketing_desk_1795511632445.jpg"
              alt="SellSmart AI Executive Commerce Workspace"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#071426] via-[#071426]/65 to-[#071426]/20" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:px-8 flex items-end justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#287BFF] to-[#22D3EE] ring-1 ring-inset ring-white/30 flex items-center justify-center font-bold text-white shadow-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Register Your Business</h1>
                  <p className="text-xs text-[#A7B4C7]">Signed in as {user.fullName} · {user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="text-xs text-[#A7B4C7] hover:text-white underline whitespace-nowrap"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <div className="mb-5 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Business Name *</label>
                  <input
                    required
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    placeholder="e.g., Horizon Apparel Ltd"
                    className="input-field min-h-[44px] px-3.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Business Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as typeof category)}
                    className="input-field min-h-[44px] px-3.5 text-sm"
                  >
                    {BUSINESS_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Country *</label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="input-field min-h-[44px] px-3.5 text-sm"
                  >
                    {COUNTRIES_LIST.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Primary Currency *</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
                    className="input-field min-h-[44px] px-3.5 text-sm"
                  >
                    {(Object.keys(CURRENCY_CONFIG) as SupportedCurrency[]).map((code) => (
                      <option key={code} value={code}>{code} — {CURRENCY_CONFIG[code].name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Time Zone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="input-field min-h-[44px] px-3.5 text-sm"
                  >
                    {TIMEZONES_LIST.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Business Phone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={CURRENCY_CONFIG[currency].phoneHint}
                    className="input-field min-h-[44px] px-3.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Contact Email</label>
                  <input
                    type="email"
                    value={bizEmail}
                    onChange={(e) => setBizEmail(e.target.value)}
                    placeholder="sales@yourbusiness.com"
                    className="input-field min-h-[44px] px-3.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Business Address</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, city, postal code"
                  className="input-field min-h-[44px] px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Business Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What do you sell and who are your customers? Used by AI Marketing & Business Advisor."
                  className="input-field p-3 text-sm"
                />
              </div>

              <label className="surface-well flex items-start gap-3 p-3.5 cursor-pointer hover:border-[#287BFF]/45 transition-colors">
                <input
                  type="checkbox"
                  checked={loadDemo}
                  onChange={(e) => setLoadDemo(e.target.checked)}
                  className="mt-1 rounded border-white/20 accent-[#287BFF]"
                />
                <span className="text-xs text-[#A7B4C7] leading-relaxed">
                  <strong className="text-white block">Populate with sample Demo Mode records</strong>
                  Leave unchecked to start with a clean $0 workspace for your own real records.
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-110 font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                <span>{busy ? 'Creating Workspace...' : 'Create Business Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071426] text-white flex flex-col lg:flex-row">
      {/* Left Brand Showcase with 4K Architectural Photography */}
      <div className="relative lg:w-[50%] overflow-hidden p-8 lg:p-14 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/[0.1]">
        <img
          src="/src/assets/images/hero_commerce_studio_1795511631472.jpg"
          alt="SellSmart AI Flagship Retail Commerce Studio"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#071426]/94 via-[#071426]/82 to-[#071426]/55" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#287BFF] to-[#22D3EE] ring-1 ring-inset ring-white/30 shadow-lg flex items-center justify-center font-bold text-lg text-white">
              S
            </div>
            <span className="font-display font-bold text-xl tracking-tight">SellSmart AI</span>
          </div>

          <div className="mt-10 lg:mt-14 max-w-xl">
            <p className="text-xs font-medium text-[#22D3EE]">
              International Commerce Operating System · Multi-Currency · AI Suite
            </p>
            <h1 className="mt-3 font-display font-bold text-3xl lg:text-5xl tracking-tight leading-[1.1] text-white">
              Your Business. Smarter. Faster. Better.
            </h1>
            <p className="mt-4 text-base text-[#CBD5E1] leading-relaxed">
              Manage inventory, real-time profit margins, customer orders, PDF invoices, and AI marketing campaigns from one precision-engineered platform.
            </p>

            <div className="mt-8 space-y-3 text-sm text-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#22D3EE] shrink-0" />
                <span>Automated COGS, gross profit, and net profit accounting</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#22D3EE] shrink-0" />
                <span>Multi-currency support across USD, UGX, EUR, GBP, KES, TZS, NGN, ZAR</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#22D3EE] shrink-0" />
                <span>AI Marketing Studio, 4K Poster Studio, and grounded Business Advisor</span>
              </div>
            </div>
          </div>
        </div>

        {/* Framed Inset Gallery Preview + Instant Demo Trigger */}
        <div className="relative z-10 mt-10 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="surface-frame aspect-[16/10]">
              <img
                src="/src/assets/images/studio_marketing_desk_1795511632445.jpg"
                alt="AI Marketing Creative Studio"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071426]/90 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2.5 text-[11px] font-medium text-white">Marketing Studio</span>
            </div>
            <div className="surface-frame aspect-[16/10]">
              <img
                src="/src/assets/images/studio_advisor_vault_1795511632573.jpg"
                alt="AI Financial Advisory Suite"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071426]/90 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2.5 text-[11px] font-medium text-white">Executive Advisor</span>
            </div>
            <div className="surface-frame aspect-[16/10]">
              <img
                src="/src/assets/images/demo_luxury_watch_1795511633549.jpg"
                alt="High-Resolution Catalog Assets"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071426]/90 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2.5 text-[11px] font-medium text-white">Catalog & Posters</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.12] bg-[#071426]/75 backdrop-blur-md p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-white">Evaluate immediately without registering</p>
              <p className="text-xs text-[#A7B4C7]">Launches a private Demo Mode store with sample products & live accounting</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDemoLaunch()}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-[#22D3EE]/45 bg-[#22D3EE]/12 hover:bg-[#22D3EE]/22 text-[#22D3EE] text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <FlaskConical className="w-4 h-4" />
              <span>Launch Demo Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Auth Card */}
      <div className="flex-1 app-canvas-bg bg-[#071426] flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md surface-panel p-6 sm:p-8">
          <div className="surface-well flex items-center gap-1.5 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                mode === 'login' ? 'bg-[#287BFF] text-white shadow-sm' : 'text-[#A7B4C7] hover:text-white'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                mode === 'signup' ? 'bg-[#287BFF] text-white shadow-sm' : 'text-[#A7B4C7] hover:text-white'
              }`}
            >
              Create account
            </button>
          </div>

          <h2 className="font-display font-bold text-xl text-white">
            {mode === 'login' && 'Welcome back'}
            {mode === 'signup' && 'Start your free workspace'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Enter verification code'}
          </h2>
          <p className="mt-1 text-xs text-[#A7B4C7]">
            {mode === 'login' && 'Sign in to access your private business dashboard.'}
            {mode === 'signup' && 'Create an owner account, then configure your business currency & catalog.'}
            {mode === 'forgot' && 'Enter your account email to receive a password reset code.'}
            {mode === 'reset' && 'Enter the 6-digit reset code and choose a new password.'}
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          {mode === 'reset' && previewResetCode && (
            <div className="mt-4 rounded-xl border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-4 py-3 text-xs text-[#22D3EE]">
              Verification code (SMTP not configured): <strong className="font-mono">{previewResetCode}</strong>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Full Name</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Sarah K. Mensah"
                  className="input-field min-h-[44px] px-3.5 text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#A7B4C7] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-field min-h-[44px] pl-10 pr-3.5 text-sm"
                />
              </div>
            </div>

            {mode === 'reset' && (
              <div>
                <label className="block text-xs font-medium text-[#A7B4C7] mb-1.5">6-Digit Reset Code</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#A7B4C7] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="123456"
                    className="input-field min-h-[44px] pl-10 pr-3.5 text-sm font-mono"
                  />
                </div>
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#A7B4C7]">
                    {mode === 'reset' ? 'New Password (min 8 characters)' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); }}
                      className="text-xs text-[#22D3EE] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#A7B4C7] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field min-h-[44px] pl-10 pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A7B4C7] hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-110 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              <span>
                {busy
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign in to Workspace'
                  : mode === 'signup'
                  ? 'Create Account'
                  : mode === 'forgot'
                  ? 'Request Reset Code'
                  : 'Update Password'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className="mt-4 w-full text-center text-xs text-[#A7B4C7] hover:text-white"
            >
              Back to Sign in
            </button>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div className="mt-6 pt-5 border-t border-white/[0.08] space-y-3">
              <div className="surface-well px-3.5 py-2.5 text-xs text-[#A7B4C7]">
                {googleConfigured
                  ? 'Google OAuth is enabled for this workspace.'
                  : 'Google Sign-In can be enabled by adding GOOGLE_CLIENT_ID in environment secrets.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
