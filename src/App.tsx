/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { SalesPage } from './pages/SalesPage';
import { OrdersPage } from './pages/OrdersPage';
import { CustomersPage } from './pages/CustomersPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { MarketingStudioPage } from './pages/MarketingStudioPage';
import { PosterCreatorPage } from './pages/PosterCreatorPage';
import { AdvisorPage } from './pages/AdvisorPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BillingPage } from './pages/BillingPage';
import { SettingsPage } from './pages/SettingsPage';
import type { NavSection } from './types';

const WorkspaceRouter: React.FC = () => {
  const { user, business, loading } = useAuth();
  const [section, setSection] = useState<NavSection>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#071426] text-white flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#287BFF] to-[#22D3EE] flex items-center justify-center font-bold text-lg animate-pulse">
          S
        </div>
        <p className="text-xs text-[#A7B4C7]">Loading SellSmart AI workspace...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!business) {
    return <AuthPage onboardingOnly />;
  }

  return (
    <AppShell activeSection={section} onNavigate={setSection}>
      {section === 'dashboard' && <DashboardPage onNavigate={setSection} />}
      {section === 'inventory' && <InventoryPage />}
      {section === 'sales' && <SalesPage />}
      {section === 'orders' && <OrdersPage />}
      {section === 'customers' && <CustomersPage />}
      {section === 'invoices' && <InvoicesPage />}
      {section === 'marketing' && <MarketingStudioPage />}
      {section === 'posters' && <PosterCreatorPage />}
      {section === 'advisor' && <AdvisorPage />}
      {section === 'analytics' && <AnalyticsPage />}
      {section === 'billing' && <BillingPage />}
      {section === 'settings' && <SettingsPage />}
    </AppShell>
  );
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unexpected rendering error.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#071426] text-white flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#12243D] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#287BFF] to-[#22D3EE] flex items-center justify-center font-bold text-lg">
                S
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">SellSmart AI</h1>
                <p className="text-xs text-[#A7B4C7]">Workspace Recovery</p>
              </div>
            </div>
            <p className="text-sm text-[#CBD5E1] leading-relaxed mb-4">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[42px] rounded-xl bg-[#287BFF] hover:brightness-110 text-sm font-semibold text-white transition-all"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <WorkspaceRouter />
        </AuthProvider>
      </ToastProvider>
    </AppErrorBoundary>
  );
}
