/**
 * Global API and Realtime Hub Configuration
 *
 * Local Development:
 *   If VITE_API_URL is omitted or empty, requests use relative paths ('/api' & '/hubs/franchise'),
 *   which are automatically proxied by Vite dev server to backend (http://localhost:5000).
 *
 * Production (Vercel / Cloud):
 *   Set VITE_API_URL in Vercel environment variables (e.g. 'https://api.yourdomain.com' or 'http://<ORACLE_VM_IP>:5000').
 *   All requests and SignalR WebSockets will communicate directly with the production backend.
 */

export const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const API_BASE = `${BACKEND_URL}/api`;
export const HUB_URL = `${BACKEND_URL}/hubs/franchise`;
