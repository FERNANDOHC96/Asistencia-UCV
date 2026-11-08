import { getSupabaseClient } from './supabase';
import { Profile } from '../types';

export type ProfileBasicInfo = Pick<Profile, 'id' | 'code' | 'first_names' | 'last_names' | 'avatar_updated_at'>;

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
    .select('id, code, first_names, last_names, avatar_updated_at')
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
