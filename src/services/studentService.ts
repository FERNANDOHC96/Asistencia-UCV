import { getSupabaseClient } from '../lib/supabase';
import { Course, Period, Section, Schedule, AttendanceRecord, ClassSession, TeacherName } from '../types';

export interface StudentEnrollmentWithDetails {
  enrollmentId: string;
  enrolledAt?: string;
  section: {
    id: string;
    name: string;
    capacity: number | null;
    offering_id: string;
    offering: {
      id: string;
      course: Course;
      period: Period;
    };
  };
  teachers: TeacherName[];
  schedules: Schedule[];
}

export interface StudentAttendanceStats {
  activeEnrollmentsCount: number;
  totalAttendancesCount: number;
}

/**
 * Consulta las matrículas activas del estudiante autenticado, con datos del curso,
 * periodo, sección, docentes (desde la vista teacher_names en 2 pasos) y horarios.
 */
export async function getStudentEnrollments(studentId: string): Promise<StudentEnrollmentWithDetails[]> {
  const supabase = getSupabaseClient();

  // 1. Obtener matrículas activas del estudiante
  const { data: enrollments, error: enrollErr } = await supabase
    .from('enrollments')
    .select('id, student_id, section_id, status, enrolled_at')
    .eq('student_id', studentId)
    .eq('status', 'activa')
    .order('enrolled_at', { ascending: false });

  if (enrollErr) throw enrollErr;
  if (!enrollments || enrollments.length === 0) return [];

  const sectionIds = enrollments.map((e) => e.section_id);

  // 2. Obtener secciones con curso y periodo (no archivadas)
  const { data: sectionsData, error: secErr } = await supabase
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
    .is('archived_at', null);

  if (secErr) throw secErr;
  if (!sectionsData || sectionsData.length === 0) return [];

  // Filtrar secciones cuyos cursos o periodos estén archivados
  const validSections = sectionsData.filter((sec: any) => {
    const off = Array.isArray(sec.offering) ? sec.offering[0] : sec.offering;
    const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;
    const per = off && Array.isArray(off.period) ? off.period[0] : off?.period;
    if (!crs || crs.archived_at) return false;
    if (!per || per.archived_at) return false;
    return true;
  });

  const validSectionIds = validSections.map((s: any) => s.id);
  if (validSectionIds.length === 0) return [];

  // 3. Obtener asignaciones de docentes para estas secciones
  const { data: assignments, error: assignErr } = await supabase
    .from('teaching_assignments')
    .select('id, section_id, teacher_id')
    .in('section_id', validSectionIds);

  if (assignErr) throw assignErr;

  // 4. Obtener nombres de docentes desde la vista teacher_names
  const teacherIds = Array.from(new Set((assignments || []).map((a) => a.teacher_id)));
  let teacherMap: Record<string, TeacherName> = {};

  if (teacherIds.length > 0) {
    const { data: teachersData, error: teachErr } = await supabase
      .from('teacher_names')
      .select('id, first_names, last_names')
      .in('id', teacherIds);

    if (!teachErr && teachersData) {
      teachersData.forEach((t) => {
        teacherMap[t.id] = t;
      });
    }
  }

  // 5. Obtener horarios de estas secciones (no archivados)
  const { data: schedulesData, error: schedErr } = await supabase
    .from('schedules')
    .select('id, section_id, weekday, starts_at, ends_at, room, kind')
    .in('section_id', validSectionIds)
    .is('archived_at', null)
    .order('weekday', { ascending: true })
    .order('starts_at', { ascending: true });

  if (schedErr) throw schedErr;

  // Mapas por section_id
  const schedulesBySection: Record<string, Schedule[]> = {};
  (schedulesData || []).forEach((sch) => {
    if (!schedulesBySection[sch.section_id]) {
      schedulesBySection[sch.section_id] = [];
    }
    schedulesBySection[sch.section_id].push(sch);
  });

  const teachersBySection: Record<string, TeacherName[]> = {};
  (assignments || []).forEach((a) => {
    if (!teachersBySection[a.section_id]) {
      teachersBySection[a.section_id] = [];
    }
    if (teacherMap[a.teacher_id]) {
      teachersBySection[a.section_id].push(teacherMap[a.teacher_id]);
    }
  });

  const sectionsMap: Record<string, any> = {};
  validSections.forEach((s) => {
    sectionsMap[s.id] = s;
  });

  return enrollments
    .filter((enr) => sectionsMap[enr.section_id])
    .map((enr) => {
      const sec = sectionsMap[enr.section_id];
      const off = Array.isArray(sec.offering) ? sec.offering[0] : sec.offering;
      const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;
      const per = off && Array.isArray(off.period) ? off.period[0] : off?.period;

      return {
        enrollmentId: enr.id,
        enrolledAt: enr.enrolled_at,
        section: {
          id: sec.id,
          name: sec.name,
          capacity: sec.capacity ?? null,
          offering_id: sec.offering_id,
          offering: {
            id: off?.id || '',
            course: crs || { id: '', code: 'S/C', name: 'Curso', credits: 0 },
            period: per || { id: '', name: 'Periodo', starts_on: '', ends_on: '', status: 'activo' },
          },
        },
        teachers: teachersBySection[enr.section_id] || [],
        schedules: schedulesBySection[enr.section_id] || [],
      };
    });
}

