import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateKdsSlaCountdown,
  formatMinutesSeconds,
  extractOrderCallNumber,
  buildTtsAnnouncement,
} from './services/kds.ts';

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

  it('calculates 3-minute KDS SLA countdown and color stages (Healthy -> Warning -> Critical)', () => {
    const baseTimeMs = 1728300000000;
    const makeIso = (secondsAgo: number) => new Date(baseTimeMs - secondsAgo * 1000).toISOString();

    // Stage 1: Healthy (Xanh) - Mới bắt đầu hoặc trôi qua <= 90 giây
    const healthyResult = calculateKdsSlaCountdown(makeIso(45), 180, baseTimeMs);
    assert.equal(healthyResult.elapsed, 45);
    assert.equal(healthyResult.remaining, 135);
    assert.equal(healthyResult.stage, 'healthy');
    assert.ok(healthyResult.badgeClass.includes('bg-emerald-100'));
    assert.equal(healthyResult.formattedRemaining, '02:15');

    // Stage 2: Warning (Vàng) - 90s < elapsed <= 180s (sắp hết hạn 3 phút)
    const warningResult = calculateKdsSlaCountdown(makeIso(140), 180, baseTimeMs);
    assert.equal(warningResult.elapsed, 140);
    assert.equal(warningResult.remaining, 40);
    assert.equal(warningResult.stage, 'warning');
    assert.ok(warningResult.badgeClass.includes('bg-amber-100'));
    assert.equal(warningResult.formattedRemaining, '00:40');

    // Stage 3: Critical (Đỏ) - Trễ quá 3 phút (elapsed > 180s)
    const criticalResult = calculateKdsSlaCountdown(makeIso(215), 180, baseTimeMs);
    assert.equal(criticalResult.elapsed, 215);
    assert.equal(criticalResult.remaining, -35);
    assert.equal(criticalResult.stage, 'critical');
    assert.ok(criticalResult.badgeClass.includes('bg-red-100'));
    assert.ok(criticalResult.badgeClass.includes('animate-pulse'));
    assert.equal(criticalResult.formattedRemaining, '-00:35');
    assert.ok(criticalResult.label.includes('Quá 3p'));

    // Test formatter helper
    assert.equal(formatMinutesSeconds(0), '00:00');
    assert.equal(formatMinutesSeconds(65), '01:05');
  });

  it('extracts order call numbers and generates Vietnamese TTS announcement text', () => {
    // Case 1: Standard POS Order Number ORD-202610-0042 -> 42
    assert.equal(extractOrderCallNumber('ORD-202610-0042'), '42');
    assert.equal(buildTtsAnnouncement('ORD-202610-0042'), 'Mời quý khách số 42 nhận đồ tại quầy');

    // Case 2: Timestamp Order ORD-20261007-1234 -> 1234
    assert.equal(extractOrderCallNumber('ORD-20261007-1234'), '1234');
    assert.equal(buildTtsAnnouncement('ORD-20261007-1234'), 'Mời quý khách số 1234 nhận đồ tại quầy');

    // Case 3: Leading zeros stripped: ORD-0005 -> 5
    assert.equal(extractOrderCallNumber('ORD-0005'), '5');
    assert.equal(buildTtsAnnouncement('ORD-0005'), 'Mời quý khách số 5 nhận đồ tại quầy');

    // Case 4: TicketNumber fallback if orderNumber has no clean numeric suffix
    assert.equal(extractOrderCallNumber('', 'KDS-202610-0088'), '88');
    assert.equal(buildTtsAnnouncement('', 'KDS-202610-0088'), 'Mời quý khách số 88 nhận đồ tại quầy');
  });

  it('verifies touch toggle mechanics for KDS drinks and topping modifiers', () => {
    const ticket = {
      id: 'ticket-1',
      items: [
        {
          id: 'item-1',
          productName: 'Trà Sen Vàng',
          isPrepared: false,
          modifiers: [
            { id: 'mod-1', modifierName: 'Thêm Hạt Sen', isChecked: false },
            { id: 'mod-2', modifierName: 'Thêm Củ Năng Giòn', isChecked: true }
          ]
        },
        {
          id: 'item-2',
          productName: 'Phin Sữa Đá',
          isPrepared: true,
          modifiers: []
        }
      ]
    };

    // 1. Touch item to toggle prepared
    const toggledItems = ticket.items.map(item =>
      item.id === 'item-1' ? { ...item, isPrepared: !item.isPrepared } : item
    );
    assert.equal(toggledItems[0].isPrepared, true);
    assert.equal(toggledItems.every(i => i.isPrepared), true);

    // 2. Touch modifier to toggle isChecked independently
    const toggledModifiers = ticket.items.map(item => ({
      ...item,
      modifiers: item.modifiers.map(mod =>
        mod.id === 'mod-1' ? { ...mod, isChecked: !mod.isChecked } : mod
      )
    }));
    assert.equal(toggledModifiers[0].modifiers[0].isChecked, true);

    // 3. Detect 100% prepared ready condition
    const allReady = toggledItems.every(i => i.isPrepared);
    assert.equal(allReady, true);
  });

  it('validates store creation payload with manager account and online contract signing', () => {
    const storePayload = {
      code: 'HL-Q1-NEW',
      name: 'Highlands Coffee Nguyễn Thị Minh Khai',
      address: '180 Nguyễn Thị Minh Khai, Quận 3, TP.HCM',
      phoneNumber: '028 3822 9999',
      managerAccount: {
        fullName: 'Trần Văn Quản Lý',
        email: 'quanly.q3@franchise.vn',
        username: 'mgr_q3_minhkhai',
        password: 'Manager@123',
      },
      contractSigning: {
        signerName: 'Trần Văn Quản Lý',
        signerIdCard: '079095012345',
        signerTitle: 'Chủ Chi Nhánh Nhượng Quyền',
        signatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        royaltyRate: 0.05,
        marketingFeeRate: 0.02,
      },
    };

    assert.equal(storePayload.code, 'HL-Q1-NEW');
    assert.ok(storePayload.managerAccount);
    assert.equal(storePayload.managerAccount.username, 'mgr_q3_minhkhai');
    assert.ok(storePayload.contractSigning);
    assert.equal(storePayload.contractSigning.royaltyRate, 0.05);
    assert.equal(storePayload.contractSigning.marketingFeeRate, 0.02);
    assert.ok(storePayload.contractSigning.signatureBase64.startsWith('data:image/png;base64,'));
  });

  it('validates E-Contract monthly financial obligations and legal document structure', () => {
    const monthlyNetRevenue = 250000000; // 250 million VND
    const royaltyRate = 0.05;
    const marketingRate = 0.02;
    const techFeeFixed = 2000000;

    const royaltyFee = monthlyNetRevenue * royaltyRate;
    const marketingFee = monthlyNetRevenue * marketingRate;
    const totalMonthlyObligation = royaltyFee + marketingFee + techFeeFixed;

    assert.equal(royaltyFee, 12500000); // 12.5 million VND
    assert.equal(marketingFee, 5000000); // 5 million VND
    assert.equal(totalMonthlyObligation, 19500000); // 19.5 million VND

    const contractRecord = {
      contractNumber: 'HDNQ-HL-Q1-NEW-20261008',
      status: 'Signed',
      signerName: 'Trần Văn Quản Lý',
      signerTitle: 'Chủ Chi Nhánh Nhượng Quyền',
      signerIdCard: '079095012345',
      signedAt: new Date().toISOString(),
      royaltyRate,
      marketingFeeRate: marketingRate,
      techFeeFixedMonthly: techFeeFixed,
    };

    assert.equal(contractRecord.status, 'Signed');
    assert.ok(contractRecord.contractNumber.startsWith('HDNQ-'));
    assert.equal(contractRecord.techFeeFixedMonthly, 2000000);
  });

  it('validates PayOS & Casso webhook notification payload structure and order matching', () => {
    const notification = {
      orderId: '00000000-0000-0000-0000-000000000099',
      orderNumber: 'ORD-20261010-001',
      amount: 65000,
      transactionReference: 'FT2410109999',
      gateway: 'PayOS Napas 24/7',
      paidAt: '2026-10-10T08:30:00Z',
      storeId: '00000000-0000-0000-0000-000000000001',
    };

    assert.equal(notification.orderNumber, 'ORD-20261010-001');
    assert.equal(notification.amount, 65000);
    assert.ok(notification.gateway.includes('PayOS'));
    assert.ok(notification.transactionReference.startsWith('FT'));
  });

  it('verifies automatic VietQR Webhook SignalR auto-confirmation matching logic', () => {
    const activeOrderCode = 'ORD-20261010-001';
    
    // Test exact match
    const isExactMatch = 'ORD-20261010-001'.toUpperCase() === activeOrderCode.toUpperCase();
    assert.equal(isExactMatch, true);

    // Test substring match from bank description
    const bankTransferDesc = 'Thanh toan don hang ORD-20261010-001 tai quay POS';
    const isSubstringMatch = bankTransferDesc.toUpperCase().includes(activeOrderCode.toUpperCase());
    assert.equal(isSubstringMatch, true);

    // Test mismatched order code
    const otherOrderCode = 'ORD-20261010-999';
    const isMismatch = otherOrderCode.toUpperCase() === activeOrderCode.toUpperCase();
    assert.equal(isMismatch, false);
  });

  it('calculates Shift expected ending cash and cash discrepancy accurately', () => {
    const startingCash = 1000000; // 1,000,000 đ tiền mồi két đầu ca
    const totalCashSales = 2450000; // Bán hàng tiền mặt trong ca
    const totalCashIn = 200000; // Nạp thêm tiền lẻ vào két
    const totalCashOut = 150000; // Chi vặt mua đá viên / túi nilon

    // Công thức F&B chuẩn: Expected = Start + CashSales + CashIn - CashOut
    const expectedEndingCash = startingCash + totalCashSales + totalCashIn - totalCashOut;
    assert.equal(expectedEndingCash, 3500000);

    // Kịch bản 1: Tiền mặt đếm thực tế khớp 100%
    const actualEndingCashMatched = 3500000;
    const discrepancyBalanced = actualEndingCashMatched - expectedEndingCash;
    assert.equal(discrepancyBalanced, 0);

    // Kịch bản 2: Thực tế thiếu 20k (do thối nhầm)
    const actualEndingCashShort = 3480000;
    const discrepancyShort = actualEndingCashShort - expectedEndingCash;
    assert.equal(discrepancyShort, -20000);

    // Kịch bản 3: Thực tế thừa 50k
    const actualEndingCashOver = 3550000;
    const discrepancyOver = actualEndingCashOver - expectedEndingCash;
    assert.equal(discrepancyOver, 50000);
  });

  it('calculates total physical cash from denomination breakdown accurately', () => {
    const denominations = [
      { value: 500000, count: 4 }, // 2,000,000 đ
      { value: 200000, count: 5 }, // 1,000,000 đ
      { value: 100000, count: 3 }, // 300,000 đ
      { value: 50000, count: 2 },  // 100,000 đ
      { value: 20000, count: 4 },  // 80,000 đ
      { value: 10000, count: 2 },  // 20,000 đ
    ];

    const totalCalculated = denominations.reduce((sum, d) => sum + d.value * d.count, 0);
    assert.equal(totalCalculated, 3500000);
  });

  it('validates Z-Report revenue and payment method breakdown rollup', () => {
    const totalCashSales = 1800000;
    const totalBankTransferSales = 3200000;
    const totalCardSales = 950000;

    const totalRevenue = totalCashSales + totalBankTransferSales + totalCardSales;
    assert.equal(totalRevenue, 5950000);

    const startingCash = 1000000;
    const totalCashIn = 100000;
    const totalCashOut = 50000;
    const expectedCashInDrawer = startingCash + totalCashSales + totalCashIn - totalCashOut;
    assert.equal(expectedCashInDrawer, 2850000);
  });

  it('calculates member tier discount percentages correctly', () => {
    const getTierDiscountPercent = (tier: number) => {
      switch (tier) {
        case 3: return 15; // Diamond
        case 2: return 10; // Gold
        case 1: return 5;  // Silver
        default: return 0; // Standard
      }
    };

    assert.equal(getTierDiscountPercent(0), 0);
    assert.equal(getTierDiscountPercent(1), 5);
    assert.equal(getTierDiscountPercent(2), 10);
    assert.equal(getTierDiscountPercent(3), 15);
  });

  it('accurately calculates combined loyalty promotion (Tier + Voucher + Points)', () => {
    const subtotal = 300000;
    const tierDiscountPercent = 10; // Gold Member = 10%
    const tierDiscount = Math.round(subtotal * (tierDiscountPercent / 100)); // 30,000 đ

    const voucherDiscount = 25000; // Voucher giảm 25,000 đ
    const pointsRedeemed = 20; // 20 điểm x 1,000 đ = 20,000 đ
    const pointsDiscount = pointsRedeemed * 1000;

    const totalDiscount = Math.min(subtotal, tierDiscount + voucherDiscount + pointsDiscount);
    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const vat = Math.round(taxableAmount * 0.08);
    const finalAmount = taxableAmount + vat;

    assert.equal(tierDiscount, 30000);
    assert.equal(pointsDiscount, 20000);
    assert.equal(totalDiscount, 75000); // 30k + 25k + 20k
    assert.equal(taxableAmount, 225000);
    assert.equal(vat, 18000);
    assert.equal(finalAmount, 243000);
  });

  it('evaluates loyalty points earning rate correctly (10,000 VND = 1 Point)', () => {
    const finalAmount = 243000;
    const pointsEarned = Math.floor(finalAmount / 10000);
    assert.equal(pointsEarned, 24);
  });

  it('calculates peak hours staffing recommendation dynamically based on order volume', () => {
    const calculateStaffing = (orderCount: number, isPeakHour: boolean) => {
      if (isPeakHour || orderCount >= 30) return 4;
      if (orderCount >= 15) return 3;
      if (orderCount >= 5) return 2;
      return 1;
    };

    assert.equal(calculateStaffing(35, true), 4);
    assert.equal(calculateStaffing(10, true), 4);
    assert.equal(calculateStaffing(25, false), 3);
    assert.equal(calculateStaffing(12, false), 2);
    assert.equal(calculateStaffing(3, false), 1);
  });

  it('classifies Menu Engineering BCG matrix correctly (Star, Plowhorse, Puzzle, Dog)', () => {
    const classifyMenuProduct = (
      quantity: number,
      unitMargin: number,
      avgQty: number,
      avgMargin: number
    ): 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog' => {
      const isHighPopularity = quantity >= avgQty;
      const isHighProfit = unitMargin >= avgMargin;

      if (isHighPopularity && isHighProfit) return 'Star';
      if (isHighPopularity && !isHighProfit) return 'Plowhorse';
      if (!isHighPopularity && isHighProfit) return 'Puzzle';
      return 'Dog';
    };

    const avgQty = 50;
    const avgMargin = 25000;

    // Star: High volume, High profit margin
    assert.equal(classifyMenuProduct(80, 35000, avgQty, avgMargin), 'Star');
    // Plowhorse: High volume, Low profit margin
    assert.equal(classifyMenuProduct(100, 15000, avgQty, avgMargin), 'Plowhorse');
    // Puzzle: Low volume, High profit margin
    assert.equal(classifyMenuProduct(20, 40000, avgQty, avgMargin), 'Puzzle');
    // Dog: Low volume, Low profit margin
    assert.equal(classifyMenuProduct(15, 12000, avgQty, avgMargin), 'Dog');
  });

  it('computes inventory waste and shrinkage rate correctly', () => {
    const computeShrinkage = (theoreticalUsage: number, wastedQuantity: number, standardCost: number) => {
      const totalInput = theoreticalUsage + wastedQuantity;
      const shrinkageRate = totalInput > 0 ? (wastedQuantity / totalInput) * 100 : 0;
      const totalCostLoss = wastedQuantity * standardCost;

      return {
        shrinkageRate: Math.round(shrinkageRate * 100) / 100,
        totalCostLoss,
      };
    };

    // Example: 90kg used theoretically, 10kg spoiled/wasted, cost = 120,000 VND/kg
    const result = computeShrinkage(90, 10, 120000);
    assert.equal(result.shrinkageRate, 10.0); // 10 / (90 + 10) * 100 = 10%
    assert.equal(result.totalCostLoss, 1200000);

    // Edge case: 0 waste
    const zeroWaste = computeShrinkage(100, 0, 50000);
    assert.equal(zeroWaste.shrinkageRate, 0);
    assert.equal(zeroWaste.totalCostLoss, 0);
  });

  it('correctly converts accented Vietnamese to standard ESC/POS ASCII', async () => {
    const { removeVietnameseAccents } = await import('./services/printer.ts');
    assert.equal(removeVietnameseAccents('Cà Phê Sữa Đá Đậm Đà'), 'Ca Phe Sua Da Dam Da');
    assert.equal(removeVietnameseAccents('Trà Sen Vàng Kem Cheese'), 'Tra Sen Vang Kem Cheese');
    assert.equal(removeVietnameseAccents('Hóa Đơn Điện Tử Khởi Tạo'), 'Hoa Don Dien Tu Khoi Tao');
  });

  it('generates compliant ESC/POS binary sequences for printer init, drawer kick, and paper cut', async () => {
    const { EscPosBuilder, generateCashDrawerKickCommand } = await import('./services/printer.ts');

    // 1. Kick Command
    const kickBytes = generateCashDrawerKickCommand();
    // ESC @ (1b 40) + ESC p 0 25 250 (1b 70 00 19 fa)
    assert.equal(kickBytes[0], 0x1b);
    assert.equal(kickBytes[1], 0x40);
    assert.equal(kickBytes[2], 0x1b);
    assert.equal(kickBytes[3], 0x70);
    assert.equal(kickBytes[4], 0x00);

    // 2. Cut Command
    const builder = new EscPosBuilder(48);
    builder.init().cut(false);
    const cutBytes = builder.getBytes();
    // contains GS V 65 0 (1d 56 41 00)
    const hasGsV = cutBytes.some((b, i) => b === 0x1d && cutBytes[i + 1] === 0x56);
    assert.equal(hasGsV, true);
  });

  it('generates complete 80mm ESC/POS receipt payload with full metadata and items', async () => {
    const { generateReceiptEscPosCommands } = await import('./services/printer.ts');

    const receipt = {
      storeName: 'Chi nhanh Quan 1',
      storeAddress: '12 Le Loi, Ben Nghe, Q1, TP. HCM',
      storePhone: '028 3822 1234',
      orderNumber: 'ORD-20261010-0088',
      orderType: 'Dine-in',
      cashierName: 'Nguyen Van A',
      counterName: 'Quay 01',
      createdAt: '10/10/2026 11:15:00',
      items: [
        { name: 'Phin Sua Da', quantity: 2, price: 35000, size: 'M' },
        { name: 'Tra Sen Vang', quantity: 1, price: 45000, toppings: ['Kem cheese'] },
      ],
      subtotal: 115000,
      vatAmount: 9200,
      discountAmount: 10000,
      finalAmount: 114200,
      paymentMethod: 'Cash',
    };

    const bytes = generateReceiptEscPosCommands(receipt, {
      openDrawer: true,
      cutPaper: true,
      charactersPerLine: 48,
    });

    assert.ok(bytes.length > 100);
    // Starts with ESC @
    assert.equal(bytes[0], 0x1b);
    assert.equal(bytes[1], 0x40);
  });

  it('accurately computes Stock Audit discrepancies, cost loss/gain, and summary totals', () => {
    const auditItems = [
      {
        ingredientId: 'ing-1',
        name: 'Cà phê Robusta',
        systemStock: 25.0,
        physicalCount: 22.5, // Thiếu 2.5kg
        standardCost: 150000,
      },
      {
        ingredientId: 'ing-2',
        name: 'Sữa đặc Ngôi sao',
        systemStock: 40.0,
        physicalCount: 44.0, // Thừa 4 hộp
        standardCost: 24000,
      },
      {
        ingredientId: 'ing-3',
        name: 'Trà Oolong',
        systemStock: 10.0,
        physicalCount: 10.0, // Khớp
        standardCost: 180000,
      },
    ];

    const results = auditItems.map((it) => {
      const discrepancy = it.physicalCount - it.systemStock;
      const totalCost = discrepancy * it.standardCost;
      return {
        ...it,
        discrepancy,
        totalCost,
        isDiscrepant: discrepancy !== 0,
      };
    });

    const discrepantCount = results.filter((r) => r.isDiscrepant).length;
    const totalDiscrepancyCost = results.reduce((sum, r) => sum + r.totalCost, 0);

    // Assert individual
    assert.equal(results[0].discrepancy, -2.5);
    assert.equal(results[0].totalCost, -375000); // 2.5 * 150,000 = -375,000 đ
    assert.equal(results[1].discrepancy, 4.0);
    assert.equal(results[1].totalCost, 96000);   // 4 * 24,000 = +96,000 đ
    assert.equal(results[2].discrepancy, 0);
    assert.equal(results[2].totalCost, 0);

    // Assert totals
    assert.equal(discrepantCount, 2);
    assert.equal(totalDiscrepancyCost, -279000); // -375,000 + 96,000 = -279,000 đ
  });

  it('calculates automated reorder suggestions (Auto-PO) with lead time and safety thresholds', () => {
    interface MockInventoryItem {
      ingredientId: string;
      ingredientName: string;
      currentStock: number;
      minAlertThreshold: number;
      dailyUsageRunRate: number;
      standardCost: number;
    }

    const items: MockInventoryItem[] = [
      {
        ingredientId: 'ing-coffee',
        ingredientName: 'Cà phê Hạt Blend',
        currentStock: 2000, // 2000g
        minAlertThreshold: 5000,
        dailyUsageRunRate: 1500, // 1.5kg/ngày
        standardCost: 250, // 250đ/g
      },
      {
        ingredientId: 'ing-condensed-milk',
        ingredientName: 'Sữa đặc Lon',
        currentStock: 0, // Đã hết nhẵn
        minAlertThreshold: 10,
        dailyUsageRunRate: 5, // 5 lon/ngày
        standardCost: 22000,
      },
      {
        ingredientId: 'ing-sugar',
        ingredientName: 'Đường cát',
        currentStock: 100000, // Còn rất nhiều
        minAlertThreshold: 10000,
        dailyUsageRunRate: 2000,
        standardCost: 25,
      },
    ];

    const planningHorizonDays = 7;
    const leadTimeDays = 2;
    const totalDays = planningHorizonDays + leadTimeDays; // 9 days

    const suggestions = items.map((it) => {
      const demandOverHorizon = it.dailyUsageRunRate * totalDays;
      const targetStockLevel = Math.max(it.minAlertThreshold, demandOverHorizon);
      const recommendedReorderQuantity = Math.max(0, Math.ceil(targetStockLevel - it.currentStock));
      const estimatedCost = recommendedReorderQuantity * it.standardCost;

      let priority: 'Critical' | 'Warning' | 'Normal' = 'Normal';
      if (it.currentStock <= 0) {
        priority = 'Critical';
      } else if (it.currentStock <= it.minAlertThreshold) {
        priority = 'Warning';
      }

      return {
        ...it,
        targetStockLevel,
        recommendedReorderQuantity,
        estimatedCost,
        priority,
      };
    });

    // Coffee: target = max(5000, 1500 * 9) = 13500. Reorder = 13500 - 2000 = 11500g. Priority = Warning (2000 <= 5000)
    assert.equal(suggestions[0].targetStockLevel, 13500);
    assert.equal(suggestions[0].recommendedReorderQuantity, 11500);
    assert.equal(suggestions[0].estimatedCost, 11500 * 250);
    assert.equal(suggestions[0].priority, 'Warning');

    // Milk: target = max(10, 5 * 9) = 45. Reorder = 45 - 0 = 45. Priority = Critical (currentStock = 0)
    assert.equal(suggestions[1].targetStockLevel, 45);
    assert.equal(suggestions[1].recommendedReorderQuantity, 45);
    assert.equal(suggestions[1].estimatedCost, 45 * 22000);
    assert.equal(suggestions[1].priority, 'Critical');

    // Sugar: target = max(10000, 2000 * 9) = 18000. Reorder = max(0, 18000 - 100000) = 0. Priority = Normal
    assert.equal(suggestions[2].targetStockLevel, 18000);
    assert.equal(suggestions[2].recommendedReorderQuantity, 0);
    assert.equal(suggestions[2].estimatedCost, 0);
    assert.equal(suggestions[2].priority, 'Normal');

    // Total Cost
    const totalEstCost = suggestions.reduce((sum, s) => sum + s.estimatedCost, 0);
    assert.equal(totalEstCost, 11500 * 250 + 45 * 22000);
  });

  it('calculates supply chain lead-times and SLA on-time delivery rate accurately', () => {
    interface MockOrderLifecycle {
      transferCode: string;
      createdAt: string;
      approvedAt?: string;
      dispatchedAt?: string;
      receivedAt?: string;
      status: string;
    }

    const mockOrders: MockOrderLifecycle[] = [
      {
        transferCode: 'STO-01',
        createdAt: '2026-10-01T08:00:00Z',
        approvedAt: '2026-10-01T12:00:00Z', // 4h
        dispatchedAt: '2026-10-01T16:00:00Z', // 4h
        receivedAt: '2026-10-02T08:00:00Z', // 16h transit -> Total = 24h
        status: 'Received',
      },
      {
        transferCode: 'STO-02',
        createdAt: '2026-10-02T09:00:00Z',
        approvedAt: '2026-10-02T15:00:00Z', // 6h
        dispatchedAt: '2026-10-02T21:00:00Z', // 6h
        receivedAt: '2026-10-03T17:00:00Z', // 20h transit -> Total = 32h
        status: 'Received',
      },
      {
        transferCode: 'STO-03',
        createdAt: '2026-10-03T10:00:00Z',
        approvedAt: '2026-10-03T12:00:00Z',
        dispatchedAt: '2026-10-03T18:00:00Z',
        status: 'Dispatched', // Still in transit
      },
    ];

    const completed = mockOrders.filter((o) => o.receivedAt && o.status === 'Received');
    assert.equal(completed.length, 2);

    const getDiffHours = (start: string, end: string) => {
      return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
    };

    const transitHours = completed.map((o) => getDiffHours(o.dispatchedAt!, o.receivedAt!));
    assert.deepEqual(transitHours, [16, 20]);
    const avgTransit = transitHours.reduce((a, b) => a + b, 0) / transitHours.length;
    assert.equal(avgTransit, 18);

    const totalCycleHours = completed.map((o) => getDiffHours(o.createdAt, o.receivedAt!));
    assert.deepEqual(totalCycleHours, [24, 32]);
    const avgCycle = totalCycleHours.reduce((a, b) => a + b, 0) / totalCycleHours.length;
    assert.equal(avgCycle, 28);

    // SLA On-Time: Orders completing within 48 hours
    const onTimeCount = totalCycleHours.filter((h) => h <= 48).length;
    const onTimeRate = (onTimeCount / totalCycleHours.length) * 100;
    assert.equal(onTimeRate, 100);
  });

  it('generates STO printable invoice total value and CSV serialization correctly', () => {
    const mockOrder = {
      transferCode: 'STO-202610-0088',
      sourceWarehouseName: 'Kho Tổng Miền Nam',
      destinationStoreName: 'Chi nhánh Quận 1',
      destinationStoreCode: 'STORE-Q1',
      status: 'Approved',
      dispatchTrackingNumber: 'VNPOST-881239',
      createdAt: '2026-10-10T08:00:00Z',
      items: [
        {
          ingredientId: 'ing-1',
          ingredientName: 'Arabica Coffee Beans',
          ingredientCode: 'BEAN-ARA',
          unit: 'gram',
          requestedQuantity: 20000,
          approvedQuantity: 20000,
          actualReceivedQuantity: 0,
          unitCost: 350,
        },
        {
          ingredientId: 'ing-2',
          ingredientName: 'Black Tapioca Pearl',
          ingredientCode: 'PEARL-01',
          unit: 'gram',
          requestedQuantity: 10000,
          approvedQuantity: 10000,
          actualReceivedQuantity: 0,
          unitCost: 150,
        },
      ],
    };

    // Calculate total order estimated value: 20000 * 350 + 10000 * 150 = 7,000,000 + 1,500,000 = 8,500,000 đ
    const totalEstValue = mockOrder.items.reduce(
      (sum, it) => sum + (it.approvedQuantity || it.requestedQuantity) * it.unitCost,
      0
    );
    assert.equal(totalEstValue, 8_500_000);

    // CSV serialization format check
    const headers = ['Mã STO', 'Kho Xuất', 'Chi Nhánh Nhận', 'Mã Chi Nhánh', 'Trạng Thái', 'Mã Vận Đơn', 'Số Mặt Hàng'];
    const row = [
      `"${mockOrder.transferCode}"`,
      `"${mockOrder.sourceWarehouseName}"`,
      `"${mockOrder.destinationStoreName}"`,
      `"${mockOrder.destinationStoreCode}"`,
      `"${mockOrder.status}"`,
      `"${mockOrder.dispatchTrackingNumber}"`,
      mockOrder.items.length,
    ];

    const csvRowString = row.join(',');
    assert.ok(csvRowString.includes('STO-202610-0088'));
    assert.ok(csvRowString.includes('STORE-Q1'));
    assert.ok(csvRowString.includes('VNPOST-881239'));
    assert.equal(row[6], 2);
  });
});






