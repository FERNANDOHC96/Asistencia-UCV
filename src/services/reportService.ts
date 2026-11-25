import { getSupabaseClient } from '../lib/supabase';

export interface ReportFilters {
  sectionId: string;
  from: string;
  to: string;
}

export type ReportCellStatus = 'presente' | 'tardanza' | 'falta' | 'justificado' | 'sin_sesion';

export interface ReportStudentRow {
  studentId: string;
  code: string;
  name: string;
  cells: Record<string, ReportCellStatus>;
  presentes: number;
  tardanzas: number;
  faltas: number;
  justificados: number;
  evaluadas: number;
  porcentaje: number;
}

export interface ReportSessionRow {
  sessionId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  topic: string;
  kind: 'teoria' | 'practica';
  status: string;
  presentes: number;
  tardanzas: number;
  faltas: number;
  justificados: number;
  evaluadas: number;
  ausentes: string[];
}

export interface ReportSectionOption {
  id: string;
  name: string;
  courseCode: string;
  courseName: string;
  periodName: string;
}

export interface ReportTotals {
  sessionsCount: number;
  studentsCount: number;
  presentes: number;
  tardanzas: number;
  faltas: number;
  justificados: number;
  evaluadas: number;
  averagePercentage: number;
}

export interface AttendanceReportResult {
  sectionLabel: string;
  courseLabel: string;
  periodLabel: string;
  teacherLabel: string;
  sessions: ReportSessionRow[];
  students: ReportStudentRow[];
  totals: ReportTotals;
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export async function getAdminReportSections(): Promise<ReportSectionOption[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sections')
    .select(`
      id,
      name,
      archived_at,
      offering:course_offerings (
        id,
        course:courses (code, name, archived_at),
        period:periods (name, archived_at)
      )
    `)
    .is('archived_at', null)
    .order('name', { ascending: true });

  if (error) throw error;

  const list: ReportSectionOption[] = [];
  (data || []).forEach((sec: any) => {
    const off = unwrapSingle<any>(sec.offering);
    const crs = unwrapSingle<any>(off?.course);
    const per = unwrapSingle<any>(off?.period);
    if (!crs || crs.archived_at || !per || per.archived_at) return;

    list.push({
      id: sec.id,
      name: sec.name,
      courseCode: crs.code || '',
      courseName: crs.name || 'Curso',
      periodName: per.name || '',
    });
  });

  return list.sort((a, b) => {
    const byCourse = a.courseName.localeCompare(b.courseName, 'es');
    if (byCourse !== 0) return byCourse;
    return a.name.localeCompare(b.name, 'es');
  });
}

export async function getAttendanceReport(filters: ReportFilters): Promise<AttendanceReportResult> {
  const supabase = getSupabaseClient();
  const { sectionId, from, to } = filters;

  const { data: secData, error: secErr } = await supabase
    .from('sections')
    .select(`
      id,
      name,
      offering:course_offerings (
        id,
        course:courses (code, name),
        period:periods (name)
      )
    `)
    .eq('id', sectionId)
    .single();

  if (secErr) throw secErr;

  const offeringObj = unwrapSingle<any>(secData?.offering);
  const courseObj = unwrapSingle<any>(offeringObj?.course);
  const periodObj = unwrapSingle<any>(offeringObj?.period);

  const sectionLabel = secData?.name || '';
  const courseCode = courseObj?.code || '';
  const courseName = courseObj?.name || 'Curso';
  const courseLabel = courseCode ? `${courseCode} — ${courseName}` : courseName;
  const periodLabel = periodObj?.name || '-';

  let teacherLabel = 'Sin docente asignado';
  const { data: assignData } = await supabase
    .from('teaching_assignments')
    .select('teacher_id')
    .eq('section_id', sectionId)
    .limit(1);

  if (assignData && assignData.length > 0 && assignData[0].teacher_id) {
    const { data: teacherProf } = await supabase
      .from('profiles')
      .select('first_names, last_names')
      .eq('id', assignData[0].teacher_id)
      .maybeSingle();

    if (teacherProf) {
      teacherLabel = `${teacherProf.last_names || ''} ${teacherProf.first_names || ''}`.trim() || teacherLabel;
    }
  }

  const { data: enrData, error: enrErr } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('section_id', sectionId)
    .eq('status', 'activa');

  if (enrErr) throw enrErr;

  const studentIds = Array.from(
    new Set((enrData || []).map((e: any) => e.student_id).filter(Boolean))
  ) as string[];

  let studentProfiles: Array<{
    id: string;
    code: string;
    first_names: string;
    last_names: string;
  }> = [];

  if (studentIds.length > 0) {
    const { data: profData, error: profErr } = await supabase
      .from('profiles')
      .select('id, code, first_names, last_names')
      .in('id', studentIds);

    if (profErr) throw profErr;
    studentProfiles = (profData || []) as typeof studentProfiles;
  }

  studentProfiles.sort((a, b) => {
    const ln = (a.last_names || '').localeCompare(b.last_names || '', 'es');
    if (ln !== 0) return ln;
    const fn = (a.first_names || '').localeCompare(b.first_names || '', 'es');
    if (fn !== 0) return fn;
    return (a.code || '').localeCompare(b.code || '', 'es');
  });

  const { data: sessData, error: sessErr } = await supabase
    .from('class_sessions')
    .select('id, session_date, starts_at, ends_at, topic, kind, status')
    .eq('section_id', sectionId)
    .is('archived_at', null)
    .in('status', ['cerrada'])
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: true })
    .order('starts_at', { ascending: true });

  if (sessErr) throw sessErr;

  const rawSessions = (sessData || []) as Array<{
    id: string;
    session_date: string;
    starts_at: string;
    ends_at: string;
    topic: string;
    kind: string;
    status: string;
  }>;

  const sessionIds = rawSessions.map((s) => s.id);

  const recordsBySessionAndStudent: Record<string, Record<string, ReportCellStatus>> = {};

  if (sessionIds.length > 0) {
    const { data: recData, error: recErr } = await supabase
      .from('attendance_records')
      .select('class_session_id, student_id, status')
      .in('class_session_id', sessionIds);

    if (recErr) throw recErr;

    (recData || []).forEach((r: any) => {
      if (!recordsBySessionAndStudent[r.class_session_id]) {
        recordsBySessionAndStudent[r.class_session_id] = {};
      }
      if (
        r.status === 'presente' ||
        r.status === 'tardanza' ||
        r.status === 'falta' ||
        r.status === 'justificado'
      ) {
        recordsBySessionAndStudent[r.class_session_id][r.student_id] = r.status;
      }
    });
  }

  const students: ReportStudentRow[] = studentProfiles.map((st) => {
    const cells: Record<string, ReportCellStatus> = {};
    let presentes = 0;
    let tardanzas = 0;
    let faltas = 0;
    let justificados = 0;

    rawSessions.forEach((sess) => {
      const recordedStatus = recordsBySessionAndStudent[sess.id]?.[st.id];
      const finalStatus: ReportCellStatus = recordedStatus || 'falta';
      cells[sess.id] = finalStatus;

      if (finalStatus === 'presente') presentes += 1;
      else if (finalStatus === 'tardanza') tardanzas += 1;
      else if (finalStatus === 'justificado') justificados += 1;
      else faltas += 1;
    });

    const evaluadas = rawSessions.length;
    const attended = presentes + tardanzas + justificados;
    const porcentaje = evaluadas > 0 ? Math.round((attended / evaluadas) * 1000) / 10 : 0;

    return {
      studentId: st.id,
      code: st.code || '-',
      name: `${st.last_names || ''}, ${st.first_names || ''}`.trim().replace(/^,\s*|,\s*$/g, '') || '-',
      cells,
      presentes,
      tardanzas,
      faltas,
      justificados,
      evaluadas,
      porcentaje,
    };
  });

  const sessions: ReportSessionRow[] = rawSessions.map((sess) => {
    let presentes = 0;
    let tardanzas = 0;
    let faltas = 0;
    let justificados = 0;
    const ausentes: string[] = [];

    students.forEach((st) => {
      const status = st.cells[sess.id] || 'falta';
      if (status === 'presente') presentes += 1;
      else if (status === 'tardanza') tardanzas += 1;
      else if (status === 'justificado') justificados += 1;
      else {
        faltas += 1;
        ausentes.push(st.name);
      }
    });

    return {
      sessionId: sess.id,
      date: sess.session_date,
      startsAt: (sess.starts_at || '').slice(0, 5),
      endsAt: (sess.ends_at || '').slice(0, 5),
      topic: sess.topic || 'Sesión de clase',
      kind: sess.kind === 'practica' ? 'practica' : 'teoria',
      status: sess.status,
      presentes,
      tardanzas,
      faltas,
      justificados,
      evaluadas: students.length,
      ausentes,
    };
  });

  const totalPresentes = students.reduce((acc, s) => acc + s.presentes, 0);
  const totalTardanzas = students.reduce((acc, s) => acc + s.tardanzas, 0);
  const totalFaltas = students.reduce((acc, s) => acc + s.faltas, 0);
  const totalJustificados = students.reduce((acc, s) => acc + s.justificados, 0);
  const totalEvaluadas = students.reduce((acc, s) => acc + s.evaluadas, 0);
  const averagePercentage =
    students.length > 0 && sessions.length > 0
      ? Math.round((students.reduce((acc, s) => acc + s.porcentaje, 0) / students.length) * 10) / 10
      : 0;

  return {
    sectionLabel,
    courseLabel,
    periodLabel,
    teacherLabel,
    sessions,
    students,
    totals: {
      sessionsCount: sessions.length,
      studentsCount: students.length,
      presentes: totalPresentes,
      tardanzas: totalTardanzas,
      faltas: totalFaltas,
      justificados: totalJustificados,
      evaluadas: totalEvaluadas,
      averagePercentage,
    },
  };
}
