import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { fetchProfilesMapByIds, ProfileBasicInfo } from '../lib/profileHelper';
import { getTeacherSections, TeacherSection } from './teacherService';
import { deleteNotification } from './notificationService';
import {
  AppNotification,
  AttendanceStatus,
  LiveSectionRiskAlert,
  StudentAttendanceHistoryEntry,
  StudentSectionBlock,
  TeacherAlertDismissal,
  TeacherRiskDetails,
  TeacherRiskStudentEntry,
} from '../types';

interface SessionRow {
  id: string;
  section_id: string;
  session_date: string;
  starts_at: string;
  topic?: string | null;
  kind?: string | null;
  status: string;
}

interface AttendanceRow {
  id: string;
  class_session_id: string;
  student_id: string;
  status: string;
  registered_at?: string | null;
  modified_at?: string | null;
}

interface EnrollmentRow {
  student_id: string;
  section_id: string;
}

interface DismissedStudentSnapshot {
  f: number;
  c: number;
  b: boolean;
  r: string;
  lastAbsId: string | null;
}

interface DismissedSignaturePayload {
  v: 1;
  students: Record<string, DismissedStudentSnapshot>;
}

interface SupabaseErrShape {
  code?: string;
  message?: string;
}

const LOCAL_DISMISSALS_PREFIX = 'ucvgo_teacher_alert_dismissals_';
const LOCAL_LIVE_READS_PREFIX = 'ucvgo_teacher_live_reads_';

function isMissingTableOrColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as SupabaseErrShape;
  const code = (err.code || '').toUpperCase();
  const message = (err.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  );
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as SupabaseErrShape;
  const code = (err.code || '').toUpperCase();
  const message = (err.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  );
}

function readLocalDismissals(teacherId: string): Record<string, TeacherAlertDismissal> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`${LOCAL_DISMISSALS_PREFIX}${teacherId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, TeacherAlertDismissal>;
  } catch {
    return {};
  }
}

function writeLocalDismissal(teacherId: string, record: TeacherAlertDismissal): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readLocalDismissals(teacherId);
    current[record.section_id] = record;
    window.localStorage.setItem(`${LOCAL_DISMISSALS_PREFIX}${teacherId}`, JSON.stringify(current));
  } catch {
  }
}

export function readLiveReadMap(teacherId: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`${LOCAL_LIVE_READS_PREFIX}${teacherId}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function setLiveReadEntry(
  teacherId: string,
  sectionId: string,
  riskSignature: string,
  readAt: string | null
): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readLiveReadMap(teacherId);
    const key = `${sectionId}::${riskSignature}`;
    if (readAt) {
      current[key] = readAt;
    } else {
      delete current[key];
    }
    const keys = Object.keys(current);
    if (keys.length > 150) {
      for (const oldKey of keys.slice(0, keys.length - 150)) {
        delete current[oldKey];
      }
    }
    window.localStorage.setItem(`${LOCAL_LIVE_READS_PREFIX}${teacherId}`, JSON.stringify(current));
  } catch {
  }
}

function getRiskRank(risk: string | null | undefined): number {
  const lower = (risk || '').toLowerCase();
  if (lower.includes('crít') || lower.includes('crit') || lower.includes('muy alto') || lower.includes('alto')) {
    return 3;
  }
  if (lower.includes('medio') || lower.includes('moderad')) return 2;
  if (lower.includes('bajo')) return 1;
  return 0;
}

