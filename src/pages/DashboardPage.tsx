import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  BadgeDollarSign,
  FileText,
  Receipt,
  Sparkles,
  Bot,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { DashboardSummary, NavSection, SupportedCurrency } from '../types';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';

type DateRangeKey = 'today' | 'week' | 'month' | 'last_month' | 'custom' | 'all';

interface DashboardPageProps {
  onNavigate: (section: NavSection) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { business } = useAuth();
  const { showToast } = useToast();

  const [range, setRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [insightLoading, setInsightLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const [insightError, setInsightError] = useState('');

  const currency = (business?.currency || 'USD') as SupportedCurrency;

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ range });
      if (range === 'custom' && customFrom && customTo) {
        qs.set('from', customFrom);
        qs.set('to', customTo);
      }
      const res = await apiRequest<DashboardSummary>(`/api/dashboard?${qs.toString()}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo]);

  useEffect(() => {
    if (range === 'custom' && (!customFrom || !customTo)) return;
    void fetchDashboard();
  }, [fetchDashboard, range, customFrom, customTo]);

  const handleGenerateInsight = async () => {
    setInsightLoading(true);
    setInsightError('');
    try {
      const res = await apiRequest<{ answer: string }>('/api/ai/advisor', {
        method: 'POST',
        body: JSON.stringify({
          question:
            'Give me a concise 3-point executive summary of my current business performance, inventory risks, and highest-leverage next step based strictly on my records.',
          history: [],
        }),
      });
      setAiInsight(res.answer);
      showToast('AI executive insight updated.', 'success');
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : 'Could not fetch AI insights.');
    } finally {
      setInsightLoading(false);
    }
  };

  const quickActions: { label: string; section: NavSection; icon: React.FC<{ className?: string }> }[] = [
    { label: 'Add Product', section: 'inventory', icon: Plus },
    { label: 'Record Sale', section: 'sales', icon: BadgeDollarSign },
    { label: 'Create Invoice', section: 'invoices', icon: FileText },
    { label: 'Add Expense', section: 'sales', icon: Receipt },
    { label: 'Generate Ad', section: 'marketing', icon: Sparkles },
    { label: 'Ask AI Advisor', section: 'advisor', icon: Bot },
  ];

  const m = data?.metrics;

  return (
    <div className="space-y-6">
      {/* Executive Workspace Hero Banner */}
      <div className="surface-panel overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 p-6 sm:p-7 flex flex-col justify-between gap-5">
          <div>
            <p className="text-xs font-medium text-[#287BFF] dark:text-[#22D3EE]">
              {business?.category || 'Commerce Workspace'} · {business?.country || 'International'} · {currency}
            </p>
            <h2 className="mt-1.5 font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900 dark:text-white">
              {business?.name || 'Executive Overview'}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-[#A7B4C7] max-w-2xl">
              Live financial ledger, inventory valuation, and order velocity computed strictly from your verified workspace records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.label}
                  type="button"
                  onClick={() => onNavigate(qa.section)}
                  className="min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200/90 dark:border-white/[0.1] bg-slate-50/90 dark:bg-[#09182D] hover:border-[#287BFF] dark:hover:border-[#22D3EE] text-xs font-medium text-slate-700 dark:text-white transition-colors whitespace-nowrap"
                >
                  <Icon className="w-3.5 h-3.5 text-[#287BFF] dark:text-[#22D3EE]" />
                  <span>{qa.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 relative min-h-[168px] border-t lg:border-t-0 lg:border-l border-slate-200/85 dark:border-white/[0.08] overflow-hidden">
          <img
            src="/src/assets/images/hero_commerce_studio_1795511631472.jpg"
            alt="Flagship Commerce Operations"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover lg:absolute lg:inset-0"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071426]/90 via-[#071426]/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-[#A7B4C7]">Period Net Profit</p>
              <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-white">
                {formatCurrency(m?.netProfit || 0, currency)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="min-h-[34px] px-3 py-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md text-[11px] font-semibold text-white whitespace-nowrap transition-colors"
            >
              Full Report
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="surface-well flex flex-wrap items-center gap-1 p-1">
          {(
            [
              ['today', 'Today'],
              ['week', 'This week'],
              ['month', 'This month'],
              ['last_month', 'Last month'],
              ['all', 'All time'],
              ['custom', 'Custom'],
            ] as [DateRangeKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                range === key
                  ? 'bg-[#287BFF] text-white shadow-sm'
                  : 'text-slate-600 dark:text-[#A7B4C7] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="input-field !w-auto min-h-[38px] px-3 text-xs"
            />
            <span className="text-xs text-slate-500 dark:text-[#A7B4C7]">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="input-field !w-auto min-h-[38px] px-3 text-xs"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-200 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void fetchDashboard()}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-xs font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Primary KPI Strip */}
      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-28 surface-panel animate-pulse p-5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="surface-panel-interactive p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Total Revenue</p>
            <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
              {formatCurrency(m?.grossRevenue || 0, currency)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-[#A7B4C7]">
              Collected {formatCurrency(m?.cashCollected || 0, currency)}
            </p>
          </div>

          <div className="surface-panel-interactive p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Net Profit</p>
            <p
              className={`mt-2 text-2xl font-bold font-mono tabular-nums truncate ${
                (m?.netProfit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
              }`}
            >
              {formatCurrency(m?.netProfit || 0, currency)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-[#A7B4C7]">
              Gross profit {formatCurrency(m?.grossProfit || 0, currency)}
            </p>
          </div>

          <div className="surface-panel-interactive p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Total Expenses</p>
            <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
              {formatCurrency(m?.totalExpenses || 0, currency)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-[#A7B4C7]">
              COGS {formatCurrency(m?.cogs || 0, currency)}
            </p>
          </div>

          <div className="surface-panel-interactive p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Total Orders</p>
            <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatNumber(m?.totalOrders || 0)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-[#A7B4C7]">
              Outstanding {formatCurrency(m?.outstandingPayments || 0, currency)}
            </p>
          </div>

          <div className="surface-panel-interactive p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Catalog Products</p>
            <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatNumber(m?.totalProducts || 0)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-[#A7B4C7]">
              Value {formatCurrency(m?.inventoryCostValue || 0, currency)}
            </p>
          </div>

          <div className="surface-panel-interactive p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">Low Stock Alerts</p>
            <p
              className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
                (m?.lowStockCount || 0) + (m?.outOfStockCount || 0) > 0
                  ? 'text-amber-500'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatNumber((m?.lowStockCount || 0) + (m?.outOfStockCount || 0))}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-[#A7B4C7]">
              {m?.outOfStockCount || 0} out of stock
            </p>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 surface-panel p-5 sm:p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-white/[0.07]">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Sales & Net Profit Performance
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">
                Calculated directly from recorded sales, COGS, and expenses
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-[#22D3EE]" />
          </div>

          {!data || data.chartSeries.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center px-4">
              <p className="text-sm font-medium text-slate-700 dark:text-white">No sales records in this period yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#A7B4C7] max-w-sm">
                Record your first sale or switch the date filter to view your live revenue and profit curve.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('sales')}
                className="mt-4 min-h-[40px] px-4 py-2 rounded-xl bg-[#287BFF] text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
              >
                Record First Sale
              </button>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chartSeries}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#287BFF" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#287BFF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E3554" opacity={0.35} />
                  <XAxis dataKey="label" stroke="#A7B4C7" fontSize={11} />
                  <YAxis stroke="#A7B4C7" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A172B',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#287BFF" strokeWidth={2} fill="url(#revGrad)" />
                  <Area type="monotone" dataKey="netProfit" name="Net Profit" stroke="#22D3EE" strokeWidth={2} fill="url(#profGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Monthly Business Performance */}
        <div className="surface-panel p-5 sm:p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-white/[0.07]">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Monthly Performance
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">Revenue vs. expenses by month</p>
            </div>
          </div>

          {!data || data.monthlySeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-center text-xs text-slate-500 dark:text-[#A7B4C7]">
              Monthly comparisons appear once transactions are logged.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E3554" opacity={0.35} />
                  <XAxis dataKey="month" stroke="#A7B4C7" fontSize={11} />
                  <YAxis stroke="#A7B4C7" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A172B',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="#287BFF" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* AI Business Insights & Top Products & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Business Insights */}
        <div className="surface-panel overflow-hidden flex flex-col justify-between">
          <div>
            <div className="relative h-24 w-full overflow-hidden border-b border-slate-200/80 dark:border-white/[0.08]">
              <img
                src="/src/assets/images/studio_advisor_vault_1795511632573.jpg"
                alt="Executive Advisory Suite"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#071426]/92 via-[#071426]/75 to-[#071426]/40" />
              <div className="absolute inset-0 px-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Bot className="w-5 h-5 text-[#22D3EE]" />
                  <h2 className="font-display font-semibold text-base text-white">AI Business Insights</h2>
                </div>
                <button
                  type="button"
                  disabled={insightLoading}
                  onClick={() => void handleGenerateInsight()}
                  className="min-h-[34px] px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${insightLoading ? 'animate-spin' : ''}`} />
                  <span>{insightLoading ? 'Analyzing...' : 'Analyze'}</span>
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {insightError && (
                <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200">
                  {insightError}
                </div>
              )}

              {aiInsight ? (
                <div className="text-xs sm:text-sm text-slate-700 dark:text-[#A7B4C7] whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto pr-1">
                  {aiInsight}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-[#A7B4C7] leading-relaxed">
                  Click <strong>Analyze</strong> to run a live AI review of your actual revenue, margins, expenses, and inventory levels. No fabricated statistics are ever generated.
                </p>
              )}
            </div>
          </div>

          <div className="px-5 sm:px-6 pb-5 sm:pb-6">
            <button
              type="button"
              onClick={() => onNavigate('advisor')}
              className="min-h-[40px] w-full rounded-xl border border-slate-200/90 dark:border-white/[0.1] hover:border-[#287BFF] text-xs font-semibold text-slate-700 dark:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Open Full AI Business Advisor</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="surface-panel p-5 sm:p-6">
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 dark:border-white/[0.07]">
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Top-Selling Products
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-xs font-medium text-[#287BFF] dark:text-[#22D3EE] hover:underline whitespace-nowrap"
            >
              View report
            </button>
          </div>
          {!data || data.topProducts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">
              No product sales recorded for this date range.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {data.topProducts.map((item) => (
                <div key={item.name} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-500 dark:text-[#A7B4C7] font-mono tabular-nums">
                      {item.unitsSold} units sold
                    </p>
                  </div>
                  <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white shrink-0">
                    {formatCurrency(item.revenue, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Products */}
        <div className="surface-panel p-5 sm:p-6">
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 dark:border-white/[0.07]">
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Low-Stock Watchlist
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-medium text-[#287BFF] dark:text-[#22D3EE] hover:underline whitespace-nowrap"
            >
              Manage stock
            </button>
          </div>
          {!data || data.lowStockProducts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">
              All inventory products are currently above their reorder threshold.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {data.lowStockProducts.map((prod) => (
                <div key={prod.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{prod.name}</p>
                    <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">
                      {prod.sku} · Reorder at {prod.lowStockThreshold}
                    </p>
                  </div>
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold font-mono tabular-nums shrink-0 ${
                      prod.stockQty === 0 ? 'text-rose-500' : 'text-amber-500'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{prod.stockQty === 0 ? 'Out of stock' : `${prod.stockQty} left`}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-panel p-5 sm:p-6">
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 dark:border-white/[0.07]">
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">Recent Transactions</h2>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs font-medium text-[#287BFF] dark:text-[#22D3EE] hover:underline whitespace-nowrap"
            >
              All sales
            </button>
          </div>
          {!data || data.recentSales.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">No sales transactions recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {data.recentSales.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {s.saleNumber} · {s.customerName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">
                      {formatDate(s.saleDate, business?.timezone)} · {s.paymentMethod} · {s.paymentStatus}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(s.totalAmount, currency)}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(s.grossProfit, currency)} GP
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="surface-panel p-5 sm:p-6">
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 dark:border-white/[0.07]">
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">Recent Orders</h2>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="text-xs font-medium text-[#287BFF] dark:text-[#22D3EE] hover:underline whitespace-nowrap"
            >
              Manage orders
            </button>
          </div>
          {!data || data.recentOrders.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">No customer orders logged yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {data.recentOrders.map((o) => (
                <div key={o.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {o.orderNumber} · {o.customerName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">
                      {formatDate(o.orderDate, business?.timezone)} · {o.items.length} item(s) · <span className="capitalize">{o.status}</span>
                    </p>
                  </div>
                  <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white shrink-0">
                    {formatCurrency(o.totalAmount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
