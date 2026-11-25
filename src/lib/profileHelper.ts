import { getSupabaseClient } from './supabase';
import { Profile } from '../types';

export type ProfileBasicInfo = Pick<
  Profile,
  'id' | 'code' | 'first_names' | 'last_names' | 'avatar_updated_at' | 'career_id' | 'career'
>;

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
    .select('id, code, first_names, last_names, avatar_updated_at, career_id, career:careers(id, name)')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  const map: Record<string, ProfileBasicInfo> = {};
  (data || []).forEach((p: any) => {
    const careerObj = Array.isArray(p.career) ? p.career[0] || null : p.career || null;
    map[p.id] = {
      ...p,
      career: careerObj,
    } as ProfileBasicInfo;
  });

  return map;
}
