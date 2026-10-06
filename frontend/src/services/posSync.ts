/**
 * POS Offline Sync Service
 * Handles bulk replay of locally cached offline orders to backend
 */

import { getTokenFromLocalStorage } from './auth.ts';
import {
  getPendingOfflineOrders,
  removeOfflineOrder,
  OfflineOrderSyncItem,
} from './offlineQueue.ts';
import { API_BASE } from '../config/api.ts';

export interface OfflineOrderSyncResult {
  offlineOrderId: string;
  idempotencyKey: string;
  status: 'Synced' | 'DuplicateSkipped' | 'Failed';
  serverOrderId?: string;
  orderNumber?: string;
  message?: string;
}

export interface BulkSyncOfflineOrdersResponse {
  totalProcessed: number;
  successfulCount: number;
  duplicateSkippedCount: number;
  failedCount: number;
  results: OfflineOrderSyncResult[];
}

export async function syncPendingOfflineOrders(
  storeId: string,
  deviceIdentifier = 'POS-CLIENT-WEB'
): Promise<BulkSyncOfflineOrdersResponse> {
  const pendingOrders = getPendingOfflineOrders();
  if (pendingOrders.length === 0) {
    return {
      totalProcessed: 0,
      successfulCount: 0,
      duplicateSkippedCount: 0,
      failedCount: 0,
      results: [],
    };
  }

  const token = getTokenFromLocalStorage();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const payload = {
    storeId,
    deviceIdentifier,
    orders: pendingOrders,
  };

  const response = await fetch(`${API_BASE}/pos/offline-sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = 'Lỗi đồng bộ ngoại tuyến';
    try {
      const problem = await response.json();
      errorDetail = problem.detail || problem.title || JSON.stringify(problem);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`[${response.status}] ${errorDetail}`);
  }

  const syncResult = (await response.json()) as BulkSyncOfflineOrdersResponse;

  // Xóa các đơn đã đồng bộ thành công hoặc đơn trùng lặp (không cần giữ lại)
  if (syncResult.results && syncResult.results.length > 0) {
    for (const r of syncResult.results) {
      if (r.status === 'Synced' || r.status === 'DuplicateSkipped') {
        removeOfflineOrder(r.offlineOrderId);
      }
    }
  }

  return syncResult;
}

export function initOfflineSyncListeners(
  storeId: string,
  onSyncComplete?: (res: BulkSyncOfflineOrdersResponse) => void
): () => void {
  const handleOnline = async () => {
    console.log('[POS Offline Sync] Network online detected. Initiating sync...');
    try {
      const res = await syncPendingOfflineOrders(storeId);
      if (res.totalProcessed > 0 && onSyncComplete) {
        onSyncComplete(res);
      }
    } catch (err) {
      console.warn('[POS Offline Sync] Background sync failed:', err);
    }
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
