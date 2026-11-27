import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { fetchProfilesMapByIds, ProfileBasicInfo } from '../lib/profileHelper';
import { translateSupabaseError, translateUnblockStudentError } from '../lib/supabaseErrors';
import {
  StudentSectionBlock,
  StudentBlockRecordWithDetails,
  SectionStudentBlockStatus,
} from '../types';

const BLOCK_SELECT_COLUMNS =
  'student_id, section_id, blocked_at, blocked_by, reason, unblocked_at, unblocked_by, unblock_reason, absences_at_unblock';

interface SectionMeta {
  sectionId: string;
  sectionName: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  periodName: string;
}

function pickSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function fetchSectionsMeta(sectionIds: string[]): Promise<Record<string, SectionMeta>> {
  const uniqueIds = Array.from(new Set(sectionIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sections')
    .select(
      'id, name, offering:course_offerings(id, course:courses(id, code, name), period:periods(id, name))'
    )
    .in('id', uniqueIds);

  if (error) throw error;

  const map: Record<string, SectionMeta> = {};
  (data || []).forEach((row: any) => {
    const offering = pickSingle(row.offering);
    const course = pickSingle(offering?.course);
    const period = pickSingle(offering?.period);
    map[row.id] = {
      sectionId: row.id,
      sectionName: row.name || '--',
      courseId: course?.id || '',
      courseCode: course?.code || 'S/C',
      courseName: course?.name || 'Curso',
      periodName: period?.name || 'Periodo',
    };
  });

  return map;
}

async function fetchAbsencesCountBySectionAndStudent(
  sectionIds: string[],
  studentIds?: string[]
): Promise<Record<string, number>> {
  const uniqueSections = Array.from(new Set(sectionIds.filter(Boolean)));
  if (uniqueSections.length === 0) return {};

  const supabase = getSupabaseClient();
  const { data: sessionsData, error: sessErr } = await supabase
    .from('class_sessions')
    .select('id, section_id')
    .in('section_id', uniqueSections)
    .is('archived_at', null);

  if (sessErr) throw sessErr;
  if (!sessionsData || sessionsData.length === 0) return {};

  const sessionToSection: Record<string, string> = {};
  const sessionIds: string[] = [];
  sessionsData.forEach((s) => {
    sessionToSection[s.id] = s.section_id;
    sessionIds.push(s.id);
  });

  let recQuery = supabase
    .from('attendance_records')
    .select('student_id, class_session_id')
    .in('class_session_id', sessionIds)
    .eq('status', 'falta');

  const uniqueStudents = studentIds
    ? Array.from(new Set(studentIds.filter(Boolean)))
    : [];
  if (uniqueStudents.length > 0) {
    recQuery = recQuery.in('student_id', uniqueStudents);
  }

  const { data: recordsData, error: recErr } = await recQuery;
  if (recErr) throw recErr;

  const counts: Record<string, number> = {};
  (recordsData || []).forEach((rec) => {
    const sectionId = sessionToSection[rec.class_session_id];
    if (!sectionId) return;
    const key = `${rec.student_id}::${sectionId}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  return counts;
}

function getLatestUnblockForPair(
  blocks: StudentSectionBlock[],
  studentId: string,
  sectionId: string
): StudentSectionBlock | null {
  const unblocked = blocks
    .filter(
      (b) =>
        b.student_id === studentId &&
        b.section_id === sectionId &&
        Boolean(b.unblocked_at)
    )
    .sort(
      (a, b) =>
        new Date(b.unblocked_at || 0).getTime() - new Date(a.unblocked_at || 0).getTime()
    );
  return unblocked[0] || null;
}

export async function fetchActiveBlockedCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('student_section_blocks')
    .select('student_id', { count: 'exact', head: true })
    .is('unblocked_at', null);

  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function fetchAllStudentSectionBlocks(): Promise<StudentBlockRecordWithDetails[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('student_section_blocks')
    .select(BLOCK_SELECT_COLUMNS)
    .order('blocked_at', { ascending: false });

  if (error) throw error;

  const blocks = (data || []) as StudentSectionBlock[];
  if (blocks.length === 0) return [];

  const studentIds = blocks.map((b) => b.student_id);
  const unblockedByIds = blocks
    .map((b) => b.unblocked_by)
    .filter((id): id is string => Boolean(id));
  const sectionIds = blocks.map((b) => b.section_id);

  const [profilesMap, sectionsMeta, absencesMap] = await Promise.all([
    fetchProfilesMapByIds([...studentIds, ...unblockedByIds]),
    fetchSectionsMeta(sectionIds),
    fetchAbsencesCountBySectionAndStudent(sectionIds, studentIds),
  ]);

  return blocks.map((block) => {
    const student: ProfileBasicInfo | undefined = profilesMap[block.student_id];
    const unblockedBy: ProfileBasicInfo | undefined = block.unblocked_by
      ? profilesMap[block.unblocked_by]
      : undefined;
    const section = sectionsMeta[block.section_id];
    const key = `${block.student_id}::${block.section_id}`;
    const totalAbsences = absencesMap[key] || 0;
    const lastUnblock = getLatestUnblockForPair(blocks, block.student_id, block.section_id);
    const isActive = !block.unblocked_at;

    let cycleAbsences = totalAbsences;
    if (isActive && lastUnblock && lastUnblock.absences_at_unblock !== null && lastUnblock.absences_at_unblock !== undefined) {
      cycleAbsences = Math.max(0, totalAbsences - Number(lastUnblock.absences_at_unblock));
    } else if (!isActive && block.absences_at_unblock !== null && block.absences_at_unblock !== undefined) {
      cycleAbsences = Number(block.absences_at_unblock);
    }

    return {
      ...block,
      studentName: student
        ? `${student.last_names}, ${student.first_names}`
        : 'Alumno sin perfil',
      studentCode: student?.code || '--',
      courseId: section?.courseId || '',
      courseCode: section?.courseCode || 'S/C',
      courseName: section?.courseName || 'Curso',
      sectionName: section?.sectionName || '--',
      periodName: section?.periodName || '',
      totalAbsences,
      cycleAbsences,
      isActive,
      unblockedByName: unblockedBy
        ? `${unblockedBy.last_names}, ${unblockedBy.first_names}`
        : null,
    };
  });
}

export async function fetchSectionStudentsBlockStatus(
  sectionId: string,
  studentIds: string[]
): Promise<Record<string, SectionStudentBlockStatus>> {
  const result: Record<string, SectionStudentBlockStatus> = {};
  if (!isSupabaseConfigured() || !sectionId || studentIds.length === 0) {
    return result;
  }

  const supabase = getSupabaseClient();
  const [blocksRes, absencesMap] = await Promise.all([
    supabase
      .from('student_section_blocks')
      .select(BLOCK_SELECT_COLUMNS)
      .eq('section_id', sectionId)
      .in('student_id', studentIds)
      .order('blocked_at', { ascending: false }),
    fetchAbsencesCountBySectionAndStudent([sectionId], studentIds),
  ]);

  if (blocksRes.error) throw blocksRes.error;
  const blocks = (blocksRes.data || []) as StudentSectionBlock[];

  for (const studentId of studentIds) {
    const studentBlocks = blocks.filter((b) => b.student_id === studentId);
    const activeBlock = studentBlocks.find((b) => !b.unblocked_at) || null;
    const lastUnblock =
      studentBlocks
        .filter((b) => Boolean(b.unblocked_at))
        .sort(
          (a, b) =>
            new Date(b.unblocked_at || 0).getTime() - new Date(a.unblocked_at || 0).getTime()
        )[0] || null;

    const totalAbsences = absencesMap[`${studentId}::${sectionId}`] || 0;
    const baseline =
      lastUnblock &&
      lastUnblock.absences_at_unblock !== null &&
      lastUnblock.absences_at_unblock !== undefined
        ? Number(lastUnblock.absences_at_unblock)
        : 0;
    const cycleAbsences = Math.max(0, totalAbsences - baseline);

    result[studentId] = {
      isBlocked: Boolean(activeBlock),
      activeBlock,
      lastUnblock,
      totalAbsences,
      cycleAbsences,
    };
  }

  return result;
}

export async function fetchStudentBlocksBySection(
  studentId: string,
  sectionIds: string[]
): Promise<Record<string, SectionStudentBlockStatus>> {
  const result: Record<string, SectionStudentBlockStatus> = {};
  if (!isSupabaseConfigured() || !studentId || sectionIds.length === 0) {
    return result;
  }

  const supabase = getSupabaseClient();
  const [blocksRes, absencesMap] = await Promise.all([
    supabase
      .from('student_section_blocks')
      .select(BLOCK_SELECT_COLUMNS)
      .eq('student_id', studentId)
      .in('section_id', sectionIds)
      .order('blocked_at', { ascending: false }),
    fetchAbsencesCountBySectionAndStudent(sectionIds, [studentId]),
  ]);

  if (blocksRes.error) throw blocksRes.error;
  const blocks = (blocksRes.data || []) as StudentSectionBlock[];

  for (const sectionId of sectionIds) {
    const secBlocks = blocks.filter((b) => b.section_id === sectionId);
    const activeBlock = secBlocks.find((b) => !b.unblocked_at) || null;
    const lastUnblock =
      secBlocks
        .filter((b) => Boolean(b.unblocked_at))
        .sort(
          (a, b) =>
            new Date(b.unblocked_at || 0).getTime() - new Date(a.unblocked_at || 0).getTime()
        )[0] || null;

    const totalAbsences = absencesMap[`${studentId}::${sectionId}`] || 0;
    const baseline =
      lastUnblock &&
      lastUnblock.absences_at_unblock !== null &&
      lastUnblock.absences_at_unblock !== undefined
        ? Number(lastUnblock.absences_at_unblock)
        : 0;
    const cycleAbsences = Math.max(0, totalAbsences - baseline);

    result[sectionId] = {
      isBlocked: Boolean(activeBlock),
      activeBlock,
      lastUnblock,
      totalAbsences,
      cycleAbsences,
    };
  }

  return result;
}

export async function unblockStudentSection(params: {
  studentId: string;
  sectionId: string;
  reason: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('No se pudo conectar con el servicio. Contacta al administrador.');
  }

  const trimmedReason = params.reason.trim();
  if (!trimmedReason) {
    throw new Error('Debes ingresar el motivo de rehabilitación.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('admin_unblock_student_section', {
    p_student_id: params.studentId,
    p_section_id: params.sectionId,
    p_reason: trimmedReason,
  });

  if (error) {
    throw new Error(translateSupabaseError(error));
  }

  if (data === null || data === undefined) {
    return;
  }

  if (typeof data === 'string') {
    if (data === 'success' || data === 'ok') return;
    throw new Error(translateUnblockStudentError(data));
  }

  if (typeof data === 'object' && 'code' in data) {
    const code = String((data as { code?: unknown }).code || '');
    if (code === 'success' || code === 'ok') return;
    throw new Error(translateUnblockStudentError(code));
  }
}
