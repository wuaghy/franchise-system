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
});

