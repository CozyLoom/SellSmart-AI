import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { DashboardSummary, SupportedCurrency } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { downloadCsv } from '../utils/export';
import { generateAnalyticsReportPdf } from '../utils/pdf';

interface AnalyticsData {
  salesByCategory: { category: string; unitsSold: number; revenue: number }[];
  expenseBreakdown: { category: string; amount: number; entries: number }[];
  bestSellingProducts: { name: string; unitsSold: number; revenue: number; profit: number }[];
  customerTrends: { id: string; name: string; orders: number; totalSpent: number; lastPurchase: string | null }[];
  inventoryHealth: {
    name: string;
    sku: string;
    stockQty: number;
    threshold: number;
    purchasePrice: number;
    sellingPrice: number;
    costValue: number;
    retailValue: number;
  }[];
}

const CHART_COLORS = ['#287BFF', '#22D3EE', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];

export const AnalyticsPage: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();
  const currency = (business?.currency || 'USD') as SupportedCurrency;

  const [range, setRange] = useState<'week' | 'month' | 'last_month' | 'all'>('all');
  const [dash, setDash] = useState<DashboardSummary | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        apiRequest<DashboardSummary>(`/api/dashboard?range=${range}`),
        apiRequest<AnalyticsData>(`/api/analytics?range=${range}`),
      ]);
      setDash(d);
      setAnalytics(a);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load analytics.', 'error');
    } finally {
      setLoading(false);
    }
  }, [range, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleExportPdf = () => {
    if (!business || !dash || !analytics) return;
    generateAnalyticsReportPdf(
      business,
      range === 'all' ? 'All Time' : range.replace('_', ' '),
      {
        grossRevenue: dash.metrics.grossRevenue,
        cogs: dash.metrics.cogs,
        grossProfit: dash.metrics.grossProfit,
        totalExpenses: dash.metrics.totalExpenses,
        netProfit: dash.metrics.netProfit,
        totalOrders: dash.metrics.totalOrders,
        inventoryValue: dash.metrics.inventoryCostValue,
      },
      analytics.bestSellingProducts
    );
    showToast('Analytics PDF report downloaded.', 'success');
  };

  const handleExportCsv = () => {
    if (!analytics) return;
    downloadCsv(
      `sellsmart-analytics-${range}.csv`,
      ['Product', 'Units Sold', 'Revenue', 'Gross Profit'],
      analytics.bestSellingProducts.map((p) => [p.name, p.unitsSold, p.revenue, p.profit])
    );
    showToast('Analytics CSV exported.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="surface-well flex items-center gap-1 p-1">
          {(
            [
              ['week', 'This week'],
              ['month', 'This month'],
              ['last_month', 'Last month'],
              ['all', 'All time'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRange(id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                range === id
                  ? 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-white shadow-[0_6px_16px_-6px_rgba(40,123,255,0.6)]'
                  : 'text-slate-600 dark:text-[#A7B4C7]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!analytics}
            className="surface-well min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-white flex items-center gap-2 hover:border-[#287BFF]/50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!dash || !analytics}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-xs font-semibold text-white flex items-center gap-2 shadow-[0_8px_20px_-6px_rgba(40,123,255,0.55)]"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF Report</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500 dark:text-[#A7B4C7]">Calculating analytics...</div>
      ) : (
        <>
          {/* Revenue & Profit vs Expense Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="surface-panel p-5 sm:p-6">
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white pb-3 mb-4 border-b border-slate-100 dark:border-white/[0.07]">
                Daily Revenue & Net Profit Trend
              </h2>
              {!dash || dash.chartSeries.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-500 dark:text-[#A7B4C7]">
                  No transaction data in this timeframe.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dash.chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                      <XAxis dataKey="label" stroke="#A7B4C7" fontSize={11} />
                      <YAxis stroke="#A7B4C7" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(10, 23, 43, 0.96)',
                          borderColor: 'rgba(255, 255, 255, 0.14)',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#287BFF" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="surface-panel p-5 sm:p-6">
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white pb-3 mb-4 border-b border-slate-100 dark:border-white/[0.07]">
                Sales by Category
              </h2>
              {!analytics || analytics.salesByCategory.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-500 dark:text-[#A7B4C7]">
                  Category breakdown appears once product sales are recorded.
                </div>
              ) : (
                <div className="h-64 w-full flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.salesByCategory}
                          dataKey="revenue"
                          nameKey="category"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {analytics.salesByCategory.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(10, 23, 43, 0.96)',
                            borderColor: 'rgba(255, 255, 255, 0.14)',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full sm:w-1/2 space-y-2">
                    {analytics.salesByCategory.map((c, i) => (
                      <div key={c.category} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-700 dark:text-[#A7B4C7]">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          {c.category}
                        </span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(c.revenue, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Best-Selling Products & Expense Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="surface-panel p-5 sm:p-6">
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white pb-3 mb-4 border-b border-slate-100 dark:border-white/[0.07]">
                Best-Selling Products (Revenue vs Profit)
              </h2>
              {!analytics || analytics.bestSellingProducts.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">No product sales recorded yet.</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.bestSellingProducts.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                      <XAxis dataKey="name" stroke="#A7B4C7" fontSize={10} />
                      <YAxis stroke="#A7B4C7" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(10, 23, 43, 0.96)',
                          borderColor: 'rgba(255, 255, 255, 0.14)',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="revenue" name="Revenue" fill="#287BFF" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Gross Profit" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="surface-panel p-5 sm:p-6">
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white pb-3 mb-3 border-b border-slate-100 dark:border-white/[0.07]">
                Customer Purchasing Trends
              </h2>
              {!analytics || analytics.customerTrends.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">No customer purchase trends available yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {analytics.customerTrends.map((c) => (
                    <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                        <p className="text-slate-500 dark:text-[#A7B4C7]">
                          {c.orders} purchase(s) · Last: {formatDate(c.lastPurchase, business?.timezone)}
                        </p>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(c.totalSpent, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Inventory Valuation Table */}
          <div className="surface-panel overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-white/[0.07]">
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Inventory Capital & Margin Performance
              </h2>
            </div>
            {!analytics || analytics.inventoryHealth.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-[#A7B4C7]">
                No inventory records yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50/90 dark:bg-[#0A172B]/90 border-b border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#A7B4C7]">
                    <tr>
                      <th className="py-3 px-4 font-medium">Product</th>
                      <th className="py-3 px-4 font-medium text-right">Stock</th>
                      <th className="py-3 px-4 font-medium text-right">Cost Value</th>
                      <th className="py-3 px-4 font-medium text-right">Retail Value</th>
                      <th className="py-3 px-4 font-medium text-right">Unit Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {analytics.inventoryHealth.map((item) => {
                      const marginPct =
                        item.sellingPrice > 0
                          ? (((item.sellingPrice - item.purchasePrice) / item.sellingPrice) * 100).toFixed(1)
                          : '0.0';
                      return (
                        <tr key={item.sku} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.025] transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
                            <p className="text-xs text-slate-500 dark:text-[#A7B4C7] font-mono">{item.sku}</p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                            {item.stockQty}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-[#A7B4C7]">
                            {formatCurrency(item.costValue, currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(item.retailValue, currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-500 font-semibold">
                            {marginPct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
