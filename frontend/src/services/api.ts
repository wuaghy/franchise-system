/**
 * API Client Service for Enterprise Franchise System
 * Integrates directly with ASP.NET Core 8 Web API backend
 */

import { getTokenFromLocalStorage } from './auth.ts';
 
export interface StoreContractResponse {
  id: string;
  contractNumber: string;
  status: string;
  signerName: string;
  signerTitle: string;
  signerIdCard: string;
  signedAt: string;
  signatureBase64?: string;
  royaltyRate: number;
  marketingFeeRate: number;
  techFeeFixedMonthly: number;
}

export interface CreateStoreManagerPayload {
  fullName: string;
  email: string;
  username: string;
  password?: string;
}

export interface OnlineContractSigningPayload {
  signerName: string;
  signerIdCard: string;
  signerTitle?: string;
  signatureBase64: string;
  royaltyRate?: number;
  marketingFeeRate?: number;
}

export interface CreateStorePayload {
  code: string;
  name: string;
  address: string;
  phoneNumber: string;
  latitude?: number;
  longitude?: number;
  managerAccount?: CreateStoreManagerPayload;
  contractSigning?: OnlineContractSigningPayload;
}

export interface StoreItem {
  id: string;
  code: string;
  name: string;
  address: string;
  phoneNumber: string;
  isActive: boolean;
  revenue?: string;
  createdAt: string;
  managerUsername?: string;
  managerFullName?: string;
  contract?: StoreContractResponse;
}

export interface InventoryItem {
  storeId: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  currentStock: number;
  minAlertThreshold: number;
  lastCountedAt?: string;
}

export interface LowStockAlert {
  storeId: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  currentStock: number;
  minAlertThreshold: number;
  shortage: number;
}

export interface InboundStockPayload {
  storeId: string;
  ingredientId: string;
  quantity: number;
  note?: string;
}

export interface OrderModifierPayload {
  name: string;
  extraPrice: number;
  ingredientId?: string;
  consumptionQuantity: number;
}

export interface OrderItemPayload {
  productId: string;
  quantity: number;
  specialNote?: string;
  modifiers?: OrderModifierPayload[];
}

export interface CheckoutOrderPayload {
  storeId: string;
  customerId?: string;
  cashierId?: string;
  orderType: number; // 0: DineIn, 1: TakeAway, 2: Delivery
  paymentMethod: number; // 0: Cash, 1: QRCode, 2: CreditCard
  items: OrderItemPayload[];
}

export interface DeductedIngredient {
  ingredientId: string;
  ingredientName: string;
  quantityDeducted: number;
  balanceAfter: number;
}

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  status: number;
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  finalAmount: number;
  paymentStatus: number;
  createdAt: string;
  deductedIngredients: DeductedIngredient[];
}

export interface ProductItem {
  id: string;
  categoryId: string;
  categoryName: string;
  sku: string;
  name: string;
  basePrice: number;
  isAvailable: boolean;
  createdAt: string;
}

export interface IngredientItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  standardCost: number;
  createdAt: string;
}

import { API_BASE } from '../config/api.ts';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
      ...(getTokenFromLocalStorage() ? { Authorization: `Bearer ${getTokenFromLocalStorage()}` } : {}),
    },
    ...options,
  });

  if (!response.ok) {
    let errorDetail = 'API Error';
    try {
      const problem = await response.json();
      errorDetail = problem.detail || problem.title || JSON.stringify(problem);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`[${response.status}] ${errorDetail}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Store Network
  async getStores(page = 1, pageSize = 20, search?: string): Promise<{ items: StoreItem[]; totalCount: number }> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.append('search', search);
    return fetchJson<{ items: StoreItem[]; totalCount: number }>(`${API_BASE}/stores?${params.toString()}`);
  },

  async createStore(data: CreateStorePayload): Promise<StoreItem> {
    return fetchJson<StoreItem>(`${API_BASE}/stores`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getStoreContract(storeId: string): Promise<StoreContractResponse> {
    return fetchJson<StoreContractResponse>(`${API_BASE}/stores/${storeId}/contract`);
  },

  async signStoreContract(storeId: string, payload: OnlineContractSigningPayload): Promise<StoreContractResponse> {
    return fetchJson<StoreContractResponse>(`${API_BASE}/stores/${storeId}/contract/sign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Live Inventory & Alerts
  async getStoreInventory(storeId: string): Promise<InventoryItem[]> {
    return fetchJson<InventoryItem[]>(`${API_BASE}/stores/${storeId}/inventory`);
  },

  async getLowStockAlerts(storeId: string): Promise<LowStockAlert[]> {
    return fetchJson<LowStockAlert[]>(`${API_BASE}/stores/${storeId}/inventory/low-stock`);
  },

  async inboundStock(payload: InboundStockPayload): Promise<void> {
    return fetchJson<void>(`${API_BASE}/stores/${payload.storeId}/inventory/inbound`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // POS Checkout (Transactional Outbox)
  async checkout(payload: CheckoutOrderPayload): Promise<CheckoutResponse> {
    return fetchJson<CheckoutResponse>(`${API_BASE}/orders/checkout`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // VietQR Dynamic Generator
  async getVietQr(amount: number, orderCode: string, note?: string): Promise<{
    qrUrl: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    orderCode: string;
    transferNote: string;
  }> {
    const params = new URLSearchParams({
      amount: String(amount),
      orderCode,
    });
    if (note) params.append('note', note);
    return fetchJson(`${API_BASE}/payments/vietqr?${params.toString()}`);
  },

  // Products & Menu Catalogue
  async getProducts(categoryId?: string, isAvailable?: boolean): Promise<ProductItem[]> {
    const params = new URLSearchParams();
    if (categoryId) params.append('categoryId', categoryId);
    if (isAvailable !== undefined) params.append('isAvailable', String(isAvailable));
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<ProductItem[]>(`${API_BASE}/products${query}`);
  },

  // Ingredients Catalogue
  async getIngredients(): Promise<IngredientItem[]> {
    return fetchJson<IngredientItem[]>(`${API_BASE}/ingredients`);
  },
};

