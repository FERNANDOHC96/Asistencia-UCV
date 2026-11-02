import { useEffect, useState, useRef, useCallback } from 'react';
import { getSupabaseClient } from './supabase';

interface CachedAvatar {
  url: string;
  expiresAt: number;
}

// Caché en memoria para URLs firmadas: clave `${id}:${avatar_updated_at}`
const memoryCache = new Map<string, CachedAvatar>();

// 3600 segundos (1 hora) de validez
const SIGNED_URL_EXPIRES_IN = 3600;
// Renovar 5 minutos antes de que expire (300 segundos = 300,000 ms)
const RENEW_BEFORE_MS = 5 * 60 * 1000;

export interface StudentAvatarInput {
  id: string;
  avatar_updated_at?: string | null;
}

/**
 * Obtiene URLs firmadas en lote para alumnos que tienen avatar_updated_at no nulo.
 * Si ya están en caché y faltan más de 5 min para expirar, reutiliza la URL.
 */
export async function getBatchStudentAvatarUrls(
  students: StudentAvatarInput[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const now = Date.now();

  // Filtrar solo los que tienen avatar_updated_at válido
  const studentsWithPhoto = students.filter(
    (s) => Boolean(s && s.id && s.avatar_updated_at)
  );

  if (studentsWithPhoto.length === 0) {
    return result;
  }

  const toFetch: StudentAvatarInput[] = [];

  studentsWithPhoto.forEach((s) => {
    const cacheKey = `${s.id}:${s.avatar_updated_at}`;
    const cached = memoryCache.get(cacheKey);

    if (cached && cached.expiresAt - now > RENEW_BEFORE_MS) {
      result[s.id] = cached.url;
    } else {
      toFetch.push(s);
    }
  });

  if (toFetch.length === 0) {
    return result;
  }

  try {
    const supabase = getSupabaseClient();
    const paths = toFetch.map((s) => `${s.id}/avatar.jpg`);

    const { data, error } = await supabase.storage
      .from('avatars')
      .createSignedUrls(paths, SIGNED_URL_EXPIRES_IN);

    if (error) {
      // Si falla, se ignora silenciosamente para mostrar iniciales sin error
      console.warn('No se pudieron obtener URLs de avatares:', error.message);
      return result;
    }

    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (!item || item.error || !item.signedUrl) return;

        // El path es `${id}/avatar.jpg`
        const studentId = item.path?.split('/')[0];
        if (!studentId) return;

        const student = toFetch.find((s) => s.id === studentId);
        if (!student || !student.avatar_updated_at) return;

        const cacheKey = `${student.id}:${student.avatar_updated_at}`;
        const expiresAt = now + SIGNED_URL_EXPIRES_IN * 1000;

        memoryCache.set(cacheKey, {
          url: item.signedUrl,
          expiresAt,
        });

        result[student.id] = item.signedUrl;
      });
    }
  } catch (err) {
    // Si la URL falla o lanza excepción, no mostrar error al usuario
    console.warn('Error al solicitar URLs firmadas de avatares:', err);
  }

  return result;
}

/**
 * Hook para cargar y mantener actualizadas las URLs firmadas de avatares de una lista de alumnos.
 */
export function useStudentAvatarUrls(
  students: (StudentAvatarInput | undefined | null)[]
): Record<string, string> {
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const isMountedRef = useRef(true);

  // Serializar ids y timestamps para evitar re-fetches innecesarios
  const validStudents = (students || []).filter(
    (s): s is StudentAvatarInput => Boolean(s && s.id && s.avatar_updated_at)
  );
  const cacheSignature = validStudents
    .map((s) => `${s.id}:${s.avatar_updated_at}`)
    .sort()
    .join('|');

  const loadUrls = useCallback(async () => {
    if (validStudents.length === 0) {
      if (isMountedRef.current) setAvatarUrls({});
      return;
    }

    const urls = await getBatchStudentAvatarUrls(validStudents);
    if (isMountedRef.current) {
      setAvatarUrls(urls);
    }
  }, [cacheSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    isMountedRef.current = true;
    loadUrls();

    // Renovar periódicamente cada 5 minutos para refrescar antes de que expiren (3600s)
    const interval = setInterval(() => {
      loadUrls();
    }, 5 * 60 * 1000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [loadUrls]);

  return avatarUrls;
}
