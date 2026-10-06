/**
 * Costing and BoM Studio Service
 * Interacts with /api/costing, /api/products, /api/ingredients, /api/products/{id}/recipe
 */

import { getTokenFromLocalStorage } from './auth.ts';

export interface IngredientCostDetail {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  costSharePercentage: number;
}

export interface ProductCosting {
  productId: string;
  sku: string;
  name: string;
  sellingPrice: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPercentage: number;
  marginStatus: 'Healthy' | 'Warning' | 'Critical';
  costBreakdown: IngredientCostDetail[];
}

export interface SimulateIngredientItem {
  ingredientId: string;
  quantity: number;
}

export interface SimulateRecipeRequest {
  sellingPrice: number;
  items: SimulateIngredientItem[];
}

export interface SimulateRecipeResponse {
  sellingPrice: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPercentage: number;
  marginStatus: 'Healthy' | 'Warning' | 'Critical';
  breakdown: {
    ingredientId: string;
    ingredientCode: string;
    ingredientName: string;
    unit: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    costSharePercentage: number;
  }[];
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

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getTokenFromLocalStorage();
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let msg = 'Request failed';
    try {
      const p = await res.json();
      msg = p.detail || p.title || JSON.stringify(p);
    } catch {
      msg = await res.text();
    }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

export const costingApi = {
  // 1. Lấy danh sách sản phẩm
  async getProducts(): Promise<ProductItem[]> {
    return requestJson<ProductItem[]>('/api/products');
  },

  // 2. Lấy danh sách nguyên vật liệu kho
  async getIngredients(): Promise<IngredientItem[]> {
    return requestJson<IngredientItem[]>('/api/ingredients');
  },

  // 3. Lấy phân tích COGS toàn bộ menu
  async getAllProductsCosting(storeId?: string): Promise<ProductCosting[]> {
    const q = storeId ? `?storeId=${storeId}` : '';
    return requestJson<ProductCosting[]>(`/api/costing/products${q}`);
  },

  // 4. Lấy chi tiết COGS của một món
  async getProductCosting(productId: string, storeId?: string): Promise<ProductCosting> {
    const q = storeId ? `?storeId=${storeId}` : '';
    return requestJson<ProductCosting>(`/api/costing/products/${productId}${q}`);
  },

  // 5. Sandbox What-If simulation
  async simulateRecipe(payload: SimulateRecipeRequest): Promise<SimulateRecipeResponse> {
    return requestJson<SimulateRecipeResponse>('/api/costing/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 6. Lưu công thức chính thức
  async saveProductRecipe(productId: string, items: { ingredientId: string; quantity: number }[]): Promise<void> {
    const token = getTokenFromLocalStorage();
    const res = await fetch(`/api/products/${productId}/recipe`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      let msg = 'Không thể lưu công thức';
      try {
        const p = await res.json();
        msg = p.detail || p.title || msg;
      } catch {
        msg = await res.text();
      }
      throw new Error(msg);
    }
  },
};
