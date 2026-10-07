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

const envApiUrl =
  typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL
    ? (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL
    : '';
const rawUrl = (envApiUrl || '').replace(/\/$/, '');

// If page is served over HTTPS and backend URL is HTTP, use relative proxy to avoid Mixed Content blocks
const isMixedContent =
  typeof window !== 'undefined' &&
  window.location.protocol === 'https:' &&
  rawUrl.startsWith('http://');

export const BACKEND_URL = isMixedContent ? '' : rawUrl;
export const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';
export const HUB_URL = BACKEND_URL ? `${BACKEND_URL}/hubs/franchise` : '/hubs/franchise';

