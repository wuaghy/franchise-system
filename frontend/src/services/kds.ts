/**
 * Kitchen Display System (KDS) & Barista Queue Service
 * Interacts with /api/stores/{storeId}/kds
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

export type KitchenTicketStatus = 'New' | 'InPreparation' | 'Ready' | 'Completed' | 'Cancelled';

export interface KitchenTicketItemModifierDto {
  id: string;
  modifierName: string;
  isChecked: boolean;
}

export interface KitchenTicketItemDto {
  id: string;
  orderItemId: string;
  productName: string;
  quantity: number;
  specialNote: string;
  isPrepared: boolean;
  modifiers: KitchenTicketItemModifierDto[];
}

export interface KitchenTicketDto {
  id: string;
  ticketNumber: string;
  orderId: string;
  storeId: string;
  orderNumber: string;
  orderType: string;
  status: KitchenTicketStatus;
  targetPreparationSeconds: number;
  createdAt: string;
  preparationStartedAt?: string;
  readyAt?: string;
  completedAt?: string;
  baristaUserId?: string;
  cancellationReason?: string;
  elapsedSeconds: number;
  slaStatus: 'Healthy' | 'Warning' | 'Critical' | 'Completed';
  items: KitchenTicketItemDto[];
}

export interface KitchenTicketStatusChangedNotification {
  ticketId: string;
  storeId: string;
  ticketNumber: string;
  status: string;
  timestamp: string;
}

export interface KitchenTicketItemToggledNotification {
  ticketId: string;
  storeId: string;
  itemId: string;
  isPrepared: boolean;
}

export const kdsService = {
  /**
   * Lấy danh sách các vé đang hoạt động (New, InPreparation, Ready) tại chi nhánh
   */
  async getActiveTickets(storeId: string): Promise<KitchenTicketDto[]> {
    const res = await fetch(`${API_BASE}/stores/${storeId}/kds/active`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể tải danh sách vé KDS');
    }
    return res.json();
  },

  /**
   * Lấy chi tiết vé KDS
   */
  async getTicketById(storeId: string, ticketId: string): Promise<KitchenTicketDto> {
    const res = await fetch(`${API_BASE}/stores/${storeId}/kds/tickets/${ticketId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể tải thông tin vé KDS');
    }
    return res.json();
  },

  /**
   * Bắt đầu pha chế vé KDS
   */
  async startPreparation(storeId: string, ticketId: string): Promise<KitchenTicketDto> {
    const res = await fetch(`${API_BASE}/stores/${storeId}/kds/tickets/${ticketId}/start`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể bắt đầu pha chế');
    }
    return res.json();
  },

  /**
   * Toggle hoàn thành món đơn lẻ
   */
  async toggleItemPrepared(storeId: string, ticketId: string, itemId: string): Promise<KitchenTicketDto> {
    const res = await fetch(`${API_BASE}/stores/${storeId}/kds/tickets/${ticketId}/items/${itemId}/toggle`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể cập nhật trạng thái món');
    }
    return res.json();
  },

  /**
   * Toggle topping / modifier
   */
  async toggleModifierChecked(storeId: string, ticketId: string, modifierId: string): Promise<KitchenTicketDto> {
    const res = await fetch(`${API_BASE}/stores/${storeId}/kds/tickets/${ticketId}/modifiers/${modifierId}/toggle`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể cập nhật topping');
    }
    return res.json();
  },

  /**
   * Đánh dấu pha chế xong (Ready)
   */
  async markReady(storeId: string, ticketId: string): Promise<KitchenTicketDto> {
    const res = await fetch(`${API_BASE}/stores/${storeId}/kds/tickets/${ticketId}/ready`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể đánh dấu hoàn thành pha chế');
    }
    return res.json();
  },

  /**
   * Trả đồ cho khách (Completed)
   */
  async completeTicket(storeId: string, ticketId: string): Promise<KitchenTicketDto> {
    const res = await fetch(`${API_BASE}/stores/${storeId}/kds/tickets/${ticketId}/complete`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể hoàn tất trả đồ');
    }
    return res.json();
  },

  /**
   * Hủy vé pha chế
   */
  async cancelTicket(storeId: string, ticketId: string, reason: string): Promise<KitchenTicketDto> {
    const res = await fetch(`${API_BASE}/stores/${storeId}/kds/tickets/${ticketId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.title || 'Không thể hủy vé KDS');
    }
    return res.json();
  },
};
