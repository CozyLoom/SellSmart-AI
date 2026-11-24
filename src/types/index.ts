export type SupportedCurrency = 'USD' | 'UGX' | 'EUR' | 'GBP' | 'KES' | 'TZS' | 'NGN' | 'ZAR';

export type BusinessCategory =
  | 'Fashion and clothing'
  | 'Electronics'
  | 'Beauty and cosmetics'
  | 'Food and beverages'
  | 'Supermarkets and retail'
  | 'Digital products'
  | 'Home and furniture'
  | 'General merchandise'
  | 'Other';

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'dispatched' | 'completed' | 'cancelled';

export type PlanTier = 'free' | 'pro' | 'business';

export type NavSection =
  | 'dashboard'
  | 'marketing'
  | 'posters'
  | 'inventory'
  | 'sales'
  | 'orders'
  | 'customers'
  | 'invoices'
  | 'advisor'
  | 'analytics'
  | 'billing'
  | 'settings';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  authProvider: string;
  createdAt: string;
}

export interface BusinessProfile {
  id: string;
  ownerUserId: string;
  name: string;
  category: BusinessCategory | string;
  country: string;
  currency: SupportedCurrency;
  timezone: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  logoUrl: string;
  taxRate: number;
  isDemo: boolean;
  createdAt: string;
}

export interface BusinessSettings {
  businessId: string;
  dateFormat: string;
  numberFormat: string;
  invoicePrefix: string;
  orderPrefix: string;
  themePreference: 'dark' | 'light';
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  categoryId: string | null;
  categoryName?: string;
  name: string;
  sku: string;
  purchasePrice: number;
  sellingPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  imageUrl: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  businessId: string;
  productId: string;
  productName?: string;
  movementType: 'initial' | 'restock' | 'sale' | 'order' | 'order_restore' | 'adjustment';
  quantityChange: number;
  previousQty: number;
  newQty: number;
  reason: string;
  referenceId: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  totalPurchases: number;
  orderCount: number;
  outstandingBalance: number;
  lastPurchaseDate: string | null;
  createdAt: string;
}

export interface SaleItem {
  id?: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  businessId: string;
  customerId: string | null;
  customerName?: string;
  saleNumber: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  totalCogs: number;
  grossProfit: number;
  notes: string;
  saleDate: string;
  createdAt: string;
  items: SaleItem[];
}

export interface Expense {
  id: string;
  businessId: string;
  category: string;
  title: string;
  amount: number;
  expenseDate: string;
  notes: string;
  createdAt: string;
}

export interface OrderItem {
  id?: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  businessId: string;
  customerId: string | null;
  customerName?: string;
  customerPhone?: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  inventoryDeducted: boolean;
  notes: string;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface InvoiceItem {
  id?: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  businessId: string;
  customerId: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'overdue';
  notes: string;
  createdAt: string;
  items: InvoiceItem[];
}

export interface AIGeneration {
  id: string;
  businessId: string;
  generationType: string;
  platform: string;
  tone: string;
  style: string;
  promptSummary: string;
  outputText: string;
  metadataJson: Record<string, unknown>;
  createdAt: string;
}

export interface SubscriptionInfo {
  planTier: PlanTier;
  billingCycle: 'monthly' | 'annual';
  status: 'active' | 'cancelled' | 'past_due';
  priceUsd: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  provider: string;
  usage: {
    periodMonth: string;
    aiGenerationsCount: number;
    aiGenerationsLimit: number;
    invoicesCount: number;
    invoicesLimit: number | null;
    productsCount: number;
    productsLimit: number | null;
  };
  paymentGatewayConfigured: boolean;
  paymentHistory: {
    id: string;
    amountUsd: number;
    currency: string;
    status: string;
    description: string;
    createdAt: string;
  }[];
}

export interface DashboardSummary {
  metrics: {
    grossRevenue: number;
    cashCollected: number;
    outstandingPayments: number;
    cogs: number;
    grossProfit: number;
    totalExpenses: number;
    netProfit: number;
    totalOrders: number;
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    inventoryCostValue: number;
  };
  chartSeries: {
    label: string;
    revenue: number;
    expenses: number;
    netProfit: number;
  }[];
  monthlySeries: {
    month: string;
    revenue: number;
    profit: number;
    expenses: number;
  }[];
  topProducts: {
    productId: string | null;
    name: string;
    unitsSold: number;
    revenue: number;
  }[];
  lowStockProducts: Product[];
  recentSales: Sale[];
  recentOrders: Order[];
}
