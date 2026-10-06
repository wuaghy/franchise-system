/**
 * Business Intelligence, Financial Reporting & Franchise Royalty Invoicing Service
 * Interacts with /api/reports and /api/royalty
 */

import { getTokenFromLocalStorage } from './auth.ts';
import { API_BASE } from '../config/api.ts';

function getAuthHeaders(): HeadersInit {
  const token = getTokenFromLocalStorage();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export interface FinancialSummaryDto {
  storeId: string;
  storeName: string;
  fromDate: string;
  toDate: string;
  totalOrders: number;
  grossRevenue: number;
  discountAmount: number;
  vatAmount: number;
  netRevenue: number;
  averageOrderValue: number;
  estimatedCogs: number;
  estimatedGrossProfit: number;
  grossMarginPercentage: number;
}

export interface HourlySalesPointDto {
  hour: number; // 0 - 23
  orderCount: number;
  revenue: number;
  isPeakHour: boolean;
}

export interface HourlySalesHeatmapDto {
  storeId: string;
  storeName: string;
  date: string;
  totalOrders: number;
  totalRevenue: number;
  hourlyDistribution: HourlySalesPointDto[];
}

export interface ProductSalesRankDto {
  productId: string;
  productName: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  estimatedCogs: number;
  estimatedGrossProfit: number;
  marginPercentage: number;
  revenueSharePercentage: number;
}

export interface NetworkStoreComparisonDto {
  storeId: string;
  storeCode: string;
  storeName: string;
  totalOrders: number;
  grossRevenue: number;
  netRevenue: number;
  estimatedGrossProfit: number;
  royaltyDue: number;
}

export interface NetworkOverviewDto {
  fromDate: string;
  toDate: string;
  totalNetworkStores: number;
  totalNetworkOrders: number;
  totalNetworkRevenue: number;
  totalRoyaltyDue: number;
  storeRankings: NetworkStoreComparisonDto[];
}

export type RoyaltyInvoiceStatus = 'Draft' | 'Issued' | 'Paid' | 'Overdue' | 'Cancelled';

export interface RoyaltyInvoiceDto {
  id: string;
  invoiceNumber: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  billingYear: number;
  billingMonth: number;
  status: RoyaltyInvoiceStatus;
  totalOrdersCount: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  royaltyRate: number;
  royaltyFee: number;
  marketingFeeRate: number;
  marketingFee: number;
  techFee: number;
  totalDue: number;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  paymentReference?: string;
  cancellationReason?: string;
  createdAt: string;
}

export interface StoreRoyaltySettingDto {
  storeId: string;
  storeName: string;
  royaltyRate: number;
  marketingFeeRate: number;
  techFeeFixedMonthly: number;
  isActive: boolean;
}

export interface UpdateStoreRoyaltySettingRequest {
  royaltyRate: number;
  marketingFeeRate: number;
  techFeeFixedMonthly: number;
  isActive: boolean;
}

export interface GenerateRoyaltyInvoiceRequest {
  storeId: string;
  billingYear: number;
  billingMonth: number;
}

export interface PayRoyaltyInvoiceRequest {
  paymentReference: string;
}

export interface CancelRoyaltyInvoiceRequest {
  reason: string;
}

export const reportsService = {
  /**
   * Lấy tổng hợp tài chính của chi nhánh
   */
  async getStoreSummary(storeId: string, fromDate?: string, toDate?: string): Promise<FinancialSummaryDto> {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);

    const res = await fetch(`${API_BASE}/reports/stores/${storeId}/summary?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể tải báo cáo tài chính');
    }
    return res.json();
  },

  /**
   * Biểu đồ nhiệt doanh thu theo 24 giờ
   */
  async getHourlyHeatmap(storeId: string, date?: string): Promise<HourlySalesHeatmapDto> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);

    const res = await fetch(`${API_BASE}/reports/stores/${storeId}/hourly-heatmap?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể tải biểu đồ nhiệt 24h');
    }
    return res.json();
  },

  /**
   * Hiệu suất bán hàng theo danh mục món
   */
  async getProductPerformance(storeId: string, fromDate?: string, toDate?: string, top: number = 10): Promise<ProductSalesRankDto[]> {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    params.append('top', top.toString());

    const res = await fetch(`${API_BASE}/reports/stores/${storeId}/products?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể tải bảng xếp hạng món');
    }
    return res.json();
  },

  /**
   * Tổng quan toàn mạng lưới dành cho HQ Admin
   */
  async getNetworkOverview(fromDate?: string, toDate?: string): Promise<NetworkOverviewDto> {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);

    const res = await fetch(`${API_BASE}/reports/network/overview?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể tải báo cáo toàn mạng lưới');
    }
    return res.json();
  },

  /**
   * Danh sách hóa đơn thu phí nhượng quyền
   */
  async getRoyaltyInvoices(storeId?: string, year?: number, month?: number): Promise<RoyaltyInvoiceDto[]> {
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId);
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());

    const res = await fetch(`${API_BASE}/royalty/invoices?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể tải danh sách hóa đơn nhượng quyền');
    }
    return res.json();
  },

  /**
   * Lấy chi tiết hóa đơn phí nhượng quyền
   */
  async getRoyaltyInvoiceById(invoiceId: string): Promise<RoyaltyInvoiceDto> {
    const res = await fetch(`${API_BASE}/royalty/invoices/${invoiceId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể tải thông tin hóa đơn');
    }
    return res.json();
  },

  /**
   * Tạo hóa đơn tính phí nhượng quyền cho một chi nhánh
   */
  async generateRoyaltyInvoice(request: GenerateRoyaltyInvoiceRequest): Promise<RoyaltyInvoiceDto> {
    const res = await fetch(`${API_BASE}/royalty/invoices/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể tính toán phí nhượng quyền');
    }
    return res.json();
  },

  /**
   * Tự động sinh hóa đơn cho toàn mạng lưới
   */
  async generateNetworkRoyaltyInvoices(year: number, month: number): Promise<RoyaltyInvoiceDto[]> {
    const res = await fetch(`${API_BASE}/royalty/invoices/generate-network?year=${year}&month=${month}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể sinh hóa đơn toàn mạng lưới');
    }
    return res.json();
  },

  /**
   * Phát hành hóa đơn
   */
  async issueRoyaltyInvoice(invoiceId: string): Promise<RoyaltyInvoiceDto> {
    const res = await fetch(`${API_BASE}/royalty/invoices/${invoiceId}/issue`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể phát hành hóa đơn');
    }
    return res.json();
  },

  /**
   * Xác nhận thanh toán hóa đơn
   */
  async payRoyaltyInvoice(invoiceId: string, request: PayRoyaltyInvoiceRequest): Promise<RoyaltyInvoiceDto> {
    const res = await fetch(`${API_BASE}/royalty/invoices/${invoiceId}/pay`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể xác nhận thanh toán');
    }
    return res.json();
  },

  /**
   * Hủy hóa đơn
   */
  async cancelRoyaltyInvoice(invoiceId: string, request: CancelRoyaltyInvoiceRequest): Promise<RoyaltyInvoiceDto> {
    const res = await fetch(`${API_BASE}/royalty/invoices/${invoiceId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể hủy hóa đơn');
    }
    return res.json();
  },

  /**
   * Lấy cấu hình phí chi nhánh
   */
  async getStoreRoyaltySetting(storeId: string): Promise<StoreRoyaltySettingDto> {
    const res = await fetch(`${API_BASE}/royalty/settings/${storeId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể tải cấu hình tỷ lệ phí');
    }
    return res.json();
  },

  /**
   * Cập nhật cấu hình phí chi nhánh
   */
  async updateStoreRoyaltySetting(storeId: string, request: UpdateStoreRoyaltySettingRequest): Promise<StoreRoyaltySettingDto> {
    const res = await fetch(`${API_BASE}/royalty/settings/${storeId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể cập nhật cấu hình tỷ lệ phí');
    }
    return res.json();
  },
};
