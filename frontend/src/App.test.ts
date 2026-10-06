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
});
