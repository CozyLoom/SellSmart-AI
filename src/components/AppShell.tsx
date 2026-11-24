import React, { useState } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  Image as ImageIcon,
  Package,
  BadgeDollarSign,
  ShoppingBag,
  Users,
  FileText,
  Bot,
  BarChart3,
  CreditCard,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  FlaskConical,
} from 'lucide-react';
import type { NavSection } from '../types';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';
import { ConfirmDialog } from './ConfirmDialog';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';

interface NavItem {
  id: NavSection;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
  group: 'Core' | 'AI Suite' | 'Operations' | 'Account';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, group: 'Core' },
  { id: 'inventory', label: 'Products & Inventory', shortLabel: 'Products', icon: Package, group: 'Core' },
  { id: 'sales', label: 'Sales & Profit', shortLabel: 'Sales', icon: BadgeDollarSign, group: 'Core' },
  { id: 'orders', label: 'Order Management', shortLabel: 'Orders', icon: ShoppingBag, group: 'Core' },
  { id: 'marketing', label: 'AI Marketing Studio', shortLabel: 'Marketing', icon: Sparkles, group: 'AI Suite' },
  { id: 'posters', label: 'AI Poster Creator', shortLabel: 'Posters', icon: ImageIcon, group: 'AI Suite' },
  { id: 'advisor', label: 'AI Business Advisor', shortLabel: 'Advisor', icon: Bot, group: 'AI Suite' },
  { id: 'customers', label: 'Customers', shortLabel: 'Customers', icon: Users, group: 'Operations' },
  { id: 'invoices', label: 'Invoice Generator', shortLabel: 'Invoices', icon: FileText, group: 'Operations' },
  { id: 'analytics', label: 'Analytics & Reports', shortLabel: 'Analytics', icon: BarChart3, group: 'Operations' },
  { id: 'billing', label: 'Subscription & Billing', shortLabel: 'Billing', icon: CreditCard, group: 'Account' },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings, group: 'Account' },
];

