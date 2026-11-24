import { db, nowIso, uid } from './db.ts';

function daysAgoIso(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function daysAheadIso(daysAhead: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

export function seedDemoWorkspaceData(businessId: string) {
  // Wipe existing business records cleanly before loading demo records
  db.prepare('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE business_id = ?)').run(businessId);
  db.prepare('DELETE FROM invoices WHERE business_id = ?').run(businessId);
  db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id = ?)').run(businessId);
  db.prepare('DELETE FROM orders WHERE business_id = ?').run(businessId);
  db.prepare('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE business_id = ?)').run(businessId);
  db.prepare('DELETE FROM sales WHERE business_id = ?').run(businessId);
  db.prepare('DELETE FROM inventory_movements WHERE business_id = ?').run(businessId);
  db.prepare('DELETE FROM expenses WHERE business_id = ?').run(businessId);
  db.prepare('DELETE FROM products WHERE business_id = ?').run(businessId);
  db.prepare('DELETE FROM categories WHERE business_id = ?').run(businessId);
  db.prepare('DELETE FROM customers WHERE business_id = ?').run(businessId);

  const created = nowIso();
  db.prepare('UPDATE businesses SET is_demo = 1 WHERE id = ?').run(businessId);

  const catLeather = uid('cat');
  const catAudio = uid('cat');
  const catBeauty = uid('cat');
  const catAccessories = uid('cat');

  const insertCat = db.prepare('INSERT INTO categories (id, business_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)');
  insertCat.run(catLeather, businessId, 'Leather Goods', 'Handcrafted bags and travel totes', created);
  insertCat.run(catAudio, businessId, 'Consumer Electronics', 'Wireless audio and personal tech', created);
  insertCat.run(catBeauty, businessId, 'Botanical Skincare', 'Serums and clean beauty formulations', created);
  insertCat.run(catAccessories, businessId, 'Everyday Essentials', 'Compact lifestyle accessories', created);

  const prodTote = uid('prd');
  const prodHeadphones = uid('prd');
  const prodSerum = uid('prd');
  const prodWatch = uid('prd');
  const prodSleeve = uid('prd');
  const prodCharger = uid('prd');
  const prodMist = uid('prd');

  const insertProd = db.prepare(`
    INSERT INTO products (
      id, business_id, category_id, name, sku, purchase_price, selling_price,
      stock_qty, low_stock_threshold, image_url, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertProd.run(
    prodTote, businessId, catLeather, 'Aurore Cognac Leather Tote', 'LTH-TOT-001',
    72, 168, 18, 6, '/src/assets/images/demo_leather_tote_1795504837446.jpg',
    'Full-grain vegetable-tanned leather work tote with brass hardware and laptop sleeve.', created, created
  );
  insertProd.run(
    prodHeadphones, businessId, catAudio, 'Sonic Navy Studio Headphones', 'ELC-AUD-014',
    85, 195, 4, 5, '/src/assets/images/demo_wireless_headphones_1795504836948.jpg',
    'Active noise cancelling wireless over-ear headphones with 40-hour battery.', created, created
  );
  insertProd.run(
    prodSerum, businessId, catBeauty, 'Botanical Calm Facial Serum', 'BTY-SRM-009',
    14, 42, 34, 10, '/src/assets/images/demo_skincare_serum_1795504835979.jpg',
    '30ml hydrating botanical serum in frosted UV-protective amber glass.', created, created
  );
  insertProd.run(
    prodWatch, businessId, catAccessories, 'Chronos Brushed Titanium Watch', 'ACC-WTC-007',
    140, 320, 9, 4, '/src/assets/images/demo_luxury_watch_1795511633549.jpg',
    'Grade-5 brushed titanium chronograph with sapphire crystal and 100m water resistance.', created, created
  );
  insertProd.run(
    prodSleeve, businessId, catAccessories, 'Minimalist Wool Laptop Sleeve', 'ACC-SLV-022',
    18, 49, 2, 5, '',
    'Merino felt protective sleeve for 14-inch laptops.', created, created
  );
  insertProd.run(
    prodCharger, businessId, catAudio, '65W GaN Fast Travel Adapter', 'ELC-PWR-031',
    16, 44, 0, 5, '',
    'Dual USB-C compact GaN international travel charger.', created, created
  );
  insertProd.run(
    prodMist, businessId, catBeauty, 'Rosewater Mineral Mist 100ml', 'BTY-MST-012',
    9, 28, 22, 8, '',
    'Refreshing daily facial toning mist.', created, created
  );

  const insertMov = db.prepare(`
    INSERT INTO inventory_movements (
      id, business_id, product_id, movement_type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMov.run(uid('mov'), businessId, prodTote, 'initial', 22, 0, 22, 'Opening demo stock', '', created);
  insertMov.run(uid('mov'), businessId, prodHeadphones, 'initial', 10, 0, 10, 'Opening demo stock', '', created);
  insertMov.run(uid('mov'), businessId, prodSerum, 'initial', 45, 0, 45, 'Opening demo stock', '', created);

  const cust1 = uid('cus');
  const cust2 = uid('cus');
  const cust3 = uid('cus');
  const cust4 = uid('cus');

  const insertCust = db.prepare(`
    INSERT INTO customers (id, business_id, name, phone, email, address, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCust.run(cust1, businessId, 'Amara Okafor', '+1 415 890 2311', 'amara.okafor@example.com', '410 Market St, San Francisco, CA', 'VIP repeat buyer, prefers express delivery.', created);
  insertCust.run(cust2, businessId, 'Daniel Lindqvist', '+44 7700 900123', 'd.lindqvist@example.co.uk', '18 Clerkenwell Rd, London', 'Corporate gifting account.', created);
  insertCust.run(cust3, businessId, 'Grace Namukasa', '+256 772 410 890', 'grace.n@example.ug', 'Plot 14 Kololo Hill, Kampala', 'Boutique wholesale buyer.', created);
  insertCust.run(cust4, businessId, 'Sofia Mendoza', '+34 612 345 678', 'sofia.m@example.es', 'Calle Serrano 45, Madrid', 'Skincare subscription inquiries.', created);

  // Create realistic sales over the past 45 days
  const saleSeeds = [
    { daysAgo: 0, cust: cust1, num: 'SL-1042', method: 'Card', status: 'paid', items: [{ id: prodTote, name: 'Aurore Cognac Leather Tote', qty: 1, price: 168, cost: 72 }, { id: prodSerum, name: 'Botanical Calm Facial Serum', qty: 2, price: 42, cost: 14 }], discount: 10, paid: 242 },
    { daysAgo: 2, cust: cust2, num: 'SL-1041', method: 'Bank Transfer', status: 'paid', items: [{ id: prodHeadphones, name: 'Sonic Navy Studio Headphones', qty: 2, price: 195, cost: 85 }], discount: 0, paid: 390 },
    { daysAgo: 5, cust: cust3, num: 'SL-1040', method: 'Mobile Money', status: 'partial', items: [{ id: prodSerum, name: 'Botanical Calm Facial Serum', qty: 5, price: 42, cost: 14 }, { id: prodMist, name: 'Rosewater Mineral Mist 100ml', qty: 4, price: 28, cost: 9 }], discount: 12, paid: 200 },
    { daysAgo: 9, cust: cust1, num: 'SL-1039', method: 'Card', status: 'paid', items: [{ id: prodHeadphones, name: 'Sonic Navy Studio Headphones', qty: 1, price: 195, cost: 85 }, { id: prodSleeve, name: 'Minimalist Wool Laptop Sleeve', qty: 1, price: 49, cost: 18 }], discount: 0, paid: 244 },
    { daysAgo: 14, cust: cust4, num: 'SL-1038', method: 'Card', status: 'paid', items: [{ id: prodTote, name: 'Aurore Cognac Leather Tote', qty: 2, price: 168, cost: 72 }], discount: 16, paid: 320 },
    { daysAgo: 21, cust: cust2, num: 'SL-1037', method: 'Bank Transfer', status: 'paid', items: [{ id: prodHeadphones, name: 'Sonic Navy Studio Headphones', qty: 3, price: 195, cost: 85 }], discount: 25, paid: 560 },
    { daysAgo: 32, cust: cust3, num: 'SL-1036', method: 'Cash', status: 'paid', items: [{ id: prodTote, name: 'Aurore Cognac Leather Tote', qty: 1, price: 168, cost: 72 }, { id: prodSerum, name: 'Botanical Calm Facial Serum', qty: 4, price: 42, cost: 14 }], discount: 0, paid: 336 },
  ];

  const insertSale = db.prepare(`
    INSERT INTO sales (
      id, business_id, customer_id, sale_number, subtotal, discount, tax_amount,
      total_amount, amount_paid, payment_method, payment_status, total_cogs, gross_profit,
      notes, sale_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of saleSeeds) {
    const saleId = uid('sal');
    const subtotal = s.items.reduce((acc, i) => acc + i.qty * i.price, 0);
    const totalCogs = s.items.reduce((acc, i) => acc + i.qty * i.cost, 0);
    const totalAmount = Math.max(0, subtotal - s.discount);
    const grossProfit = totalAmount - totalCogs;
    const dateStr = daysAgoIso(s.daysAgo);

    insertSale.run(
      saleId, businessId, s.cust, s.num, subtotal, s.discount, 0, totalAmount, s.paid,
      s.method, s.status, totalCogs, grossProfit, 'Recorded in Demo Workspace', dateStr, `${dateStr}T10:30:00Z`
    );
    for (const item of s.items) {
      insertSaleItem.run(uid('sli'), saleId, item.id, item.name, item.qty, item.price, item.cost, item.qty * item.price);
    }
  }

  // Expenses
  const insertExpense = db.prepare(`
    INSERT INTO expenses (id, business_id, category, title, amount, expense_date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertExpense.run(uid('exp'), businessId, 'Marketing', 'Instagram & TikTok Product Ads', 145, daysAgoIso(3), 'Seasonal launch campaign', created);
  insertExpense.run(uid('exp'), businessId, 'Shipping & Logistics', 'DHL International Express Parcels', 92, daysAgoIso(7), 'Customer order dispatches', created);
  insertExpense.run(uid('exp'), businessId, 'Operations', 'Studio Packaging & Kraft Boxes', 68, daysAgoIso(15), 'Branded tissue & mailers', created);
  insertExpense.run(uid('exp'), businessId, 'Rent & Utilities', 'Showroom & Storage Utility Share', 240, daysAgoIso(28), 'Monthly allocation', created);

  // Orders across statuses
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, business_id, customer_id, order_number, status, total_amount, inventory_deducted, notes, order_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const ord1 = uid('ord');
  insertOrder.run(ord1, businessId, cust4, 'ORD-2081', 'pending', 210, 0, 'Awaiting bank confirmation', daysAgoIso(0), created, created);
  insertOrderItem.run(uid('ori'), ord1, prodTote, 'Aurore Cognac Leather Tote', 1, 168, 72, 168);
  insertOrderItem.run(uid('ori'), ord1, prodSerum, 'Botanical Calm Facial Serum', 1, 42, 14, 42);

  const ord2 = uid('ord');
  insertOrder.run(ord2, businessId, cust1, 'ORD-2080', 'dispatched', 244, 1, 'Courier tracking #TRK88412', daysAgoIso(1), created, created);
  insertOrderItem.run(uid('ori'), ord2, prodHeadphones, 'Sonic Navy Studio Headphones', 1, 195, 85, 195);
  insertOrderItem.run(uid('ori'), ord2, prodSleeve, 'Minimalist Wool Laptop Sleeve', 1, 49, 18, 49);

  const ord3 = uid('ord');
  insertOrder.run(ord3, businessId, cust2, 'ORD-2079', 'completed', 390, 1, 'Delivered and signed', daysAgoIso(4), created, created);
  insertOrderItem.run(uid('ori'), ord3, prodHeadphones, 'Sonic Navy Studio Headphones', 2, 195, 85, 390);

  // Invoices
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      id, business_id, customer_id, invoice_number, invoice_date, due_date,
      subtotal, discount, tax_rate, tax_amount, total_amount, amount_paid, payment_status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertInvoiceItem = db.prepare(`
    INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const inv1 = uid('inv');
  insertInvoice.run(inv1, businessId, cust3, 'INV-2026-019', daysAgoIso(5), daysAheadIso(10), 322, 12, 0, 0, 310, 200, 'partial', 'Balance due within 14 days via Mobile Money or Bank Transfer.', created);
  insertInvoiceItem.run(uid('ini'), inv1, prodSerum, 'Botanical Calm Facial Serum (30ml)', 5, 42, 210);
  insertInvoiceItem.run(uid('ini'), inv1, prodMist, 'Rosewater Mineral Mist 100ml', 4, 28, 112);

  const inv2 = uid('inv');
  insertInvoice.run(inv2, businessId, cust2, 'INV-2026-018', daysAgoIso(12), daysAheadIso(2), 390, 0, 5, 19.5, 409.5, 409.5, 'paid', 'Paid in full via Bank Transfer.', created);
  insertInvoiceItem.run(uid('ini'), inv2, prodHeadphones, 'Sonic Navy Studio Headphones', 2, 195, 390);
}
