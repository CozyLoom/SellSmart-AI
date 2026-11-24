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

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <WorkspaceRouter />
      </AuthProvider>
    </ToastProvider>
  );
}