interface AppShellProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ activeSection, onNavigate, children }) => {
  const { user, business, theme, toggleTheme, logout, setBusiness } = useAuth();
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clearDemoConfirm, setClearDemoConfirm] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);

  const activeNav = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];
  const groups: NavItem['group'][] = ['Core', 'AI Suite', 'Operations', 'Account'];

  const handleClearDemo = async () => {
    setClearingDemo(true);
    try {
      const res = await apiRequest<{ business: typeof business }>('/api/business/clear-data', { method: 'POST' });
      if (res.business) setBusiness(res.business);
      showToast('Demo records cleared. Your workspace is now empty and ready for real data.', 'success');
      setClearDemoConfirm(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear demo data', 'error');
    } finally {
      setClearingDemo(false);
    }
  };

  return (
    <div className="min-h-screen flex app-canvas-bg text-slate-900 dark:text-white">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-slate-200/90 dark:border-white/[0.08] bg-white/95 dark:bg-[#0A172B]/95 backdrop-blur-xl transition-[width] duration-200 no-print ${
          collapsed ? 'w-[78px]' : 'w-[264px]'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/85 dark:border-white/[0.08]">
          {!collapsed ? (
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2.5 text-left min-w-0"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#287BFF] to-[#22D3EE] ring-1 ring-inset ring-white/25 shadow-sm flex items-center justify-center text-white font-bold text-sm shrink-0">
                S
              </div>
              <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap truncate">
                SellSmart AI
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              aria-label="SellSmart AI Home"
              className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-br from-[#287BFF] to-[#22D3EE] ring-1 ring-inset ring-white/25 shadow-sm flex items-center justify-center text-white font-bold text-sm"
            >
              S
            </button>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="p-2 rounded-lg text-slate-500 dark:text-[#A7B4C7] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="px-3 pt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className="p-2 rounded-lg text-slate-500 dark:text-[#A7B4C7] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group}>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[11px] font-medium text-slate-400 dark:text-[#A7B4C7]/65">
                  {group}
                </div>
              )}
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full min-h-[40px] flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-gradient-to-r from-[#287BFF] to-[#1E68E6] text-white border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_6px_16px_-6px_rgba(40,123,255,0.55)]'
                          : 'border border-transparent text-slate-600 dark:text-[#A7B4C7] hover:bg-slate-100/90 dark:hover:bg-white/[0.05] hover:border-slate-200/70 dark:hover:border-white/[0.06] hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200/85 dark:border-white/[0.08] space-y-2">
          {!collapsed && business && (
            <div className="surface-well px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{business.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-[#A7B4C7] truncate mt-0.5">
                {business.currency} · {business.country}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full min-h-[40px] flex items-center justify-center lg:justify-start gap-3 px-3 py-2 rounded-xl border border-transparent text-sm font-medium text-slate-600 dark:text-[#A7B4C7] hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-500 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 px-4 lg:px-8 flex items-center justify-between gap-6 border-b border-slate-200/85 dark:border-white/[0.08] bg-white/85 dark:bg-[#0A172B]/85 backdrop-blur-xl no-print">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden w-7 h-7 rounded-lg bg-gradient-to-br from-[#287BFF] to-[#22D3EE] ring-1 ring-inset ring-white/25 flex items-center justify-center text-white font-bold text-xs shrink-0">
              S
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-base lg:text-lg text-slate-900 dark:text-white truncate">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {business && (
              <span className="hidden sm:inline text-xs text-slate-500 dark:text-[#A7B4C7] whitespace-nowrap">
                {business.name} · {business.currency}
              </span>
            )}
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200/90 dark:border-white/[0.1] bg-white dark:bg-[#0E2038] text-slate-600 dark:text-[#A7B4C7] hover:border-[#287BFF]/50 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {user && (
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="hidden sm:flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200/90 dark:border-white/[0.1] bg-white dark:bg-[#0E2038] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-white hover:border-[#287BFF]/50 transition-colors whitespace-nowrap"
              >
                <span className="w-6 h-6 rounded-full bg-[#287BFF]/15 text-[#287BFF] dark:text-[#22D3EE] ring-1 ring-inset ring-[#287BFF]/30 flex items-center justify-center font-semibold text-xs">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[120px] truncate">{user.fullName}</span>
              </button>
            )}
          </div>
        </header>

        {/* Explicit Demo Mode Notice Banner */}
        {business?.isDemo && (
          <div className="px-4 lg:px-8 py-2.5 bg-amber-500/10 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <FlaskConical className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <strong>Demo Mode Active</strong> — Displaying sample business records so you can test every feature.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setClearDemoConfirm(true)}
              className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-100 font-medium transition-colors whitespace-nowrap"
            >
              Clear Demo Data
            </button>
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-10 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-slate-200/85 dark:border-white/[0.08] bg-white/95 dark:bg-[#0A172B]/95 backdrop-blur-md grid grid-cols-5 items-center no-print shadow-[0_-8px_24px_-12px_rgba(7,20,38,0.18)]"
      >
        {(['dashboard', 'inventory', 'sales', 'orders'] as NavSection[]).map((id) => {
          const item = NAV_ITEMS.find((n) => n.id === id)!;
          const Icon = item.icon;
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate(id);
              }}
              className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-[#287BFF] dark:text-[#22D3EE]' : 'text-slate-500 dark:text-[#A7B4C7]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
            mobileMenuOpen ? 'text-[#287BFF] dark:text-[#22D3EE]' : 'text-slate-500 dark:text-[#A7B4C7]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile More Drawer Sheet */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-[#071426]/70 backdrop-blur-sm">
          <div className="rounded-t-3xl border-t border-slate-200/85 dark:border-white/[0.1] bg-white dark:bg-[#0B192E] p-5 max-h-[82vh] overflow-y-auto shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-display font-semibold text-base text-slate-900 dark:text-white">All Workspace Tools</p>
                {business && (
                  <p className="text-xs text-slate-500 dark:text-[#A7B4C7]">
                    {business.name} · {business.currency}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 dark:text-[#A7B4C7] hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`min-h-[48px] flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                      active
                        ? 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] border-[#287BFF]/70 text-white shadow-[0_8px_20px_-6px_rgba(40,123,255,0.5)]'
                        : 'surface-well text-slate-700 dark:text-white hover:border-[#287BFF]/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3">
              <PWAInstallButton />
              <button
                type="button"
                onClick={() => void logout()}
                className="min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />

      <ConfirmDialog
        open={clearDemoConfirm}
        title="Clear Demo Data?"
        description="This removes all sample products, sales, orders, customers, and invoices so you can start entering your real business records."
        confirmLabel="Clear Demo Data"
        busy={clearingDemo}
        onConfirm={() => void handleClearDemo()}
        onCancel={() => setClearDemoConfirm(false)}
      />
    </div>
  );
};
