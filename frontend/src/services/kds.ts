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

export interface SlaCountdownResult {
  elapsed: number;
  remaining: number;
  targetSeconds: number;
  stage: 'healthy' | 'warning' | 'critical'; // Xanh -> Vàng -> Đỏ
  formattedRemaining: string;
  label: string;
  badgeClass: string;
  cardBorderClass: string;
}

/**
 * Format số giây thành định dạng MM:SS
 */
export function formatMinutesSeconds(seconds: number): string {
  const positive = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(positive / 60);
  const secs = positive % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Tính toán trạng thái SLA đếm ngược của Barista:
 * Chuẩn SLA 3 phút (180 giây).
 * - elapsed <= 90s: Xanh (Healthy)
 * - 90s < elapsed <= 180s: Vàng (Warning)
 * - elapsed > 180s: Đỏ (Critical - Trễ quá 3 phút)
 */
export function calculateKdsSlaCountdown(
  startTimeIso: string | undefined,
  targetSeconds = 180,
  nowMs = Date.now()
): SlaCountdownResult {
  const startMs = startTimeIso ? new Date(startTimeIso).getTime() : nowMs;
  const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const remaining = targetSeconds - elapsed;

  let stage: 'healthy' | 'warning' | 'critical' = 'healthy';
  let formattedRemaining = '';
  let label = '';
  let badgeClass = '';
  let cardBorderClass = '';

  if (elapsed > targetSeconds) {
    // Trễ quá 3 phút (Đỏ)
    stage = 'critical';
    const overTime = Math.abs(remaining);
    formattedRemaining = `-${formatMinutesSeconds(overTime)}`;
    label = `🔥 Trễ ${formatMinutesSeconds(overTime)} (Quá 3p)`;
    badgeClass = 'bg-red-100 text-red-700 border-red-400 animate-pulse';
    cardBorderClass = 'border-red-500 shadow-red-500/20 ring-2 ring-red-400/30';
  } else if (elapsed > 90) {
    // Cảnh báo sắp hết hạn SLA (Vàng)
    stage = 'warning';
    formattedRemaining = formatMinutesSeconds(remaining);
    label = `⚠️ Sắp hết: ${formattedRemaining} / 03:00`;
    badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    cardBorderClass = 'border-amber-400 shadow-amber-400/20';
  } else {
    // An toàn trong hạn mức (Xanh)
    stage = 'healthy';
    formattedRemaining = formatMinutesSeconds(remaining);
    label = `⏱️ Còn ${formattedRemaining} / 03:00`;
    badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    cardBorderClass = 'border-slate-200 hover:border-emerald-300';
  }

  return {
    elapsed,
    remaining,
    targetSeconds,
    stage,
    formattedRemaining,
    label,
    badgeClass,
    cardBorderClass
  };
}

/**
 * Trích xuất số thứ tự phục vụ từ OrderNumber hoặc TicketNumber
 * Ví dụ: "ORD-202610-0042" -> "42", "ORD-20261007-1234" -> "1234"
 */
export function extractOrderCallNumber(orderNumber: string, ticketNumber?: string): string {
  if (!orderNumber && !ticketNumber) return "quý khách";
  const parts = (orderNumber || "").split("-");
  const lastPart = parts[parts.length - 1];
  const cleaned = lastPart.replace(/^0+/, "");
  if (cleaned && /^\d+$/.test(cleaned)) {
    return cleaned;
  }
  if (ticketNumber) {
    const tParts = ticketNumber.split("-");
    const tLast = tParts[tParts.length - 1].replace(/^0+/, "");
    if (tLast && /^\d+$/.test(tLast)) {
      return tLast;
    }
  }
  return cleaned || orderNumber;
}

/**
 * Tạo nội dung thông báo giọng nói TTS chuẩn
 */
export function buildTtsAnnouncement(orderNumber: string, ticketNumber?: string): string {
  const callNum = extractOrderCallNumber(orderNumber, ticketNumber);
  return `Mời quý khách số ${callNum} nhận đồ tại quầy`;
}

/**
 * Phát giọng nói Web Speech API (TTS tiếng Việt)
 */
export function announceCustomerPickup(orderNumber: string, ticketNumber?: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const text = buildTtsAnnouncement(orderNumber, ticketNumber);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(
      (v) => v.lang.toLowerCase() === "vi-vn" || v.lang.toLowerCase().startsWith("vi")
    );
    if (viVoice) {
      utterance.voice = viVoice;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn("TTS Error:", err);
    return false;
  }
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
