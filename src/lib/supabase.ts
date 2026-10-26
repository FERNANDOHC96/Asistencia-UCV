import { createClient, SupabaseClient } from '@supabase/supabase-js';

// CONFIGURACIÓN DE CONEXIÓN A SUPABASE
export const URL = 'https://bqnwlzkzmneinmzxafsb.supabase.co';
export const CLAVE_PUBLICA = 'sb_publishable_HUCcRbtEW6BfCJvjeOYisA_kxujnWQ7';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    ''
  ).trim();
  const envKey = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    ''
  ).trim();

  const url = (envUrl || URL).trim().replace(/\/+$/, '');
  const anonKey = (envKey || CLAVE_PUBLICA).trim();

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) return false;
  if (!url.startsWith('https://') && !url.startsWith('http://')) return false;

  // Validación flexible: acepta claves que empiezan con "sb_publishable_" (nuevo formato de Supabase)
  // o con "eyJ" (formato JWT tradicional), o cualquier clave no vacía con longitud razonable.
  const isValidKey =
    anonKey.startsWith('sb_publishable_') ||
    anonKey.startsWith('eyJ') ||
    anonKey.length >= 20;

  return isValidKey;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  if (!cachedClient) {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return cachedClient;
}

export const supabase = getSupabaseClient();
