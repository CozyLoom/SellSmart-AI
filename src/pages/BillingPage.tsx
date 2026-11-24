import React, { useCallback, useEffect, useState } from 'react';
import { Check, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { PlanTier, SubscriptionInfo } from '../types';
import { formatDate } from '../utils/format';
import { ConfirmDialog } from '../components/ConfirmDialog';

const PLANS: {
  id: PlanTier;
  name: string;
  audience: string;
  monthlyUsd: number;
  annualUsd: number;
  limits: string[];
}[] = [
  {
    id: 'free',
    name: 'Free Plan',
    audience: 'For solo sellers starting out',
    monthlyUsd: 0,
    annualUsd: 0,
    limits: [
      'Up to 50 product records',
      '10 AI generations / month',
      'Basic sales & profit tracking',
      '5 PDF invoices / month',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Plan',
    audience: 'For growing retail & online stores',
    monthlyUsd: 4.99,
    annualUsd: 49.9,
    limits: [
      'Unlimited product records',
      '250 AI generations / month',
      'Full AI Marketing Studio & Poster Studio',
      'Unlimited PDF invoices & customer CRM',
      'Advanced analytics & CSV/PDF reports',
    ],
  },
  {
    id: 'business',
    name: 'Business Premium',
    audience: 'For multi-channel scaling operations',
    monthlyUsd: 9.99,
    annualUsd: 99.9,
    limits: [
      'Everything in Pro Plan',
      '1,500 AI generations / month',
      'Priority AI Business Advisor & deep insights',
      'Multiple staff seat readiness',
      'Executive exportable financial reports',
    ],
  },
];

export const BillingPage: React.FC = () => {
  const { showToast } = useToast();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [gatewayMessage, setGatewayMessage] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const loadSub = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<SubscriptionInfo>('/api/subscription');
      setSub(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load subscription.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadSub();
  }, [loadSub]);

  const handlePlanChange = async (tier: PlanTier) => {
    setGatewayMessage('');
    try {
      await apiRequest('/api/subscription/change', {
        method: 'POST',
        body: JSON.stringify({ planTier: tier, billingCycle }),
      });
      showToast(`Subscription updated to ${tier.toUpperCase()}.`, 'success');
      await loadSub();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Subscription change failed.';
      setGatewayMessage(msg);
      showToast(msg, 'error');
    }
  };

  const handleCancelRenewal = async () => {
    try {
      await apiRequest('/api/subscription/cancel', { method: 'POST' });
      showToast('Auto-renewal cancelled for the end of the current period.', 'info');
      setCancelConfirm(false);
      await loadSub();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to cancel subscription.', 'error');
    }
  };

  if (loading || !sub) {
    return <div className="p-8 text-center text-sm text-slate-500 dark:text-[#A7B4C7]">Loading subscription status...</div>;
  }

  const aiPct = Math.min(100, Math.round((sub.usage.aiGenerationsCount / sub.usage.aiGenerationsLimit) * 100));
  const invPct = sub.usage.invoicesLimit
    ? Math.min(100, Math.round((sub.usage.invoicesCount / sub.usage.invoicesLimit) * 100))
    : 0;
  const prodPct = sub.usage.productsLimit
    ? Math.min(100, Math.round((sub.usage.productsCount / sub.usage.productsLimit) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Current Subscription & Usage */}
      <div className="surface-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-white/[0.08]">
          <div>
            <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">Current Subscription</p>
            <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white capitalize mt-1">
              {sub.planTier} Plan · {sub.billingCycle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#A7B4C7] mt-1">
              Status: <strong className="text-emerald-500 capitalize">{sub.status}</strong> · Period ends{' '}
              {formatDate(sub.currentPeriodEnd)}
              {sub.cancelAtPeriodEnd ? ' (Cancels at period end)' : ''}
            </p>
          </div>
          <div className="surface-well px-3.5 py-2 flex items-center gap-2 text-xs text-slate-600 dark:text-[#A7B4C7]">
            <ShieldCheck className="w-4 h-4 text-[#22D3EE]" />
            <span>
              {sub.paymentGatewayConfigured
                ? 'Stripe Checkout active'
                : 'Server-verified billing gate (configure STRIPE_SECRET_KEY for live upgrades)'}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="surface-well p-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-600 dark:text-[#A7B4C7]">AI Generations ({sub.usage.periodMonth})</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {sub.usage.aiGenerationsCount} / {sub.usage.aiGenerationsLimit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-[#071426] overflow-hidden">
              <div className="h-full bg-[#287BFF]" style={{ width: `${aiPct}%` }} />
            </div>
          </div>

          <div className="surface-well p-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-600 dark:text-[#A7B4C7]">Monthly Invoices</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {sub.usage.invoicesCount} / {sub.usage.invoicesLimit ?? 'Unlimited'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-[#071426] overflow-hidden">
              <div className="h-full bg-[#22D3EE]" style={{ width: `${sub.usage.invoicesLimit ? invPct : 18}%` }} />
            </div>
          </div>

          <div className="surface-well p-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-600 dark:text-[#A7B4C7]">Catalog Products</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {sub.usage.productsCount} / {sub.usage.productsLimit ?? 'Unlimited'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-[#071426] overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${sub.usage.productsLimit ? prodPct : 22}%` }} />
            </div>
          </div>
        </div>
      </div>

      {gatewayMessage && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/50 p-4 flex items-start gap-3 text-xs text-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Payment Provider Verification Required</p>
            <p className="mt-1 leading-relaxed">{gatewayMessage}</p>
          </div>
        </div>
      )}

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Compare Plans</h3>
        <div className="surface-well flex items-center gap-1 p-1">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-white shadow-[0_6px_16px_-6px_rgba(40,123,255,0.6)]'
                : 'text-slate-600 dark:text-[#A7B4C7]'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              billingCycle === 'annual'
                ? 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-white shadow-[0_6px_16px_-6px_rgba(40,123,255,0.6)]'
                : 'text-slate-600 dark:text-[#A7B4C7]'
            }`}
          >
            Annual (Save 17%)
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = sub.planTier === plan.id;
          const displayPrice = billingCycle === 'annual' ? plan.annualUsd : plan.monthlyUsd;
          return (
            <div
              key={plan.id}
              className={`surface-panel-interactive p-6 flex flex-col justify-between ${
                plan.id === 'pro'
                  ? '!border-[#287BFF]/70 dark:!border-[#22D3EE]/55 shadow-[0_18px_40px_-18px_rgba(40,123,255,0.45)]'
                  : ''
              }`}
            >
              <div>
                <h4 className="font-display font-bold text-lg text-slate-900 dark:text-white">{plan.name}</h4>
                <p className="text-xs text-slate-500 dark:text-[#A7B4C7] mt-1">{plan.audience}</p>

                <div className="mt-5 flex items-baseline gap-1 pb-5 border-b border-slate-100 dark:border-white/[0.07]">
                  <span className="font-mono font-bold text-3xl text-slate-900 dark:text-white tabular-nums">
                    ${displayPrice.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-[#A7B4C7]">
                    / {billingCycle === 'annual' ? 'year' : 'month'}
                  </span>
                </div>

                <ul className="mt-5 space-y-2.5 text-xs text-slate-600 dark:text-[#A7B4C7]">
                  {plan.limits.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#22D3EE] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="surface-well w-full min-h-[42px] text-xs font-semibold text-slate-500 dark:text-[#A7B4C7]"
                  >
                    Active Plan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handlePlanChange(plan.id)}
                    className={`w-full min-h-[42px] rounded-xl text-xs font-semibold transition-all ${
                      plan.id === 'free'
                        ? 'surface-well text-slate-700 dark:text-white hover:border-[#287BFF]/50'
                        : 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-white shadow-[0_8px_20px_-6px_rgba(40,123,255,0.5)]'
                    }`}
                  >
                    {plan.id === 'free' ? 'Downgrade to Free' : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment History & Cancellation */}
      <div className="surface-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 mb-3 border-b border-slate-100 dark:border-white/[0.07]">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#287BFF] dark:text-[#22D3EE]" />
            <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">Payment History</h3>
          </div>
          {sub.planTier !== 'free' && !sub.cancelAtPeriodEnd && (
            <button
              type="button"
              onClick={() => setCancelConfirm(true)}
              className="text-xs font-medium text-rose-500 hover:underline"
            >
              Cancel subscription renewal
            </button>
          )}
        </div>
        {sub.paymentHistory.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">
            No paid billing invoices yet. Invoices appear automatically once paid checkout transactions are processed.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {sub.paymentHistory.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{p.description}</p>
                  <p className="text-slate-500 dark:text-[#A7B4C7]">{formatDate(p.createdAt)}</p>
                </div>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  ${p.amountUsd.toFixed(2)} {p.currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelConfirm}
        title="Cancel Subscription Renewal?"
        description="You will keep your current tier until the end of the billing period, after which your workspace reverts to the Free Plan."
        confirmLabel="Cancel Renewal"
        onConfirm={() => void handleCancelRenewal()}
        onCancel={() => setCancelConfirm(false)}
      />
    </div>
  );
};
