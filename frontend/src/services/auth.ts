export function getTokenFromLocalStorage(): string | null {
    const raw = localStorage.getItem('token');
    return raw ? raw : null;
}

export interface User {
    id: string;
    username: string;
    email: string;
    role: 'HQ_SuperAdmin' | 'Franchise_Owner' | 'Store_Manager' | 'POS_Cashier' | 'Supply_Chain_Officer';
    franchiseeId?: string;
    storeId?: string;
    isActive: boolean;
}

export interface LoginResponse {
    userId: string;
    token: string;
    role: string;
    franchiseeId?: string;
    storeId?: string;
}

export interface LoginPayload {
    username: string;
    password: string;
}
