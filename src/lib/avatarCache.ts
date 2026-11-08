import { useEffect, useState, useRef, useCallback } from 'react';
import { getSupabaseClient } from './supabase';

interface CachedAvatar {
  url: string;
  expiresAt: number;
}

const memoryCache = new Map<string, CachedAvatar>();

const SIGNED_URL_EXPIRES_IN = 3600;

const RENEW_BEFORE_MS = 5 * 60 * 1000;

export interface StudentAvatarInput {
  id: string;
  avatar_updated_at?: string | null;
}

export async function getBatchStudentAvatarUrls(
  students: StudentAvatarInput[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const now = Date.now();

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

      console.warn('No se pudieron obtener URLs de avatares:', error.message);
      return result;
    }

    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (!item || item.error || !item.signedUrl) return;

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

    console.warn('Error al solicitar URLs firmadas de avatares:', err);
  }

  return result;
}

export function useStudentAvatarUrls(
  students: (StudentAvatarInput | undefined | null)[]
): Record<string, string> {
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const isMountedRef = useRef(true);

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
