/**
 * Supply Chain, Central Warehouse & Stock Transfer Orders (STO) Service
 * Interacts with /api/transfers and /api/warehouses
 */

import { getTokenFromLocalStorage } from './auth.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getAuthHeaders(): HeadersInit {
  const token = getTokenFromLocalStorage();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export type TransferStatus = 
  | 'Draft' 
  | 'Submitted' 
  | 'Approved' 
  | 'Rejected' 
  | 'Dispatched' 
  | 'Received' 
  | 'DiscrepancyReported' 
  | 'Cancelled';

export interface StockTransferItemDto {
  id: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  requestedQuantity: number;
  approvedQuantity: number;
  actualReceivedQuantity: number;
  discrepancyQuantity: number;
  unitCost: number;
  notes?: string;
}

export interface StockTransferOrderDto {
  id: string;
  transferCode: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  destinationStoreId: string;
  destinationStoreName: string;
  destinationStoreCode: string;
  status: TransferStatus;
  dispatchTrackingNumber?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  createdAt: string;
  createdByUserId: string;
  approvedByUserId?: string;
  notes?: string;
  rejectionReason?: string;
  discrepancyNotes?: string;
  items: StockTransferItemDto[];
}

export interface CreateTransferItemRequest {
  ingredientId: string;
  requestedQuantity: number;
  notes?: string;
}

export interface CreateTransferOrderRequest {
  sourceWarehouseId: string;
  destinationStoreId: string;
  notes?: string;
  items: CreateTransferItemRequest[];
}

export interface ApproveTransferItemDto {
  ingredientId: string;
  approvedQuantity: number;
}

export interface ApproveTransferOrderRequest {
  approvedItems: ApproveTransferItemDto[];
  notes?: string;
}

export interface DispatchTransferOrderRequest {
  dispatchTrackingNumber: string;
  notes?: string;
}

export interface ReceiveTransferItemDto {
  ingredientId: string;
  actualReceivedQuantity: number;
  notes?: string;
}

export interface ReceiveTransferOrderRequest {
  receivedItems: ReceiveTransferItemDto[];
  inspectionNotes?: string;
}

export interface WarehouseDto {
  id: string;
  code: string;
  name: string;
  address: string;
  contactPhone: string;
  isActive: boolean;
}

export interface WarehouseInventoryDto {
  id: string;
  warehouseId: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  currentStock: number;
  safetyStock: number;
  unitCost: number;
  lastRestockedAt?: string;
}

export interface WarehouseInboundItemRequest {
  ingredientId: string;
  quantity: number;
  unitCost: number;
}

export interface WarehouseInboundRequest {
  warehouseId: string;
  supplierCode: string;
  referenceNumber: string;
  notes?: string;
  items: WarehouseInboundItemRequest[];
}

export interface TransferOrderFilter {
  storeId?: string;
  warehouseId?: string;
  status?: string;
  searchTerm?: string;
  fromDate?: string;
  toDate?: string;
}

export async function getTransferOrders(filter?: TransferOrderFilter): Promise<StockTransferOrderDto[]> {
  const query = new URLSearchParams();
  if (filter?.storeId) query.append('storeId', filter.storeId);
  if (filter?.warehouseId) query.append('warehouseId', filter.warehouseId);
  if (filter?.status) query.append('status', filter.status);
  if (filter?.searchTerm) query.append('searchTerm', filter.searchTerm);
  if (filter?.fromDate) query.append('fromDate', filter.fromDate);
  if (filter?.toDate) query.append('toDate', filter.toDate);

  const url = `${API_BASE_URL}/api/transfers${query.toString() ? '?' + query.toString() : ''}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Lỗi tải danh sách đơn điều chuyển (${res.status})`);
  return res.json();
}

export async function getTransferOrderById(id: string): Promise<StockTransferOrderDto> {
  const res = await fetch(`${API_BASE_URL}/api/transfers/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Không tìm thấy đơn điều chuyển (${res.status})`);
  return res.json();
}

export async function createTransferOrder(request: CreateTransferOrderRequest): Promise<StockTransferOrderDto> {
  const res = await fetch(`${API_BASE_URL}/api/transfers`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || `Lỗi tạo đơn điều chuyển (${res.status})`);
  }
  return res.json();
}

export async function submitTransferOrder(id: string): Promise<StockTransferOrderDto> {
  const res = await fetch(`${API_BASE_URL}/api/transfers/${id}/submit`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || `Lỗi trình duyệt đơn (${res.status})`);
  }
  return res.json();
}

export async function approveTransferOrder(id: string, request: ApproveTransferOrderRequest): Promise<StockTransferOrderDto> {
  const res = await fetch(`${API_BASE_URL}/api/transfers/${id}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || `Lỗi phê duyệt đơn (${res.status})`);
  }
  return res.json();
}

export async function rejectTransferOrder(id: string, reason: string): Promise<StockTransferOrderDto> {
  const res = await fetch(`${API_BASE_URL}/api/transfers/${id}/reject`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || `Lỗi từ chối đơn (${res.status})`);
  }
  return res.json();
}

export async function dispatchTransferOrder(id: string, request: DispatchTransferOrderRequest): Promise<StockTransferOrderDto> {
  const res = await fetch(`${API_BASE_URL}/api/transfers/${id}/dispatch`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || `Lỗi xuất kho đơn điều chuyển (${res.status})`);
  }
  return res.json();
}

export async function receiveTransferOrder(id: string, request: ReceiveTransferOrderRequest): Promise<StockTransferOrderDto> {
  const res = await fetch(`${API_BASE_URL}/api/transfers/${id}/receive`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || `Lỗi nghiệm thu nhận hàng (${res.status})`);
  }
  return res.json();
}

export async function resolveDiscrepancy(id: string, resolutionNotes: string): Promise<StockTransferOrderDto> {
  const res = await fetch(`${API_BASE_URL}/api/transfers/${id}/resolve-discrepancy`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ resolutionNotes })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || `Lỗi xử lý biên bản lệch kho (${res.status})`);
  }
  return res.json();
}

export async function cancelTransferOrder(id: string): Promise<StockTransferOrderDto> {
  const res = await fetch(`${API_BASE_URL}/api/transfers/${id}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || `Lỗi hủy đơn điều chuyển (${res.status})`);
  }
  return res.json();
}

export async function getWarehouses(): Promise<WarehouseDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/warehouses`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Lỗi tải danh sách kho (${res.status})`);
  return res.json();
}

export async function getWarehouseInventory(warehouseId: string): Promise<WarehouseInventoryDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/warehouses/${warehouseId}/inventory`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Lỗi tải tồn kho kho tổng (${res.status})`);
  return res.json();
}

export async function inboundWarehouseStock(warehouseId: string, request: WarehouseInboundRequest): Promise<WarehouseInventoryDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/warehouses/${warehouseId}/inbound`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || `Lỗi nhập hàng vào kho tổng (${res.status})`);
  }
  return res.json();
}