function formatPercentage(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function formatStudentName(profile?: ProfileBasicInfo): string {
  if (!profile) return 'Estudiante';
  if (profile.last_names && profile.first_names) {
    return `${profile.last_names}, ${profile.first_names}`;
  }
  return `${profile.last_names || ''} ${profile.first_names || ''}`.trim() || profile.code || 'Estudiante';
}

function normalizeAttendanceStatus(raw: string | undefined): AttendanceStatus {
  if (raw === 'presente' || raw === 'tardanza' || raw === 'justificado' || raw === 'falta') {
    return raw;
  }
  return 'falta';
}

export function buildRiskSignature(students: TeacherRiskStudentEntry[]): string {
  const sorted = [...students]
    .filter((s) => Boolean(s.studentId))
    .sort((a, b) => (a.studentId || '').localeCompare(b.studentId || ''));

  const studentMap: Record<string, DismissedStudentSnapshot> = {};
  for (const st of sorted) {
    if (!st.studentId) continue;
    studentMap[st.studentId] = {
      f: st.absencesNum ?? 0,
      c: st.consecutiveAbsencesNum ?? 0,
      b: Boolean(st.isBlocked),
      r: st.riskLevel || 'Bajo',
      lastAbsId: st.lastAbsenceSessionId ?? null,
    };
  }

  const payload: DismissedSignaturePayload = {
    v: 1,
    students: studentMap,
  };
  return JSON.stringify(payload);
}

export function hasNewRiskEvent(
  dismissedSignature: string,
  currentAtRiskStudents: TeacherRiskStudentEntry[]
): boolean {
  if (currentAtRiskStudents.length === 0) {
    return false;
  }

  let parsed: DismissedSignaturePayload | null = null;
  try {
    const raw: unknown = JSON.parse(dismissedSignature);
    if (
      raw &&
      typeof raw === 'object' &&
      'students' in raw &&
      raw.students &&
      typeof raw.students === 'object'
    ) {
      parsed = raw as DismissedSignaturePayload;
    }
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return dismissedSignature !== buildRiskSignature(currentAtRiskStudents);
  }

  for (const st of currentAtRiskStudents) {
    if (!st.studentId) continue;
    const prev = parsed.students[st.studentId];
    if (!prev) {
      return true;
    }
    const currAbs = st.absencesNum ?? 0;
    const currConsec = st.consecutiveAbsencesNum ?? 0;
    const currBlocked = Boolean(st.isBlocked);
    const currLastAbs = st.lastAbsenceSessionId ?? null;

    if (currAbs > prev.f) return true;
    if (currConsec > prev.c) return true;
    if (currBlocked && !prev.b) return true;
    if (currLastAbs && currLastAbs !== prev.lastAbsId) return true;
    if (getRiskRank(st.riskLevel) > getRiskRank(prev.r)) return true;
  }

  return false;
}

function buildDynamicRecommendation(
  students: TeacherRiskStudentEntry[],
  highestRisk: string | null
): string | null {
  if (students.length === 0) {
    return 'Los registros actuales no muestran estudiantes con faltas activas en esta sección.';
  }

  const blockedCount = students.filter((s) => s.isBlocked).length;
  const nearBlockCount = students.filter(
    (s) => !s.isBlocked && (s.cycleAbsencesNum ?? s.absencesNum ?? 0) === 2
  ).length;
  const consecutiveCount = students.filter((s) => (s.consecutiveAbsencesNum ?? 0) >= 2).length;

  const parts: string[] = [];
  if (blockedCount > 0) {
    parts.push(
      `${blockedCount} estudiante(s) se encuentra(n) inhabilitado(s) en el curso por límite de faltas; orientar a regularizar su justificación documentada ante Administración para evaluar rehabilitación.`
    );
  }
  if (nearBlockCount > 0) {
    parts.push(
      `${nearBlockCount} estudiante(s) acumula(n) 2 faltas en el ciclo actual y quedará(n) inhabilitado(s) automáticamente ante 1 falta adicional; contactar de inmediato y recordar el reglamento de asistencia.`
    );
  }
  if (consecutiveCount > 0) {
    parts.push(
      `Se registran faltas consecutivas recientes en ${consecutiveCount} alumno(s); coordinar seguimiento preventivo de tutoría antes de que excedan el porcentaje máximo permitido.`
    );
  }
  if (parts.length === 0 && highestRisk) {
    parts.push(
      `Monitorear la asistencia de los ${students.length} estudiante(s) con inasistencias tempranas y reforzar el registro oportuno para evitar que acumulen faltas adicionales.`
    );
  }

  return parts.join(' ');
}

function computeSectionRiskDetails(
  section: TeacherSection,
  studentIds: string[],
  profilesMap: Record<string, ProfileBasicInfo>,
  sessions: SessionRow[],
  recordsBySessionAndStudent: Record<string, Record<string, AttendanceRow>>,
  blocksByStudent: Record<string, StudentSectionBlock[]>
): TeacherRiskDetails {
  const orderedSessions = [...sessions].sort((a, b) => {
    const d = a.session_date.localeCompare(b.session_date);
    if (d !== 0) return d;
    return (a.starts_at || '').localeCompare(b.starts_at || '');
  });

  const closedSessionsCount = orderedSessions.filter((s) => s.status === 'cerrada').length;
  const atRiskStudents: TeacherRiskStudentEntry[] = [];

  for (const studentId of studentIds) {
    const studentBlocks = blocksByStudent[studentId] || [];
    const isBlocked = studentBlocks.some((b) => !b.unblocked_at);
    const lastUnblock =
      studentBlocks
        .filter((b) => Boolean(b.unblocked_at))
        .sort(
          (a, b) =>
            new Date(b.unblocked_at || 0).getTime() - new Date(a.unblocked_at || 0).getTime()
        )[0] || null;

    const evaluatedItems: StudentAttendanceHistoryEntry[] = [];
    for (const sess of orderedSessions) {
      const rec = recordsBySessionAndStudent[sess.id]?.[studentId];
      if (sess.status === 'cerrada') {
        evaluatedItems.push({
          sessionId: sess.id,
          date: sess.session_date,
          startsAt: (sess.starts_at || '').slice(0, 5),
          topic: sess.topic || 'Sesión de clase',
          kind: sess.kind === 'practica' ? 'practica' : 'teoria',
          status: normalizeAttendanceStatus(rec?.status),
        });
      } else if (rec) {
        evaluatedItems.push({
          sessionId: sess.id,
          date: sess.session_date,
          startsAt: (sess.starts_at || '').slice(0, 5),
          topic: sess.topic || 'Sesión de clase',
          kind: sess.kind === 'practica' ? 'practica' : 'teoria',
          status: normalizeAttendanceStatus(rec.status),
        });
      }
    }

    let faltas = 0;
    let presentes = 0;
    let tardanzas = 0;
    let justificados = 0;
    let maxConsecutive = 0;
    let runningStreak = 0;
    let lastAbsenceSessionId: string | null = null;
    const absenceDates: string[] = [];

    for (const item of evaluatedItems) {
      if (item.status === 'falta') {
        faltas += 1;
        runningStreak += 1;
        lastAbsenceSessionId = item.sessionId;
        absenceDates.push(item.date);
        if (runningStreak > maxConsecutive) {
          maxConsecutive = runningStreak;
        }
      } else {
        runningStreak = 0;
        if (item.status === 'presente') presentes += 1;
        else if (item.status === 'tardanza') tardanzas += 1;
        else if (item.status === 'justificado') justificados += 1;
      }
    }

    let currentConsecutive = 0;
    for (let i = evaluatedItems.length - 1; i >= 0; i--) {
      if (evaluatedItems[i].status === 'falta') {
        currentConsecutive += 1;
      } else {
        break;
      }
    }

    const evaluadas = evaluatedItems.length;
    const absencePercentageNum = evaluadas > 0 ? Math.round((faltas / evaluadas) * 1000) / 10 : 0;

    const baseline =
      lastUnblock &&
      lastUnblock.absences_at_unblock !== null &&
      lastUnblock.absences_at_unblock !== undefined
        ? Number(lastUnblock.absences_at_unblock)
        : 0;
    const cycleAbsences = Math.max(0, faltas - baseline);
    const effectiveAbsences = lastUnblock ? cycleAbsences : faltas;

    let studentRisk: 'Alto' | 'Medio' | 'Bajo' | null = null;
    if (isBlocked) {
      studentRisk = 'Alto';
    } else if (effectiveAbsences <= 0) {
      studentRisk = null;
    } else if (
      effectiveAbsences >= 3 ||
      currentConsecutive >= 3 ||
      (effectiveAbsences === 2 && (currentConsecutive >= 2 || absencePercentageNum >= 25)) ||
      (absencePercentageNum >= 30 && effectiveAbsences >= 2)
    ) {
      studentRisk = 'Alto';
    } else if (
      effectiveAbsences === 2 ||
      currentConsecutive >= 2 ||
      (evaluadas >= 2 && absencePercentageNum >= 15)
    ) {
      studentRisk = 'Medio';
    } else {
      studentRisk = 'Bajo';
    }

    if (studentRisk !== null) {
      const profile = profilesMap[studentId];
      atRiskStudents.push({
        studentId,
        name: formatStudentName(profile),
        code: profile?.code || null,
        careerName: profile?.career?.name || null,
        riskLevel: studentRisk,
        absences: String(faltas),
        absencesNum: faltas,
        cycleAbsencesNum: cycleAbsences,
        evaluatedSessionsNum: evaluadas,
        attendedNum: presentes,
        tardanzasNum: tardanzas,
        justificadosNum: justificados,
        absencePercentage: formatPercentage(absencePercentageNum),
        absencePercentageNum,
        consecutiveAbsences: String(currentConsecutive),
        consecutiveAbsencesNum: currentConsecutive,
        maxConsecutiveAbsencesNum: maxConsecutive,
        isBlocked,
        lastAbsenceSessionId,
        absenceDates: [...absenceDates].reverse(),
        attendanceHistory: [...evaluatedItems].reverse(),
      });
    }
  }

  atRiskStudents.sort((a, b) => {
    const blockDiff = (b.isBlocked ? 1 : 0) - (a.isBlocked ? 1 : 0);
    if (blockDiff !== 0) return blockDiff;
    const rankDiff = getRiskRank(b.riskLevel) - getRiskRank(a.riskLevel);
    if (rankDiff !== 0) return rankDiff;
    const absDiff = (b.absencesNum ?? 0) - (a.absencesNum ?? 0);
    if (absDiff !== 0) return absDiff;
    const consecDiff = (b.consecutiveAbsencesNum ?? 0) - (a.consecutiveAbsencesNum ?? 0);
    if (consecDiff !== 0) return consecDiff;
    return a.name.localeCompare(b.name, 'es');
  });

  const highestRisk = atRiskStudents[0]?.riskLevel || null;
  const totalAbsencesNum = atRiskStudents.reduce((sum, s) => sum + (s.absencesNum ?? 0), 0);
  const maxAbsencesNum = atRiskStudents.reduce((m, s) => Math.max(m, s.absencesNum ?? 0), 0);
  const maxPercentage = atRiskStudents.reduce(
    (m, s) => Math.max(m, s.absencePercentageNum ?? 0),
    0
  );
  const maxConsecutive = atRiskStudents.reduce(
    (m, s) => Math.max(m, s.consecutiveAbsencesNum ?? 0),
    0
  );

  const recommendation = buildDynamicRecommendation(atRiskStudents, highestRisk);
  const riskSignature = buildRiskSignature(atRiskStudents);

  const summaryLines =
    atRiskStudents.length > 0
      ? [
          `${section.offering.course.code} — ${section.offering.course.name} (Sección ${section.name})`,
          `Sesiones evaluadas: ${closedSessionsCount || Math.max(...atRiskStudents.map((s) => s.evaluatedSessionsNum ?? 0), 0)}`,
          ...atRiskStudents.map((s) => {
            const extras = [
              s.code ? `(${s.code})` : null,
              s.isBlocked ? 'INHABILITADO' : `Riesgo ${s.riskLevel}`,
              `${s.absencesNum ?? 0} falta(s)`,
              s.absencePercentage || '0%',
              `${s.consecutiveAbsencesNum ?? 0} consec.`,
            ].filter(Boolean);
            return `• ${s.name} ${extras.join(' · ')}`;
          }),
          recommendation ? `Recomendación: ${recommendation}` : null,
        ].filter((line): line is string => Boolean(line))
      : [
          `${section.offering.course.code} — ${section.offering.course.name} (Sección ${section.name})`,
          'Sin estudiantes con inasistencias activas según los registros actuales.',
        ];

  return {
    riskLevel: highestRisk,
    absencesCount: atRiskStudents.length > 0 ? String(totalAbsencesNum) : '0',
    totalAbsencesNum,
    maxAbsencesNum,
    absencePercentage: atRiskStudents.length > 0 ? formatPercentage(maxPercentage) : '0%',
    consecutiveAbsences: atRiskStudents.length > 0 ? String(maxConsecutive) : '0',
    recommendation,
    students: atRiskStudents,
    formattedBody: summaryLines.join('\n'),
    evaluatedSessionsCount:
      closedSessionsCount ||
      (atRiskStudents.length > 0
        ? Math.max(...atRiskStudents.map((s) => s.evaluatedSessionsNum ?? 0))
        : orderedSessions.length),
    isLiveCalculated: true,
    isResolved: atRiskStudents.length === 0,
    riskSignature,
    sectionId: section.id,
  };
}

async function fetchTeacherAlertDismissals(
  teacherId: string,
  sectionIds: string[]
): Promise<Record<string, TeacherAlertDismissal>> {
  const localFallback = readLocalDismissals(teacherId);
  if (!isSupabaseConfigured() || sectionIds.length === 0) {
    return localFallback;
  }

  try {
    const supabase = getSupabaseClient();
    const fullQuery = await supabase
      .from('teacher_alert_dismissals')
      .select('id, teacher_id, section_id, notification_id, risk_signature, read_at, dismissed_at')
      .eq('teacher_id', teacherId)
      .in('section_id', sectionIds);

    let rows: TeacherAlertDismissal[] = [];
    if (fullQuery.error) {
      if (isMissingTableError(fullQuery.error)) {
        return localFallback;
      }
      if (isMissingTableOrColumnError(fullQuery.error)) {
        const legacyQuery = await supabase
          .from('teacher_alert_dismissals')
          .select('id, teacher_id, section_id, notification_id, risk_signature, dismissed_at')
          .eq('teacher_id', teacherId)
          .in('section_id', sectionIds);
        if (legacyQuery.error) {
          return localFallback;
        }
        rows = (legacyQuery.data ?? []) as TeacherAlertDismissal[];
      } else {
        throw fullQuery.error;
      }
    } else {
      rows = (fullQuery.data ?? []) as TeacherAlertDismissal[];
    }

    const merged: Record<string, TeacherAlertDismissal> = { ...localFallback };
    for (const row of rows) {
      const existing = merged[row.section_id];
      const rowTime = new Date(row.dismissed_at || row.read_at || 0).getTime();
      const existingTime = existing
        ? new Date(existing.dismissed_at || existing.read_at || 0).getTime()
        : 0;
      if (!existing || rowTime >= existingTime) {
        merged[row.section_id] = row;
      }
    }
    return merged;
  } catch (err) {
    if (isMissingTableOrColumnError(err)) {
      return localFallback;
    }
    console.warn('No se pudieron consultar los estados de alertas:', err);
    return localFallback;
  }
}

async function verifyTeacherSectionOwnership(
  teacherId: string,
  sectionId: string
): Promise<boolean> {
  if (!teacherId || !sectionId || !isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teaching_assignments')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('section_id', sectionId)
    .limit(1);

  if (error) return false;
  return Boolean(data && data.length > 0);
}

export async function persistTeacherAlertReadState(params: {
  teacherId: string;
  sectionId: string;
  riskSignature: string;
  readAt: string | null;
}): Promise<void> {
  setLiveReadEntry(params.teacherId, params.sectionId, params.riskSignature, params.readAt);

  if (!isSupabaseConfigured()) return;

  const isOwner = await verifyTeacherSectionOwnership(params.teacherId, params.sectionId);
  if (!isOwner) return;

  try {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('teacher_alert_dismissals')
      .select('id, dismissed_at')
      .eq('teacher_id', params.teacherId)
      .eq('section_id', params.sectionId)
      .maybeSingle();

    if (existing && existing.dismissed_at) {
      return;
    }

    const payload: TeacherAlertDismissal = {
      teacher_id: params.teacherId,
      section_id: params.sectionId,
      risk_signature: params.riskSignature,
      read_at: params.readAt,
      dismissed_at: null,
    };

    const { error } = await supabase
      .from('teacher_alert_dismissals')
      .upsert(payload, { onConflict: 'teacher_id,section_id' });

    if (!error) {
      writeLocalDismissal(params.teacherId, payload);
    }
  } catch {
  }
}

export async function dismissTeacherSectionAlert(params: {
  teacherId: string;
  sectionId: string;
  notificationId?: string | null;
  riskSignature: string;
}): Promise<{ persistedInSupabase: boolean; sqlRequired: boolean }> {
  const isOwner = await verifyTeacherSectionOwnership(params.teacherId, params.sectionId);
  if (isSupabaseConfigured() && !isOwner) {
    throw new Error('No tienes permisos para gestionar alertas de una sección ajena.');
  }

  const dismissedAt = new Date().toISOString();
  const dismissalRecord: TeacherAlertDismissal = {
    teacher_id: params.teacherId,
    section_id: params.sectionId,
    notification_id: params.notificationId || null,
    risk_signature: params.riskSignature,
    read_at: dismissedAt,
    dismissed_at: dismissedAt,
  };

  let sqlRequired = false;
  let persistedInSupabase = true;

  if (params.notificationId) {
    const delRes = await deleteNotification(params.notificationId, params.teacherId);
    if (delRes.sqlRequired) {
      sqlRequired = true;
      persistedInSupabase = false;
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('teacher_alert_dismissals')
        .upsert(dismissalRecord, { onConflict: 'teacher_id,section_id' });

      if (error) {
        if (isMissingTableOrColumnError(error)) {
          const fallbackPayload = {
            teacher_id: params.teacherId,
            section_id: params.sectionId,
            notification_id: params.notificationId || null,
            risk_signature: params.riskSignature,
            dismissed_at: dismissedAt,
          };
          const retry = await supabase
            .from('teacher_alert_dismissals')
            .upsert(fallbackPayload, { onConflict: 'teacher_id,section_id' });

          if (retry.error) {
            sqlRequired = true;
            persistedInSupabase = false;
          }
        } else {
          const code = (error.code || '').toUpperCase();
          if (code === '42501') {
            sqlRequired = true;
            persistedInSupabase = false;
          } else {
            throw error;
          }
        }
      }
    } catch (err) {
      if (isMissingTableOrColumnError(err)) {
        sqlRequired = true;
        persistedInSupabase = false;
      } else {
        throw err;
      }
    }
  } else {
    persistedInSupabase = false;
  }

  writeLocalDismissal(params.teacherId, dismissalRecord);
  return { persistedInSupabase, sqlRequired };
}

export interface TeacherLiveRiskResult {
  alerts: LiveSectionRiskAlert[];
  sectionDetailsMap: Record<string, TeacherRiskDetails>;
  teacherSectionIds: string[];
}

export async function fetchTeacherLiveRiskData(
  teacherId: string,
  notifications: AppNotification[]
): Promise<TeacherLiveRiskResult> {
  if (!teacherId || !isSupabaseConfigured()) {
    return { alerts: [], sectionDetailsMap: {}, teacherSectionIds: [] };
  }

  const teacherSections = await getTeacherSections(teacherId);
  if (teacherSections.length === 0) {
    return { alerts: [], sectionDetailsMap: {}, teacherSectionIds: [] };
  }

  const sectionIds = teacherSections.map((s) => s.id);
  const supabase = getSupabaseClient();

  const [enrollRes, sessionsRes, blocksRes, dismissalsMap] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id, section_id')
      .in('section_id', sectionIds)
      .eq('status', 'activa'),
    supabase
      .from('class_sessions')
      .select('id, section_id, session_date, starts_at, topic, kind, status')
      .in('section_id', sectionIds)
      .is('archived_at', null)
      .in('status', ['cerrada', 'abierta'])
      .order('session_date', { ascending: true })
      .order('starts_at', { ascending: true }),
    supabase
      .from('student_section_blocks')
      .select('student_id, section_id, blocked_at, unblocked_at, absences_at_unblock, reason')
      .in('section_id', sectionIds),
    fetchTeacherAlertDismissals(teacherId, sectionIds),
  ]);

  if (enrollRes.error) throw enrollRes.error;
  if (sessionsRes.error) throw sessionsRes.error;
  if (blocksRes.error && !isMissingTableError(blocksRes.error)) {
    throw blocksRes.error;
  }

  const enrollments = (enrollRes.data ?? []) as EnrollmentRow[];
  const sessions = (sessionsRes.data ?? []) as SessionRow[];
  const blocks = (blocksRes.data ?? []) as StudentSectionBlock[];

  const studentIds = Array.from(new Set(enrollments.map((e) => e.student_id).filter(Boolean)));
  const sessionIds = sessions.map((s) => s.id);

  const [profilesMap, attendanceRes] = await Promise.all([
    fetchProfilesMapByIds(studentIds),
    sessionIds.length > 0
      ? supabase
          .from('attendance_records')
          .select('id, class_session_id, student_id, status, registered_at, modified_at')
          .in('class_session_id', sessionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (attendanceRes.error) throw attendanceRes.error;
  const attendanceRows = (attendanceRes.data ?? []) as AttendanceRow[];

  const studentsBySection: Record<string, string[]> = {};
  for (const enr of enrollments) {
    if (!studentsBySection[enr.section_id]) {
      studentsBySection[enr.section_id] = [];
    }
    if (!studentsBySection[enr.section_id].includes(enr.student_id)) {
      studentsBySection[enr.section_id].push(enr.student_id);
    }
  }

  const sessionsBySection: Record<string, SessionRow[]> = {};
  for (const sess of sessions) {
    if (!sessionsBySection[sess.section_id]) {
      sessionsBySection[sess.section_id] = [];
    }
    sessionsBySection[sess.section_id].push(sess);
  }

  const recordsBySessionAndStudent: Record<string, Record<string, AttendanceRow>> = {};
  for (const rec of attendanceRows) {
    if (!recordsBySessionAndStudent[rec.class_session_id]) {
      recordsBySessionAndStudent[rec.class_session_id] = {};
    }
    const existing = recordsBySessionAndStudent[rec.class_session_id][rec.student_id];
    if (!existing) {
      recordsBySessionAndStudent[rec.class_session_id][rec.student_id] = rec;
    } else {
      const existingTime = new Date(existing.modified_at || existing.registered_at || 0).getTime();
      const currTime = new Date(rec.modified_at || rec.registered_at || 0).getTime();
      if (currTime >= existingTime) {
        recordsBySessionAndStudent[rec.class_session_id][rec.student_id] = rec;
      }
    }
  }

  const blocksBySectionAndStudent: Record<string, Record<string, StudentSectionBlock[]>> = {};
  for (const blk of blocks) {
    if (!blocksBySectionAndStudent[blk.section_id]) {
      blocksBySectionAndStudent[blk.section_id] = {};
    }
    if (!blocksBySectionAndStudent[blk.section_id][blk.student_id]) {
      blocksBySectionAndStudent[blk.section_id][blk.student_id] = [];
    }
    blocksBySectionAndStudent[blk.section_id][blk.student_id].push(blk);
  }

  const notificationsBySection: Record<string, AppNotification[]> = {};
  const teacherRiskNotifs = notifications.filter(
    (n) => n.kind === 'riesgo_asistencia_profesor'
  );
  for (const notif of teacherRiskNotifs) {
    let matchedSectionId: string | null = null;
    if (notif.ref_id && sectionIds.includes(notif.ref_id)) {
      matchedSectionId = notif.ref_id;
    } else if (notif.ref_type === 'course' && notif.ref_id) {
      const match = teacherSections.find((s) => s.offering.course.id === notif.ref_id);
      if (match) matchedSectionId = match.id;
    }
    if (matchedSectionId) {
      if (!notificationsBySection[matchedSectionId]) {
        notificationsBySection[matchedSectionId] = [];
      }
      notificationsBySection[matchedSectionId].push(notif);
    }
  }

  const liveReadMap = readLiveReadMap(teacherId);
  const sectionDetailsMap: Record<string, TeacherRiskDetails> = {};
  const alerts: LiveSectionRiskAlert[] = [];

  for (const section of teacherSections) {
    const secDetails = computeSectionRiskDetails(
      section,
      studentsBySection[section.id] || [],
      profilesMap,
      sessionsBySection[section.id] || [],
      recordsBySessionAndStudent,
      blocksBySectionAndStudent[section.id] || {}
    );
    sectionDetailsMap[section.id] = secDetails;

    const hasActiveRisk = secDetails.students.length > 0;
    if (!hasActiveRisk) {
      continue;
    }

    const secNotifs = (notificationsBySection[section.id] || []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latestNotif = secNotifs[0] || null;
    const dismissal = dismissalsMap[section.id] || null;

    const isSuppressed =
      Boolean(dismissal && dismissal.dismissed_at) &&
      !hasNewRiskEvent(dismissal!.risk_signature, secDetails.students);

    if (isSuppressed) {
      continue;
    }

    const sig = secDetails.riskSignature || 'no_risk';
    const liveReadKey = `${section.id}::${sig}`;
    const storedReadAt =
      dismissal && !dismissal.dismissed_at && dismissal.risk_signature === sig
        ? dismissal.read_at || null
        : null;
    const readAt = latestNotif
      ? latestNotif.read_at || storedReadAt || liveReadMap[liveReadKey] || null
      : storedReadAt || liveReadMap[liveReadKey] || null;

    const title = `Alerta de riesgo ${(secDetails.riskLevel || '').toLowerCase()} en ${section.offering.course.name}`.trim();

    alerts.push({
      id: latestNotif ? latestNotif.id : `live-section-${section.id}`,
      notificationId: latestNotif ? latestNotif.id : null,
      notification: latestNotif
        ? {
            ...latestNotif,
            teacherRisk: secDetails,
            courseRef: {
              sectionId: section.id,
              sectionName: section.name,
              courseId: section.offering.course.id,
              courseCode: section.offering.course.code,
              courseName: section.offering.course.name,
            },
          }
        : null,
      sectionId: section.id,
      courseId: section.offering.course.id,
      courseCode: section.offering.course.code,
      courseName: section.offering.course.name,
      sectionName: section.name,
      periodName: section.offering.period.name,
      title,
      createdAt: latestNotif?.created_at || new Date().toISOString(),
      readAt,
      isLiveOnly: !latestNotif,
      details: secDetails,
    });
  }

  alerts.sort((a, b) => {
    const unreadDiff = (a.readAt ? 1 : 0) - (b.readAt ? 1 : 0);
    if (unreadDiff !== 0) return unreadDiff;
    const rankDiff = getRiskRank(b.details.riskLevel) - getRiskRank(a.details.riskLevel);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    alerts,
    sectionDetailsMap,
    teacherSectionIds: sectionIds,
  };
}
