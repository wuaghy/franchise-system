import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Franchise Frontend Enterprise Suite', () => {
  it('should initialize and validate API client types', () => {
    const payload = {
      storeId: '00000000-0000-0000-0000-000000000001',
      orderType: 1,
      paymentMethod: 0,
      items: [
        {
          productId: '00000000-0000-0000-0000-000000000002',
          quantity: 2,
          modifiers: [
            {
              name: 'Black Pearl',
              extraPrice: 10000,
              consumptionQuantity: 25,
            },
          ],
        },
      ],
    };

    assert.ok(payload.storeId);
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].modifiers?.[0].consumptionQuantity, 25);
  });

  it('calculates VAT and total prices accurately', () => {
    const subtotal = 100000;
    const vatRate = 0.08;
    const vatAmount = Math.round(subtotal * vatRate);
    const total = subtotal + vatAmount;

    assert.equal(vatAmount, 8000);
    assert.equal(total, 108000);
  });

  it('calculates Stock Transfer discrepancy accurately', () => {
    const item = {
      ingredientName: 'Cà phê Robusta Hạt',
      requestedQuantity: 50,
      approvedQuantity: 40,
      actualReceivedQuantity: 37,
    };
    const discrepancy = item.approvedQuantity - item.actualReceivedQuantity;
    const isDiscrepant = discrepancy !== 0;

    assert.equal(discrepancy, 3);
    assert.equal(isDiscrepant, true);
  });

  it('determines KDS SLA status thresholds correctly', () => {
    const calculateSla = (elapsedSeconds: number, targetPreparationSeconds = 300) => {
      if (elapsedSeconds <= 180) return 'Healthy';
      if (elapsedSeconds <= targetPreparationSeconds) return 'Warning';
      return 'Critical';
    };

    assert.equal(calculateSla(120), 'Healthy');
    assert.equal(calculateSla(180), 'Healthy');
    assert.equal(calculateSla(220), 'Warning');
    assert.equal(calculateSla(300), 'Warning');
    assert.equal(calculateSla(301), 'Critical');
    assert.equal(calculateSla(450), 'Critical');
  });

  it('validates KDS ticket item prepared toggle logic', () => {
    const items = [
      { id: '1', productName: 'Phin Sữa Đá', isPrepared: false },
      { id: '2', productName: 'Trà Sen Vàng', isPrepared: true }
    ];

    const toggled = items.map(item => item.id === '1' ? { ...item, isPrepared: !item.isPrepared } : item);
    assert.equal(toggled[0].isPrepared, true);
    assert.equal(toggled.every(i => i.isPrepared), true);
  });

  it('calculates franchise royalty and marketing fees correctly', () => {
    const grossRevenue = 100_000_000;
    const discountAmount = 10_000_000;
    const netRevenue = grossRevenue - discountAmount; // 90M
    const royaltyRate = 0.05; // 5%
    const marketingRate = 0.02; // 2%
    const techFee = 2_000_000;

    const royaltyFee = Math.round(netRevenue * royaltyRate);
    const marketingFee = Math.round(netRevenue * marketingRate);
    const totalDue = royaltyFee + marketingFee + techFee;

    assert.equal(royaltyFee, 4_500_000);
    assert.equal(marketingFee, 1_800_000);
    assert.equal(totalDue, 8_300_000);
  });

  it('identifies F&B peak hours correctly', () => {
    const isPeakHour = (hour: number) => [7, 8, 9, 11, 12, 13, 18, 19, 20, 21].includes(hour);

    assert.equal(isPeakHour(8), true);  // Morning coffee rush
    assert.equal(isPeakHour(12), true); // Lunch rush
    assert.equal(isPeakHour(19), true); // Evening rush
    assert.equal(isPeakHour(3), false);  // Overnight
    assert.equal(isPeakHour(15), false); // Mid afternoon
  });

  it('validates offline order queueing and serialization logic', () => {
    const offlineOrder = {
      offlineOrderId: 'OFF-1728211200000',
      idempotencyKey: 'POS-OFF-OFF-1728211200000',
      storeId: '00000000-0000-0000-0000-000000000001',
      paymentMethod: 0,
      orderType: 1,
      subtotal: 50000,
      discountAmount: 0,
      vatAmount: 4000,
      finalAmount: 54000,
      offlineCreatedAt: new Date().toISOString(),
      items: [
        {
          productId: '00000000-0000-0000-0000-000000000002',
          quantity: 2,
          unitPrice: 25000,
          specialNote: 'M'
        }
      ]
    };

    const serialized = JSON.stringify([offlineOrder]);
    const parsed = JSON.parse(serialized);

    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].finalAmount, 54000);
    assert.equal(parsed[0].items[0].quantity, 2);
    assert.ok(parsed[0].idempotencyKey.startsWith('POS-OFF-'));
  });

  it('verifies offline sync result status filtering and queue clearing', () => {
    const queue = [
      { offlineOrderId: 'OFF-1', finalAmount: 30000 },
      { offlineOrderId: 'OFF-2', finalAmount: 45000 },
      { offlineOrderId: 'OFF-3', finalAmount: 60000 }
    ];

    const syncResults = [
      { offlineOrderId: 'OFF-1', status: 'Synced' },
      { offlineOrderId: 'OFF-2', status: 'DuplicateSkipped' },
      { offlineOrderId: 'OFF-3', status: 'Failed' }
    ];

    // Các đơn Synced hoặc DuplicateSkipped được dọn khỏi hàng đợi
    const processedIds = new Set(
      syncResults
        .filter(r => r.status === 'Synced' || r.status === 'DuplicateSkipped')
        .map(r => r.offlineOrderId)
    );

    const remainingQueue = queue.filter(item => !processedIds.has(item.offlineOrderId));

    assert.equal(remainingQueue.length, 1);
    assert.equal(remainingQueue[0].offlineOrderId, 'OFF-3');
  });

  it('generates compliant VietQR Napas quicklink URL with exact bank details', () => {
    const bankCode = 'vietinbank';
    const accountNumber = '100878137043';
    const accountName = 'NGUYEN QUANG HUY';
    const amount = 85000;
    const orderCode = 'ORD-20261006-001';

    const buildVietQrUrl = (bank: string, acc: string, amt: number, code: string, name: string) => {
      const encodedName = encodeURIComponent(name);
      return `https://img.vietqr.io/image/${bank}-${acc}-compact2.png?amount=${amt}&addInfo=${code}&accountName=${encodedName}`;
    };

    const url = buildVietQrUrl(bankCode, accountNumber, amount, orderCode, accountName);

    assert.ok(url.startsWith('https://img.vietqr.io/image/vietinbank-100878137043-compact2.png'));
    assert.ok(url.includes('amount=85000'));
    assert.ok(url.includes('addInfo=ORD-20261006-001'));
    assert.ok(url.includes('accountName=NGUYEN%20QUANG%20HUY'));
  });

  it('validates 6-digit OTP formatting and email regex', () => {
    const sanitizeOtp = (raw: string) => raw.replace(/\D/g, '').slice(0, 6);
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    assert.equal(sanitizeOtp('123-456'), '123456');
    assert.equal(sanitizeOtp('abc987654321'), '987654');
    assert.equal(sanitizeOtp('4829'), '4829');

    assert.equal(isValidEmail('nguyenquanghuy14022005@gmail.com'), true);
    assert.equal(isValidEmail('invalid-email-address'), false);
    assert.equal(isValidEmail('admin@franchise.local'), true);
  });

  it('manages audio notification settings and volume bounds properly', () => {
    interface AudioSettings {
      soundEnabled: boolean;
      speechEnabled: boolean;
      volume: number;
    }

    const clampVolume = (vol: number) => Math.max(0, Math.min(1, vol));

    const defaultSettings: AudioSettings = {
      soundEnabled: true,
      speechEnabled: false,
      volume: 0.85,
    };

    assert.equal(defaultSettings.soundEnabled, true);
    assert.equal(clampVolume(1.5), 1.0);
    assert.equal(clampVolume(-0.2), 0.0);
    assert.equal(clampVolume(0.5), 0.5);
  });

  it('formats announcement toast messages and unread counter accurately', () => {
    interface SystemNotification {
      id: string;
      title: string;
      detail: string;
      isRead: boolean;
      type: 'order' | 'alert' | 'kds';
    }

    const notifications: SystemNotification[] = [
      { id: '1', title: 'Đơn mới #ORD-001', detail: '85,000 đ', isRead: false, type: 'order' },
      { id: '2', title: 'Cảnh báo Robusta', detail: 'Còn 1.5kg', isRead: false, type: 'alert' },
      { id: '3', title: 'Hệ thống sẵn sàng', detail: 'SignalR connected', isRead: true, type: 'kds' },
    ];

    const unreadCount = notifications.filter(n => !n.isRead).length;
    assert.equal(unreadCount, 2);

    const markedAll = notifications.map(n => ({ ...n, isRead: true }));
    assert.equal(markedAll.filter(n => !n.isRead).length, 0);
  });

  it('correctly maps screens to role-based portals (Customer, Staff, Admin, Landing)', () => {
    type Screen = "landing" | "customer" | "stores" | "inventory" | "transfers" | "bom-studio" | "pos" | "kds" | "analytics";
    type Portal = "landing" | "customer" | "staff" | "admin";

    const getPortalForScreen = (s: Screen): Portal => {
      if (s === "landing") return "landing";
      if (s === "customer") return "customer";
      if (s === "pos" || s === "kds" || s === "transfers") return "staff";
      return "admin";
    };

    assert.equal(getPortalForScreen("landing"), "landing");
    assert.equal(getPortalForScreen("customer"), "customer");
    assert.equal(getPortalForScreen("pos"), "staff");
    assert.equal(getPortalForScreen("kds"), "staff");
    assert.equal(getPortalForScreen("transfers"), "staff");
    assert.equal(getPortalForScreen("stores"), "admin");
    assert.equal(getPortalForScreen("analytics"), "admin");
    assert.equal(getPortalForScreen("bom-studio"), "admin");
    assert.equal(getPortalForScreen("inventory"), "admin");
  });

  it('strictly enforces role permissions for POS_Cashier, Store_Manager, Supply_Chain, HQ_SuperAdmin, and Guest', async () => {
    const {
      canAccessScreen,
      canAccessPortal,
      getDefaultScreenForUser,
      filterStaffNavItems,
      filterAdminNavItems,
    } = await import('./services/rbac.ts');

    const guestUser = null;
    const cashierUser = {
      id: '1',
      username: 'cashier_q1',
      email: 'cashier@franchise.local',
      fullName: 'Cashier Lê Lợi',
      role: 'POS_Cashier',
      isActive: true,
    };
    const managerUser = {
      id: '2',
      username: 'manager_q1',
      email: 'manager@franchise.local',
      fullName: 'Manager Lê Lợi',
      role: 'Store_Manager',
      isActive: true,
    };
    const supplyChainUser = {
      id: '3',
      username: 'supply_officer',
      email: 'supply@franchise.local',
      fullName: 'Supply Chain Officer',
      role: 'Supply_Chain_Officer',
      isActive: true,
    };
    const adminUser = {
      id: '4',
      username: 'admin',
      email: 'admin@franchise.local',
      fullName: 'HQ Administrator',
      role: 'HQ_SuperAdmin',
      isActive: true,
    };

    // 1. Guest: only landing and customer
    assert.equal(canAccessScreen('customer', guestUser), true);
    assert.equal(canAccessScreen('landing', guestUser), true);
    assert.equal(canAccessScreen('pos', guestUser), false);
    assert.equal(canAccessScreen('kds', guestUser), false);
    assert.equal(canAccessScreen('transfers', guestUser), false);
    assert.equal(canAccessScreen('analytics', guestUser), false);
    assert.equal(canAccessPortal('customer', guestUser), true);
    assert.equal(canAccessPortal('staff', guestUser), false);
    assert.equal(canAccessPortal('admin', guestUser), false);

    // 2. POS_Cashier: customer, pos, kds, landing ONLY. No transfers, stores, analytics, bom-studio.
    assert.equal(canAccessScreen('pos', cashierUser), true);
    assert.equal(canAccessScreen('kds', cashierUser), true);
    assert.equal(canAccessScreen('customer', cashierUser), true);
    assert.equal(canAccessScreen('transfers', cashierUser), false);
    assert.equal(canAccessScreen('stores', cashierUser), false);
    assert.equal(canAccessScreen('analytics', cashierUser), false);
    assert.equal(canAccessScreen('bom-studio', cashierUser), false);
    assert.equal(canAccessPortal('staff', cashierUser), true);
    assert.equal(canAccessPortal('admin', cashierUser), false);
    assert.equal(getDefaultScreenForUser(cashierUser), 'pos');

    // Filter staff nav for Cashier: hides transfers
    const staffNav = [
      { id: 'pos' as const, label: 'POS Terminal' },
      { id: 'kds' as const, label: 'Kitchen KDS' },
      { id: 'transfers' as const, label: 'Kho & STO' },
    ];
    const cashierNav = filterStaffNavItems(staffNav, cashierUser);
    assert.equal(cashierNav.length, 2);
    assert.deepEqual(cashierNav.map(n => n.id), ['pos', 'kds']);

    // 3. Store_Manager: pos, kds, transfers, inventory, analytics. CANNOT create corporate stores or master BoM.
    assert.equal(canAccessScreen('pos', managerUser), true);
    assert.equal(canAccessScreen('kds', managerUser), true);
    assert.equal(canAccessScreen('transfers', managerUser), true);
    assert.equal(canAccessScreen('inventory', managerUser), true);
    assert.equal(canAccessScreen('analytics', managerUser), true);
    assert.equal(canAccessScreen('stores', managerUser), false);
    assert.equal(canAccessScreen('bom-studio', managerUser), false);
    assert.equal(canAccessPortal('admin', managerUser), true);
    assert.equal(getDefaultScreenForUser(managerUser), 'pos');

    const adminNav = [
      { id: 'stores' as const, label: 'Store Network' },
      { id: 'analytics' as const, label: 'Báo Cáo' },
      { id: 'bom-studio' as const, label: 'BoM Studio' },
      { id: 'inventory' as const, label: 'Tồn Kho' },
    ];
    const managerAdminNav = filterAdminNavItems(adminNav, managerUser);
    assert.equal(managerAdminNav.length, 2);
    assert.deepEqual(managerAdminNav.map(n => n.id), ['analytics', 'inventory']);

    // 4. Supply_Chain_Officer: transfers, inventory, bom-studio. No corporate stores or analytics.
    assert.equal(canAccessScreen('transfers', supplyChainUser), true);
    assert.equal(canAccessScreen('inventory', supplyChainUser), true);
    assert.equal(canAccessScreen('bom-studio', supplyChainUser), true);
    assert.equal(canAccessScreen('stores', supplyChainUser), false);
    assert.equal(canAccessScreen('analytics', supplyChainUser), false);
    assert.equal(getDefaultScreenForUser(supplyChainUser), 'transfers');

    const supplyAdminNav = filterAdminNavItems(adminNav, supplyChainUser);
    assert.equal(supplyAdminNav.length, 2);
    assert.deepEqual(supplyAdminNav.map(n => n.id), ['bom-studio', 'inventory']);

    // 5. HQ_SuperAdmin: has access to all screens and portals
    assert.equal(canAccessScreen('stores', adminUser), true);
    assert.equal(canAccessScreen('bom-studio', adminUser), true);
    assert.equal(canAccessScreen('analytics', adminUser), true);
    assert.equal(canAccessScreen('transfers', adminUser), true);
    assert.equal(canAccessScreen('pos', adminUser), true);
    assert.equal(canAccessPortal('admin', adminUser), true);
    assert.equal(canAccessPortal('staff', adminUser), true);
    assert.equal(filterAdminNavItems(adminNav, adminUser).length, 4);
  });

  it('validates 80mm thermal receipt data structure and calculation consistency', () => {
    const items = [
      { name: 'Phin Sữa Đá Đậm Đà', quantity: 2, price: 29000, size: 'M', toppings: ['Black pearl'] },
      { name: 'Trà Sen Vàng Kem Cheese', quantity: 1, price: 45000, size: 'L' }
    ];

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity + (item.toppings?.length || 0) * 10000, 0);
    // 2 * 29000 + 10000 (topping) + 45000 = 58000 + 10000 + 45000 = 113000
    assert.equal(subtotal, 113000);

    const vat = Math.round(subtotal * 0.08); // 9040
    assert.equal(vat, 9040);

    const finalAmount = subtotal + vat; // 122040
    assert.equal(finalAmount, 122040);

    const receipt = {
      orderId: 'bb3b6032-acd7-4cac-b07e-d0e6d5899421',
      orderNumber: 'ORD-20261007-0042',
      subtotal,
      vatAmount: vat,
      finalAmount,
      createdAt: '2026-10-07T05:27:08.276Z',
      paymentMethod: 'Cash',
      orderType: 'Dine-in',
      storeName: 'Chi nhánh Quận 1 (Flagship Store)',
      storeAddress: '12 Lê Lợi, Bến Nghé, Quận 1, TP. HCM',
      storePhone: '028 3822 1234',
      cashierName: 'Linh (Thu ngân 01)',
      counterName: 'Counter 03 · Shift A',
      items,
      deductedIngredients: [
        { ingredientId: 'ing-1', ingredientName: 'Cà phê Robusta', quantityDeducted: 36, balanceAfter: 14214 }
      ],
      isOffline: false
    };

    assert.equal(receipt.orderNumber, 'ORD-20261007-0042');
    assert.equal(receipt.isOffline, false);
    assert.equal(receipt.deductedIngredients.length, 1);
    assert.ok(receipt.finalAmount > receipt.subtotal);
  });

  it('validates POS and Customer checkout payload mapping to backend contracts', () => {
    const storeId = '22222222-2222-2222-2222-222222222222';
    const dineInOrderType = 0; // DineIn
    const takeAwayOrderType = 1; // TakeAway
    const cashPaymentMethod = 0; // Cash
    const vietQrPaymentMethod = 2; // VNPay_QR / VietQR

    const posPayload = {
      storeId,
      orderType: takeAwayOrderType,
      paymentMethod: cashPaymentMethod,
      items: [
        {
          productId: '09ffff04-0f0b-4200-994a-d7decc20d2cc',
          quantity: 1,
          specialNote: 'Size M',
          modifiers: [{ name: 'Black pearl', extraPrice: 10000, consumptionQuantity: 25 }]
        }
      ]
    };

    assert.equal(posPayload.storeId, '22222222-2222-2222-2222-222222222222');
    assert.equal(posPayload.orderType, 1);
    assert.equal(posPayload.paymentMethod, 0);
    assert.equal(posPayload.items[0].modifiers[0].consumptionQuantity, 25);

    const customerPayload = {
      storeId,
      orderType: dineInOrderType,
      paymentMethod: vietQrPaymentMethod,
      items: [
        {
          productId: '8009ae26-207a-4a4e-9ee0-0e0819b17737',
          quantity: 2,
          specialNote: 'Size L, Đá 70%, Đường 50%'
        }
      ]
    };

    assert.equal(customerPayload.orderType, 0);
    assert.equal(customerPayload.paymentMethod, 2);
    assert.equal(customerPayload.items[0].quantity, 2);
  });
});