/**
 * Consulta el historial personal de asistencia del alumno con class_sessions anidado.
 * Filtra sesiones y secciones archivadas.
 */
export async function getStudentAttendanceRecords(studentId: string): Promise<AttendanceRecord[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('attendance_records')
    .select(`
      id,
      class_session_id,
      student_id,
      status,
      method,
      justification,
      registered_at,
      class_session:class_sessions (
        id,
        section_id,
        session_date,
        starts_at,
        ends_at,
        topic,
        status,
        kind,
        archived_at,
        section:sections (
          id,
          name,
          archived_at,
          offering:course_offerings (
            id,
            course:courses (id, code, name, archived_at)
          )
        )
      )
    `)
    .eq('student_id', studentId)
    .order('registered_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data
    .filter((row: any) => {
      const cs = Array.isArray(row.class_session) ? row.class_session[0] : row.class_session;
      if (!cs || cs.archived_at) return false;
      const sec = cs && Array.isArray(cs.section) ? cs.section[0] : cs?.section;
      if (!sec || sec.archived_at) return false;
      const off = sec && Array.isArray(sec.offering) ? sec.offering[0] : sec?.offering;
      const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;
      if (!crs || crs.archived_at) return false;
      return true;
    })
    .map((row: any) => {
      const cs = Array.isArray(row.class_session) ? row.class_session[0] : row.class_session;
      const sec = cs && Array.isArray(cs.section) ? cs.section[0] : cs?.section;
      const off = sec && Array.isArray(sec.offering) ? sec.offering[0] : sec?.offering;
      const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;

      return {
        ...row,
        class_session: cs ? {
          ...cs,
          section: sec ? {
            ...sec,
            offering: off ? {
              ...off,
              course: crs,
            } : undefined,
          } : undefined,
        } : undefined,
      } as unknown as AttendanceRecord;
    });
}

export interface SectionClosedCounts {
  teoria: number;
  practica: number;
  total: number;
}

/**
 * Obtiene conteos de sesiones cerradas por sección desglosadas por tipo:
 * Porcentaje Teoría = presentes (teoría) ÷ sesiones cerradas (teoría) * 100
 * Porcentaje Práctica = presentes (práctica) ÷ sesiones cerradas (práctica) * 100
 */
export async function getClosedSessionsCountBySections(
  sectionIds: string[]
): Promise<Record<string, SectionClosedCounts>> {
  if (sectionIds.length === 0) return {};
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('class_sessions')
    .select('id, section_id, status, kind')
    .in('section_id', sectionIds)
    .is('archived_at', null)
    .eq('status', 'cerrada');

  if (error) throw error;

  const countMap: Record<string, SectionClosedCounts> = {};
  sectionIds.forEach((id) => {
    countMap[id] = { teoria: 0, practica: 0, total: 0 };
  });

  (data || []).forEach((row) => {
    if (!countMap[row.section_id]) {
      countMap[row.section_id] = { teoria: 0, practica: 0, total: 0 };
    }
    const k = (row.kind === 'practica' ? 'practica' : 'teoria') as 'teoria' | 'practica';
    countMap[row.section_id][k] = (countMap[row.section_id][k] || 0) + 1;
    countMap[row.section_id].total = (countMap[row.section_id].total || 0) + 1;
  });

  return countMap;
}

/**
 * Resumen general del alumno para la pantalla de Inicio
 */
export async function getStudentStats(studentId: string): Promise<StudentAttendanceStats> {
  const enrollments = await getStudentEnrollments(studentId);
  const attendances = await getStudentAttendanceRecords(studentId);

  return {
    activeEnrollmentsCount: enrollments.length,
    totalAttendancesCount: attendances.length,
  };
}
