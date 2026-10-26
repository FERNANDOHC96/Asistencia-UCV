import { getSupabaseClient } from '../lib/supabase';
import { Course, Period, Section, Profile } from '../types';
import { fetchProfilesMapByIds } from '../lib/profileHelper';

export interface TeacherSection {
  id: string; // section id
  assignmentId: string;
  name: string; // section name
  capacity: number | null;
  offering_id: string;
  offering: {
    id: string;
    course_id: string;
    period_id: string;
    course: Course;
    period: Period;
  };
  activeEnrollmentsCount: number;
}

/**
 * Consulta las secciones asignadas exclusivamente al profesor autenticado.
 * Filtra estrictamente por teacher_id = userId en teaching_assignments.
 */
export async function getTeacherSections(userId: string): Promise<TeacherSection[]> {
  const supabase = getSupabaseClient();

  // 1. Obtener asignaciones del profesor autenticado
  const { data: assignments, error: aErr } = await supabase
    .from('teaching_assignments')
    .select('id, section_id, teacher_id')
    .eq('teacher_id', userId);

  if (aErr) throw aErr;
  if (!assignments || assignments.length === 0) return [];

  const sectionIds = assignments.map((a) => a.section_id);

  // 2. Obtener detalles de secciones con ofertas, cursos y periodos (no archivadas)
  const { data: sectionsData, error: sErr } = await supabase
    .from('sections')
    .select(`
      id,
      offering_id,
      name,
      capacity,
      archived_at,
      offering:course_offerings (
        id,
        course_id,
        period_id,
        course:courses (id, code, name, credits, archived_at),
        period:periods (id, name, starts_on, ends_on, status, archived_at)
      )
    `)
    .in('id', sectionIds)
    .is('archived_at', null)
    .order('name', { ascending: true });

  if (sErr) throw sErr;
  if (!sectionsData) return [];

  // Filtrar secciones cuyos cursos o periodos padres estén archivados
  const validSections = sectionsData.filter((sec: any) => {
    const off = Array.isArray(sec.offering) ? sec.offering[0] : sec.offering;
    const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;
    const per = off && Array.isArray(off.period) ? off.period[0] : off?.period;
    if (!crs || crs.archived_at) return false;
    if (!per || per.archived_at) return false;
    return true;
  });

  // 3. Obtener conteo de matriculados activos por sección
  const validSectionIds = validSections.map((s: any) => s.id);
  const { data: enrollData, error: eErr } = await supabase
    .from('enrollments')
    .select('section_id, status')
    .in('section_id', validSectionIds)
    .eq('status', 'activa');

  if (eErr) throw eErr;

  const enrollCountMap: Record<string, number> = {};
  (enrollData || []).forEach((row) => {
    enrollCountMap[row.section_id] = (enrollCountMap[row.section_id] || 0) + 1;
  });

  const assignmentBySectionId: Record<string, string> = {};
  assignments.forEach((a) => {
    assignmentBySectionId[a.section_id] = a.id;
  });

  return validSections.map((sec: any) => {
    const off = Array.isArray(sec.offering) ? sec.offering[0] : sec.offering;
    const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;
    const per = off && Array.isArray(off.period) ? off.period[0] : off?.period;

    return {
      id: sec.id,
      assignmentId: assignmentBySectionId[sec.id] || '',
      name: sec.name,
      capacity: sec.capacity ?? null,
      offering_id: sec.offering_id,
      offering: {
        id: off?.id || sec.offering_id,
        course_id: off?.course_id || '',
        period_id: off?.period_id || '',
        course: crs || { id: '', code: 'S/C', name: 'Curso', credits: 0 },
        period: per || { id: '', name: 'Periodo', starts_on: '', ends_on: '', status: 'activo' },
      },
      activeEnrollmentsCount: enrollCountMap[sec.id] || 0,
    };
  });
}

/**
 * Consulta los alumnos matriculados activos en una sección usando el helper de 2 consultas
 */
export async function getSectionActiveStudents(sectionId: string): Promise<Profile[]> {
  const supabase = getSupabaseClient();

  const { data: enrollments, error: eErr } = await supabase
    .from('enrollments')
    .select('id, student_id, section_id, status')
    .eq('section_id', sectionId)
    .eq('status', 'activa');

  if (eErr) throw eErr;
  if (!enrollments || enrollments.length === 0) return [];

  const studentIds = enrollments.map((e) => e.student_id);
  const profilesMap = await fetchProfilesMapByIds(studentIds);

  return studentIds
    .map((id) => profilesMap[id])
    .filter(Boolean)
    .map((p) => ({
      ...p,
      role: 'alumno' as const,
      active: true,
    }));
}

/**
 * Consulta la tolerancia de tardanza configurada en minutos desde la tabla settings.
 * Fila esperada: key = 'late_tolerance_minutes'
 * Si no existe o no es un número válido, retorna 10 por defecto sin mostrar error.
 */
export async function getLateToleranceMinutes(): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .eq('key', 'late_tolerance_minutes')
      .maybeSingle();

    if (error || !data || data.value === null || data.value === undefined) {
      return 10;
    }

    const parsed = parseInt(String(data.value), 10);
    return isNaN(parsed) || parsed < 0 ? 10 : parsed;
  } catch {
    return 10;
  }
}

