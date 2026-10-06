import * as signalR from '@microsoft/signalr';
import { getTokenFromLocalStorage } from './auth.ts';

export interface OrderCompletedNotification {
  orderId: string;
  orderNumber: string;
  storeId: string;
  finalAmount: number;
  completedAt: string;
}

export interface InventoryUpdatedNotification {
  storeId: string;
  ingredientId: string;
  ingredientName: string;
  quantityDeducted: number;
  balanceAfter: number;
}

export interface LowStockAlertNotification {
  storeId: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  currentStock: number;
  minAlertThreshold: number;
  shortage: number;
  triggeredAt: string;
}

export type ConnectionStatus = 'Connected' | 'Reconnecting' | 'Disconnected' | 'Connecting';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private currentStoreId: string | null = null;
  private statusListeners: ((status: ConnectionStatus) => void)[] = [];
  private orderCompletedListeners: ((data: OrderCompletedNotification) => void)[] = [];
  private inventoryUpdatedListeners: ((data: InventoryUpdatedNotification[]) => void)[] = [];
  private lowStockAlertListeners: ((data: LowStockAlertNotification) => void)[] = [];

  constructor() {
    this.initConnection();
  }

  private initConnection() {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/franchise', {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        accessTokenFactory: () => getTokenFromLocalStorage() || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.onreconnecting(() => {
      this.notifyStatus('Reconnecting');
    });

    this.connection.onreconnected(async () => {
      this.notifyStatus('Connected');
      if (this.currentStoreId) {
        await this.joinStore(this.currentStoreId);
      }
      await this.joinHQ();
    });

    this.connection.onclose(() => {
      this.notifyStatus('Disconnected');
    });

    // Register Hub Events
    this.connection.on('ReceiveOrderCompleted', (data: OrderCompletedNotification) => {
      this.orderCompletedListeners.forEach((fn) => fn(data));
    });

    this.connection.on('ReceiveInventoryUpdated', (data: InventoryUpdatedNotification[]) => {
      this.inventoryUpdatedListeners.forEach((fn) => fn(data));
    });

    this.connection.on('ReceiveLowStockAlert', (data: LowStockAlertNotification) => {
      this.lowStockAlertListeners.forEach((fn) => fn(data));
    });
  }

  public async start(): Promise<void> {
    if (!this.connection) return;
    if (this.connection.state === signalR.HubConnectionState.Connected) return;

    this.notifyStatus('Connecting');
    try {
      await this.connection.start();
      this.notifyStatus('Connected');
      await this.joinHQ();
    } catch {
      this.notifyStatus('Disconnected');
    }
  }

  public async joinStore(storeId: string): Promise<void> {
    this.currentStoreId = storeId;
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('JoinStoreGroup', storeId);
      } catch (err) {
        console.warn('Failed to join store group:', err);
      }
    }
  }

  public async leaveStore(storeId: string): Promise<void> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('LeaveStoreGroup', storeId);
      } catch (err) {
        console.warn('Failed to leave store group:', err);
      }
    }
    if (this.currentStoreId === storeId) {
      this.currentStoreId = null;
    }
  }

  public async joinHQ(): Promise<void> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('JoinHQGroup');
      } catch (err) {
        console.warn('Failed to join HQ group:', err);
      }
    }
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter((fn) => fn !== callback);
    };
  }

  public onOrderCompleted(callback: (data: OrderCompletedNotification) => void): () => void {
    this.orderCompletedListeners.push(callback);
    return () => {
      this.orderCompletedListeners = this.orderCompletedListeners.filter((fn) => fn !== callback);
    };
  }

  public onInventoryUpdated(callback: (data: InventoryUpdatedNotification[]) => void): () => void {
    this.inventoryUpdatedListeners.push(callback);
    return () => {
      this.inventoryUpdatedListeners = this.inventoryUpdatedListeners.filter((fn) => fn !== callback);
    };
  }

  public onLowStockAlert(callback: (data: LowStockAlertNotification) => void): () => void {
    this.lowStockAlertListeners.push(callback);
    return () => {
      this.lowStockAlertListeners = this.lowStockAlertListeners.filter((fn) => fn !== callback);
    };
  }

  private notifyStatus(status: ConnectionStatus) {
    this.statusListeners.forEach((fn) => fn(status));
  }
}

export const realtimeHub = new SignalRService();
