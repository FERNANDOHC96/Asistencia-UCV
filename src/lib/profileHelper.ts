import { getSupabaseClient } from './supabase';
import { Profile } from '../types';

export type ProfileBasicInfo = Pick<Profile, 'id' | 'code' | 'first_names' | 'last_names'>;

/**
 * Helper reutilizable para resolver perfiles a partir de una lista de IDs de usuario
 * sin realizar joins anidados directos con la tabla 'profiles'.
 * 
 * 1. Recibe los IDs (teacher_id o student_id).
 * 2. Consulta profiles con .in('id', [...]) pidiendo id, code, first_names, last_names.
 * 3. Retorna un mapa { [id]: profile } para unir los resultados en memoria.
 */
export async function fetchProfilesMapByIds(
  ids: string[]
): Promise<Record<string, ProfileBasicInfo>> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => Boolean(id && typeof id === 'string'))));
  if (uniqueIds.length === 0) {
    return {};
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, code, first_names, last_names')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  const map: Record<string, ProfileBasicInfo> = {};
  (data || []).forEach((p) => {
    map[p.id] = p as ProfileBasicInfo;
  });

  return map;
}
