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
  customerPhoneNumber?: string;
  voucherCode?: string;
  pointsToRedeem?: number;
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

  async simulatePaymentWebhook(orderCode: string, amount: number, gateway?: string): Promise<{ success: boolean; message: string }> {
    return fetchJson(`${API_BASE}/payments/simulate-webhook`, {
      method: 'POST',
      body: JSON.stringify({ orderCode, amount, gateway }),
    });
  },

  async getPaymentGatewayStatus(): Promise<{
    vietQrConfigured: boolean;
    payOsEnabled: boolean;
    cassoEnabled: boolean;
    webhookEndpoints: {
      payOs: string;
      casso: string;
      simulator: string;
    };
  }> {
    return fetchJson(`${API_BASE}/payments/gateway-status`);
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

  // Shifts & Cash Drawer Management
  async openShift(payload: { storeId: string; startingCash: number; notes?: string }): Promise<ShiftData> {
    return fetchJson(`${API_BASE}/shifts/open`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async closeShift(shiftId: string, payload: { actualEndingCash: number; notes?: string }): Promise<ShiftData> {
    return fetchJson(`${API_BASE}/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async addCashMovement(shiftId: string, payload: { amount: number; type: number; reason: string }): Promise<ShiftData> {
    return fetchJson(`${API_BASE}/shifts/${shiftId}/movement`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getCurrentShift(storeId?: string): Promise<CurrentShiftResponse> {
    const params = storeId ? `?storeId=${storeId}` : '';
    return fetchJson(`${API_BASE}/shifts/current${params}`);
  },

  async getZReport(shiftId: string): Promise<ZReportData> {
    return fetchJson(`${API_BASE}/shifts/${shiftId}/z-report`);
  },

  async getShiftHistory(storeId: string, pageNumber = 1, pageSize = 10): Promise<{ items: ShiftData[]; totalCount: number }> {
    return fetchJson(`${API_BASE}/shifts/history?storeId=${storeId}&pageNumber=${pageNumber}&pageSize=${pageSize}`);
  },

  async lookupCustomer(phoneNumber: string): Promise<CustomerLookupResponse> {
    return fetchJson(`${API_BASE}/loyalty/customers/lookup?phoneNumber=${encodeURIComponent(phoneNumber)}`);
  },

  async registerCustomer(payload: RegisterCustomerPayload): Promise<CustomerData> {
    return fetchJson(`${API_BASE}/loyalty/customers/register`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async applyPromotion(payload: ApplyPromotionPayload): Promise<ApplyPromotionResponse> {
    return fetchJson(`${API_BASE}/loyalty/promotions/apply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getActiveVouchers(phoneNumber?: string): Promise<VoucherData[]> {
    const params = phoneNumber ? `?phoneNumber=${encodeURIComponent(phoneNumber)}` : '';
    return fetchJson(`${API_BASE}/loyalty/vouchers${params}`);
  },

  async getPeakHoursAnalysis(storeId: string, date?: string): Promise<AdvancedPeakHoursAnalysis> {
    const params = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchJson(`${API_BASE}/reports/stores/${storeId}/peak-hours${params}`);
  },

  async getTopSellers(storeId: string, fromDate?: string, toDate?: string, top = 10): Promise<TopSellerItem[]> {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    params.append('top', top.toString());
    return fetchJson(`${API_BASE}/reports/stores/${storeId}/top-sellers?${params.toString()}`);
  },

  async getWasteShrinkageReport(storeId: string, fromDate?: string, toDate?: string): Promise<WasteShrinkageReport> {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    return fetchJson(`${API_BASE}/reports/stores/${storeId}/waste-shrinkage?${params.toString()}`);
  },

  async recordWaste(storeId: string, payload: RecordWastePayload): Promise<RecordWasteResponse> {
    return fetchJson(`${API_BASE}/stores/${storeId}/inventory/waste`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async broadcastLowStockAlerts(storeId: string, payload?: BroadcastAlertPayload): Promise<AlertBroadcastResult> {
    return fetchJson(`${API_BASE}/stores/${storeId}/inventory/alerts/broadcast`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },

  async updateStoreAlertConfig(storeId: string, payload: UpdateStoreAlertConfigPayload): Promise<boolean> {
    return fetchJson(`${API_BASE}/stores/${storeId}/inventory/alerts/config`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async submitStockAudit(storeId: string, payload: SubmitStockAuditPayload): Promise<SubmitStockAuditResponse> {
    return fetchJson(`${API_BASE}/stores/${storeId}/inventory/audit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getAutoReorderSuggestions(storeId: string, planningDays = 7, leadTimeDays = 2): Promise<AutoReorderSuggestionResponse> {
    const params = new URLSearchParams({
      planningDays: planningDays.toString(),
      leadTimeDays: leadTimeDays.toString(),
    });
    return fetchJson(`${API_BASE}/transfers/suggestions/${storeId}?${params.toString()}`);
  },
};

export interface CustomerData {
  id: string;
  phoneNumber: string;
  fullName: string;
  email?: string;
  dateOfBirth?: string;
  loyaltyPoints: number;
  totalSpent: number;
  memberTier: number; // 0: Standard, 1: Silver, 2: Gold, 3: Diamond
  createdAt: string;
}

export interface VoucherData {
  id: string;
  code: string;
  title: string;
  description?: string;
  discountType: number; // 1: Percentage, 2: FixedAmount
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  validTo: string;
  isApplicable: boolean;
}

export interface CustomerLookupResponse {
  found: boolean;
  customer?: CustomerData | null;
  tierDiscountPercent: number;
  availableVouchers: VoucherData[];
}

export interface RegisterCustomerPayload {
  phoneNumber: string;
  fullName: string;
  email?: string;
  dateOfBirth?: string;
}

export interface ApplyPromotionPayload {
  phoneNumber?: string;
  voucherCode?: string;
  pointsToRedeem: number;
  subtotal: number;
}

export interface ApplyPromotionResponse {
  success: boolean;
  message: string;
  tierDiscountAmount: number;
  voucherDiscountAmount: number;
  pointsDiscountAmount: number;
  totalDiscountAmount: number;
  pointsRedeemed: number;
  customer?: CustomerData | null;
  appliedVoucher?: VoucherData | null;
}

export interface ShiftCashMovement {
  id: string;
  shiftId: string;
  amount: number;
  type: number; // 1: CashIn, 2: CashOut
  reason: string;
  createdByUserId: string;
  createdByUserName?: string;
  createdAt: string;
}

export interface ShiftData {
  id: string;
  shiftNumber: string;
  storeId: string;
  storeName?: string;
  cashierId: string;
  cashierName?: string;
  openedAt: string;
  closedAt?: string;
  status: number; // 0: Open, 1: Closed, 2: ForceClosed
  startingCash: number;
  totalCashSales: number;
  totalBankTransferSales: number;
  totalCardSales: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedEndingCash: number;
  actualEndingCash?: number;
  cashDiscrepancy?: number;
  totalOrdersCount: number;
  notes?: string;
  movements: ShiftCashMovement[];
}

export interface CurrentShiftResponse {
  hasOpenShift: boolean;
  currentShift: ShiftData | null;
}

export interface ZReportData {
  shiftId: string;
  shiftNumber: string;
  storeName: string;
  cashierName: string;
  openedAt: string;
  closedAt: string;
  startingCash: number;
  totalCashSales: number;
  totalBankTransferSales: number;
  totalCardSales: number;
  totalRevenue: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedEndingCash: number;
  actualEndingCash: number;
  cashDiscrepancy: number;
  totalOrdersCount: number;
  notes?: string;
  movements: ShiftCashMovement[];
}

export interface HourlySalesPoint {
  hour: number;
  orderCount: number;
  revenue: number;
  isPeakHour: boolean;
}

export interface AdvancedPeakHoursAnalysis {
  storeId: string;
  storeName: string;
  date: string;
  totalOrders: number;
  totalRevenue: number;
  peakHourOrderCount: number;
  peakHourRevenue: number;
  busiestHour: number;
  busiestHourRange: string;
  recommendedStaffingOnPeak: number;
  recommendedStaffingOffPeak: number;
  hourlyDistribution: HourlySalesPoint[];
}

export interface TopSellerItem {
  productId: string;
  productName: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  estimatedProfit: number;
  marginPercentage: number;
  revenueSharePercentage: number;
  menuClassification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog';
}

export interface WasteItemDetail {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  theoreticalUsage: number;
  wastedQuantity: number;
  unitCost: number;
  totalWasteCost: number;
  shrinkageRatePercentage: number;
  status: 'Normal' | 'Warning' | 'Critical';
}

export interface WasteShrinkageReport {
  storeId: string;
  storeName: string;
  fromDate: string;
  toDate: string;
  totalTheoreticalUsage: number;
  totalWastedQuantity: number;
  totalWasteCost: number;
  overallShrinkageRatePercentage: number;
  healthRating: string;
  items: WasteItemDetail[];
}

export interface RecordWastePayload {
  storeId: string;
  ingredientId: string;
  quantity: number;
  reason: string;
}

export interface RecordWasteResponse {
  storeId: string;
  ingredientId: string;
  ingredientName: string;
  quantityWasted: number;
  remainingStock: number;
  reason: string;
  recordedAt: string;
}

export interface UpdateStoreAlertConfigPayload {
  managerEmail?: string;
  telegramChatId?: string;
}

export interface BroadcastAlertPayload {
  customTelegramChatId?: string;
  customManagerEmail?: string;
}

export interface AlertBroadcastResult {
  storeId: string;
  storeName: string;
  alertCount: number;
  lowStockItems: LowStockAlert[];
  telegramSent: boolean;
  telegramStatus?: string;
  emailSent: boolean;
  emailStatus?: string;
  sentAt: string;
}

export interface StockAuditItemPayload {
  ingredientId: string;
  physicalCount: number;
  note?: string;
}

export interface SubmitStockAuditPayload {
  storeId: string;
  auditorName: string;
  notes?: string;
  items: StockAuditItemPayload[];
}

export interface StockAuditDiscrepancyItem {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  systemStock: number;
  physicalCount: number;
  discrepancy: number;
  standardCost: number;
  totalValueDiscrepancy: number;
  note?: string;
}

export interface SubmitStockAuditResponse {
  storeId: string;
  storeName: string;
  auditorName: string;
  auditedAt: string;
  totalItemsAudited: number;
  discrepancyItemCount: number;
  totalDiscrepancyCost: number;
  items: StockAuditDiscrepancyItem[];
  message: string;
}

export interface AutoReorderSuggestionItem {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  currentStock: number;
  minAlertThreshold: number;
  averageDailyConsumption: number;
  recommendedOrderQuantity: number;
  standardCost: number;
  estimatedTotalCost: number;
  priority: "Critical" | "Warning" | "Normal" | string;
  reorderReason: string;
}

export interface AutoReorderSuggestionResponse {
  storeId: string;
  storeName: string;
  recommendedWarehouseId: string;
  recommendedWarehouseName: string;
  leadTimeDays: number;
  planningHorizonDays: number;
  totalItemsEvaluated: number;
  itemsNeedingReorderCount: number;
  totalEstimatedCost: number;
  suggestions: AutoReorderSuggestionItem[];
}



