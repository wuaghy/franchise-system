/**
 * Offline Order Queue Service for POS Terminals
 * Persists orders locally when network connectivity is lost
 */

export interface OfflineOrderItemModifierSync {
  name: string;
  extraPrice: number;
  ingredientId?: string;
  consumptionQuantity: number;
}

export interface OfflineOrderItemSync {
  productId: string;
  quantity: number;
  unitPrice: number;
  specialNote?: string;
  modifiers?: OfflineOrderItemModifierSync[];
}

export interface OfflineOrderSyncItem {
  offlineOrderId: string;
  idempotencyKey: string;
  storeId: string;
  cashierId?: string;
  customerId?: string;
  paymentMethod: number; // 0: Cash, 1: CreditCard, 2: BankTransfer, 3: EWallet
  orderType: number;     // 0: DineIn, 1: TakeAway, 2: Delivery
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  finalAmount: number;
  offlineCreatedAt: string;
  items: OfflineOrderItemSync[];
}

const STORAGE_KEY = 'franchise_pos_offline_orders_queue';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getPendingOfflineOrders(): OfflineOrderSyncItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineOrderSyncItem[];
  } catch (err) {
    console.error('Failed to read offline orders from localStorage', err);
    return [];
  }
}

export function enqueueOfflineOrder(order: OfflineOrderSyncItem): void {
  if (!isBrowser()) return;
  try {
    const existing = getPendingOfflineOrders();
    // Chống ghi trùng id trong hàng đợi
    const filtered = existing.filter(o => o.offlineOrderId !== order.offlineOrderId);
    filtered.push(order);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to enqueue offline order to localStorage', err);
  }
}

export function removeOfflineOrder(offlineOrderId: string): void {
  if (!isBrowser()) return;
  try {
    const existing = getPendingOfflineOrders();
    const updated = existing.filter(o => o.offlineOrderId !== offlineOrderId);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to remove offline order from localStorage', err);
  }
}

export function clearPendingOfflineOrders(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear offline orders from localStorage', err);
  }
}

export function getPendingOfflineOrderCount(): number {
  return getPendingOfflineOrders().length;
}
