import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { fetchProfilesMapByIds, ProfileBasicInfo } from '../lib/profileHelper';
import {
  AppNotification,
  NotificationCourseRef,
  NotificationKind,
  TeacherRiskDetails,
  TeacherRiskStudentEntry,
} from '../types';

interface SupabaseErrorShape {
  code?: string;
  message?: string;
}

interface CourseJoinRow {
  id: string;
  code: string;
  name: string;
}

interface OfferingJoinRow {
  id: string;
  course: CourseJoinRow | CourseJoinRow[] | null;
}

interface SectionCourseRow {
  id: string;
  name: string;
  offering: OfferingJoinRow | OfferingJoinRow[] | null;
}

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const SINGLE_UUID_EXACT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isMissingNotificationsTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as SupabaseErrorShape;
  const code = (err.code || '').toUpperCase();
  const message = (err.message || '').toLowerCase();

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  );
}

function pickSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function deduplicateById(items: AppNotification[]): AppNotification[] {
  const seen = new Set<string>();
  const unique: AppNotification[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }
  return unique;
}

function isUuidString(value: string | null | undefined): boolean {
  if (!value) return false;
  return SINGLE_UUID_EXACT.test(value.trim());
}

function extractUuids(text: string): string[] {
  const matches = text.match(UUID_REGEX);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

function formatProfileName(profile: ProfileBasicInfo): string {
  const fullName = `${profile.last_names || ''} ${profile.first_names || ''}`.trim();
  if (profile.last_names && profile.first_names) {
    return `${profile.last_names}, ${profile.first_names}`;
  }
  return fullName || profile.code || 'Alumno';
}

function sanitizeTextWithProfiles(
  text: string,
  profilesMap: Record<string, ProfileBasicInfo>
): string {
  return text
    .replace(UUID_REGEX, (match) => {
      const profile = profilesMap[match] || profilesMap[match.toLowerCase()];
      if (profile) {
        const name = formatProfileName(profile);
        return profile.code ? `${name} (${profile.code})` : name;
      }
      return '';
    })
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\b(?:id|uuid|student_id)\s*[:=]\s*(?=[,;|.\n]|$)/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatMetricValue(val: unknown, suffix = ''): string | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if (!str) return null;
  if (suffix && !str.endsWith(suffix)) return `${str}${suffix}`;
  return str;
}

function normalizeRiskLevel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (lower.includes('crít') || lower.includes('crit')) return 'Crítico';
  if (lower.includes('muy alto')) return 'Muy alto';
  if (lower.includes('alto')) return 'Alto';
  if (lower.includes('moderad') || lower.includes('medio') || lower.includes('media')) return 'Medio';
  if (lower.includes('bajo') || lower.includes('baja')) return 'Bajo';
  return cleaned;
}

function parseJsonTeacherRiskBody(
  rawBody: string,
  profilesMap: Record<string, ProfileBasicInfo>
): TeacherRiskDetails | null {
  const trimmed = rawBody.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') return null;

    const record = Array.isArray(parsed)
      ? ({ students: parsed } as Record<string, unknown>)
      : (parsed as Record<string, unknown>);

    const rawStudents =
      record.students ??
      record.alumnos ??
      record.estudiantes ??
      record.at_risk_students ??
      record.affected_students;

    const students: TeacherRiskStudentEntry[] = [];
    if (Array.isArray(rawStudents)) {
      for (const entry of rawStudents) {
        if (typeof entry === 'string') {
          if (isUuidString(entry)) {
            const prof = profilesMap[entry] || profilesMap[entry.toLowerCase()];
            if (prof) {
              students.push({
                studentId: prof.id,
                name: formatProfileName(prof),
                code: prof.code,
              });
            }
          } else if (entry.trim()) {
            students.push({ name: entry.trim() });
          }
          continue;
        }

        if (entry && typeof entry === 'object') {
          const item = entry as Record<string, unknown>;
          const rawId =
            typeof item.student_id === 'string'
              ? item.student_id
              : typeof item.id === 'string'
              ? item.id
              : null;
          const prof = rawId
            ? profilesMap[rawId] || profilesMap[rawId.toLowerCase()]
            : undefined;

          const rawNameCandidate =
            typeof item.full_name === 'string'
              ? item.full_name
              : typeof item.student_name === 'string'
              ? item.student_name
              : typeof item.nombre === 'string'
              ? item.nombre
              : typeof item.name === 'string'
              ? item.name
              : null;

          const safeName = prof
            ? formatProfileName(prof)
            : rawNameCandidate && !isUuidString(rawNameCandidate)
            ? rawNameCandidate.trim()
            : null;

          if (!safeName) continue;

          students.push({
            studentId: prof?.id ?? rawId,
            name: safeName,
            code:
              prof?.code ??
              (typeof item.code === 'string'
                ? item.code
                : typeof item.codigo === 'string'
                ? item.codigo
                : null),
            riskLevel: normalizeRiskLevel(
              formatMetricValue(item.risk_level ?? item.nivel_riesgo ?? item.riesgo)
            ),
            absences: formatMetricValue(item.absences ?? item.faltas ?? item.total_absences),
            absencePercentage: formatMetricValue(
              item.absence_percentage ?? item.porcentaje_faltas ?? item.porcentaje,
              '%'
            ),
            consecutiveAbsences: formatMetricValue(
              item.consecutive_absences ?? item.faltas_consecutivas ?? item.consecutivas
            ),
          });
        }
      }
    }

    const riskLevel = normalizeRiskLevel(
      formatMetricValue(record.risk_level ?? record.nivel_riesgo ?? record.riesgo) ??
        students.find((s) => s.riskLevel)?.riskLevel ??
        null
    );
    const absencesCount =
      formatMetricValue(record.absences ?? record.faltas ?? record.total_absences) ??
      students.find((s) => s.absences)?.absences ??
      null;
    const absencePercentage =
      formatMetricValue(
        record.absence_percentage ?? record.porcentaje_faltas ?? record.porcentaje,
        '%'
      ) ??
      students.find((s) => s.absencePercentage)?.absencePercentage ??
      null;
    const consecutiveAbsences =
      formatMetricValue(
        record.consecutive_absences ?? record.faltas_consecutivas ?? record.consecutivas
      ) ??
      students.find((s) => s.consecutiveAbsences)?.consecutiveAbsences ??
      null;
    const recommendation = formatMetricValue(
      record.recommendation ??
        record.recomendacion ??
        record.intervention ??
        record.intervencion
    );
    const summaryText = formatMetricValue(
      record.summary ?? record.resumen ?? record.message ?? record.mensaje ?? record.detail
    );

    const lines: string[] = [];
    if (summaryText) lines.push(sanitizeTextWithProfiles(summaryText, profilesMap));
    if (students.length > 0) {
      lines.push('Alumnos en riesgo:');
      for (const st of students) {
        const parts = [st.name];
        if (st.code) parts.push(`(${st.code})`);
        if (st.riskLevel) parts.push(`Riesgo ${st.riskLevel}`);
        if (st.absences) parts.push(`${st.absences} faltas`);
        if (st.absencePercentage) parts.push(`${st.absencePercentage}`);
        if (st.consecutiveAbsences) parts.push(`${st.consecutiveAbsences} consecutivas`);
        lines.push(`• ${parts.join(' · ')}`);
      }
    }
    if (recommendation) {
      lines.push(`Recomendación: ${sanitizeTextWithProfiles(recommendation, profilesMap)}`);
    }

    return {
      riskLevel,
      absencesCount,
      absencePercentage,
      consecutiveAbsences,
      recommendation: recommendation
        ? sanitizeTextWithProfiles(recommendation, profilesMap)
        : null,
      students,
      formattedBody: lines.join('\n') || sanitizeTextWithProfiles(rawBody, profilesMap),
    };
  } catch {
    return null;
  }
}

function parseLineAsStudentEntry(
  rawLine: string,
  profilesMap: Record<string, ProfileBasicInfo>
): TeacherRiskStudentEntry | null {
  const cleanedLine = rawLine.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
  if (!cleanedLine) return null;

  const lower = cleanedLine.toLowerCase();
  if (
    /^(?:nivel\s+de\s+riesgo|riesgo|n[uú]mero\s+de\s+faltas|total\s+de\s+faltas|porcentaje|faltas\s+consecutivas|recomendaci[oó]n|intervenci[oó]n|curso|secci[oó]n|fecha|resumen)\s*[:\-]/i.test(
      cleanedLine
    )
  ) {
    return null;
  }

  const lineUuids = extractUuids(cleanedLine);
  const resolvedProfile = lineUuids
    .map((id) => profilesMap[id] || profilesMap[id.toLowerCase()])
    .find(Boolean);

  const sanitized = sanitizeTextWithProfiles(cleanedLine, profilesMap);
  if (!sanitized) return null;

  const riskMatch =
    sanitized.match(/(?:riesgo\s*(?:de\s*nivel)?\s*[:\-]?\s*)(cr[ií]tico|muy\s+alto|alto|moderado|medio|bajo)/i) ||
    sanitized.match(/\b(cr[ií]tico|muy\s+alto|alto|moderado|medio|bajo)\b/i);
  const absMatch =
    sanitized.match(/(\d+)\s*(?:faltas|inasistencias)(?!\s*consecutivas)/i) ||
    sanitized.match(/faltas\s*[:\-]\s*(\d+)/i);
  const pctMatch = sanitized.match(/(\d+(?:[.,]\d+)?\s*%)/);
  const consMatch =
    sanitized.match(/(\d+)\s*(?:faltas\s+)?consecutivas/i) ||
    sanitized.match(/consecutivas\s*[:\-]\s*(\d+)/i);
  const codeMatch = sanitized.match(/\b(\d{8})\b/);

  let namePart = sanitized.split(/[|:(]/)[0].trim();
  namePart = namePart
    .replace(/\b\d+\s*(?:faltas|inasistencias).*$/i, '')
    .replace(/\briesgo\b.*$/i, '')
    .replace(/[-–—·]+$/, '')
    .trim();

  const looksLikeStudent =
    Boolean(resolvedProfile) ||
    Boolean(codeMatch) ||
    (/^[-•*]|\d+[.)]/.test(rawLine.trim()) &&
      (Boolean(absMatch) || Boolean(pctMatch) || Boolean(consMatch) || Boolean(riskMatch)));

  if (!looksLikeStudent) return null;

  const finalName = resolvedProfile
    ? formatProfileName(resolvedProfile)
    : namePart && !isUuidString(namePart)
    ? namePart
    : 'Estudiante';

  if (lower.startsWith('alumnos') || lower.startsWith('estudiantes')) return null;

  return {
    studentId: resolvedProfile?.id ?? lineUuids[0] ?? null,
    name: finalName,
    code: resolvedProfile?.code ?? codeMatch?.[1] ?? null,
    riskLevel: normalizeRiskLevel(riskMatch?.[1] ?? null),
    absences: absMatch?.[1] ?? null,
    absencePercentage: pctMatch?.[1]?.replace(/\s+/g, '') ?? null,
    consecutiveAbsences: consMatch?.[1] ?? null,
  };
}

export function parseTeacherRiskBody(
  rawBody: string,
  profilesMap: Record<string, ProfileBasicInfo>
): TeacherRiskDetails {
  const jsonParsed = parseJsonTeacherRiskBody(rawBody, profilesMap);
  if (jsonParsed) return jsonParsed;

  const formattedBody = sanitizeTextWithProfiles(rawBody, profilesMap);
  const lines = rawBody
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const riskHeaderMatch =
    formattedBody.match(
      /(?:nivel\s+de\s+riesgo|riesgo\s+detectado|riesgo)\s*[:\-]\s*([^\n|•]+)/i
    ) || formattedBody.match(/\briesgo\s+(cr[ií]tico|muy\s+alto|alto|moderado|medio|bajo)\b/i);

  const absencesMatch =
    formattedBody.match(
      /(?:n[uú]mero\s+de\s+faltas|total\s+de\s+faltas|faltas\s+acumuladas|inasistencias)\s*[:\-]\s*(\d+)/i
    ) || formattedBody.match(/(\d+)\s*(?:faltas|inasistencias)(?!\s*consecutivas)/i);

  const percentageMatch =
    formattedBody.match(
      /(?:porcentaje\s+de\s+faltas|%\s*de\s*faltas|porcentaje\s+de\s+inasistencia)\s*[:\-]\s*(\d+(?:[.,]\d+)?\s*%?)/i
    ) || formattedBody.match(/(\d+(?:[.,]\d+)?\s*%)/);

  const consecutiveMatch =
    formattedBody.match(
      /(?:faltas\s+consecutivas|inasistencias\s+consecutivas|ausencias\s+consecutivas)\s*[:\-]\s*(\d+)/i
    ) || formattedBody.match(/(\d+)\s*(?:faltas\s+)?consecutivas/i);

  let recommendation: string | null = null;
  const recIndex = lines.findIndex((line) =>
    /^(?:[-•*]\s*)?(?:recomendaci[oó]n(?:\s+de\s+intervenci[oó]n)?|intervenci[oó]n(?:\s+sugerida)?|acci[oó]n\s+recomendada|sugerencia)\s*[:\-]/i.test(
      line
    )
  );
  if (recIndex >= 0) {
    const firstPart = lines[recIndex].replace(
      /^(?:[-•*]\s*)?(?:recomendaci[oó]n(?:\s+de\s+intervenci[oó]n)?|intervenci[oó]n(?:\s+sugerida)?|acci[oó]n\s+recomendada|sugerencia)\s*[:\-]\s*/i,
      ''
    );
    const trailingLines: string[] = [];
    if (firstPart) trailingLines.push(firstPart);
    for (let i = recIndex + 1; i < lines.length; i++) {
      if (/^[A-ZÁÉÍÓÚÑ][^:]{2,35}:\s/.test(lines[i])) break;
      trailingLines.push(lines[i]);
    }
    const joined = sanitizeTextWithProfiles(trailingLines.join(' '), profilesMap);
    if (joined) recommendation = joined;
  }

  const students: TeacherRiskStudentEntry[] = [];
  const seenStudentKeys = new Set<string>();

  for (const line of lines) {
    const parsedEntry = parseLineAsStudentEntry(line, profilesMap);
    if (parsedEntry) {
      const key = parsedEntry.studentId || parsedEntry.code || parsedEntry.name.toLowerCase();
      if (!seenStudentKeys.has(key)) {
        seenStudentKeys.add(key);
        students.push(parsedEntry);
      }
    }
  }

  for (const uuid of extractUuids(rawBody)) {
    const prof = profilesMap[uuid] || profilesMap[uuid.toLowerCase()];
    if (prof && !seenStudentKeys.has(prof.id) && !seenStudentKeys.has(prof.code)) {
      seenStudentKeys.add(prof.id);
      students.push({
        studentId: prof.id,
        name: formatProfileName(prof),
        code: prof.code,
      });
    }
  }

  const normalizedRisk = normalizeRiskLevel(
    riskHeaderMatch?.[1] ?? students.find((s) => s.riskLevel)?.riskLevel ?? null
  );
  const absVal =
    absencesMatch?.[1] ?? students.find((s) => s.absences)?.absences ?? null;
  const pctRaw =
    percentageMatch?.[1] ?? students.find((s) => s.absencePercentage)?.absencePercentage ?? null;
  const pctVal = pctRaw
    ? pctRaw.includes('%')
      ? pctRaw.replace(/\s+/g, '')
      : `${pctRaw.trim()}%`
    : null;
  const consVal =
    consecutiveMatch?.[1] ?? students.find((s) => s.consecutiveAbsences)?.consecutiveAbsences ?? null;

  return {
    riskLevel: normalizedRisk,
    absencesCount: absVal,
    absencePercentage: pctVal,
    consecutiveAbsences: consVal,
    recommendation,
    students,
    formattedBody: formattedBody || rawBody,
  };
}

async function resolveCourseRefs(items: AppNotification[]): Promise<Map<string, NotificationCourseRef>> {
  const refMap = new Map<string, NotificationCourseRef>();
  if (!isSupabaseConfigured() || items.length === 0) return refMap;

  const sectionLookupIds = Array.from(
    new Set(
      items
        .filter((item) => Boolean(item.ref_id) && (item.ref_type === 'section' || !item.ref_type))
        .map((item) => item.ref_id as string)
    )
  );

  const explicitCourseLookupIds = Array.from(
    new Set(
      items
        .filter((item) => Boolean(item.ref_id) && item.ref_type === 'course')
        .map((item) => item.ref_id as string)
    )
  );

  const supabase = getSupabaseClient();

  if (sectionLookupIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('sections')
        .select('id, name, offering:course_offerings(id, course:courses(id, code, name))')
        .in('id', sectionLookupIds);

      if (error) {
        console.warn('No se pudo resolver la sección de la notificación:', error.message);
      } else {
        for (const row of (data ?? []) as SectionCourseRow[]) {
          const offering = pickSingle(row.offering);
          const course = pickSingle(offering?.course);
          refMap.set(row.id, {
            sectionId: row.id,
            sectionName: row.name,
            courseId: course?.id,
            courseCode: course?.code,
            courseName: course?.name,
          });
        }
      }
    } catch (err) {
      console.warn('Error resolviendo secciones de notificaciones:', err);
    }
  }

  const unresolvedAsCourseIds = Array.from(
    new Set([
      ...explicitCourseLookupIds,
      ...sectionLookupIds.filter((id) => !refMap.has(id)),
    ])
  );

  if (unresolvedAsCourseIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, code, name')
        .in('id', unresolvedAsCourseIds);

      if (error) {
        console.warn('No se pudo resolver el curso de la notificación:', error.message);
      } else {
        for (const course of (data ?? []) as CourseJoinRow[]) {
          refMap.set(course.id, {
            courseId: course.id,
            courseCode: course.code,
            courseName: course.name,
          });
        }
      }
    } catch (err) {
      console.warn('Error resolviendo cursos de notificaciones:', err);
    }
  }

  return refMap;
}

async function resolveStudentProfilesForTeacherAlerts(
  items: AppNotification[]
): Promise<Record<string, ProfileBasicInfo>> {
  const teacherAlerts = items.filter((item) => item.kind === 'riesgo_asistencia_profesor');
  if (teacherAlerts.length === 0) return {};

  const candidateUuids = new Set<string>();
  for (const alert of teacherAlerts) {
    for (const uuid of extractUuids(alert.body || '')) {
      if (uuid !== alert.ref_id?.toLowerCase() && uuid !== alert.user_id?.toLowerCase()) {
        candidateUuids.add(uuid);
      }
    }
  }

  if (candidateUuids.size === 0) return {};

  try {
    return await fetchProfilesMapByIds(Array.from(candidateUuids));
  } catch (err) {
    console.warn('No se pudieron resolver nombres de alumnos en la alerta:', err);
    return {};
  }
}

export async function enrichNotificationsWithCourseRefs(
  items: AppNotification[]
): Promise<AppNotification[]> {
  const unique = deduplicateById(items);
  if (unique.length === 0) return unique;

  const [refMap, profilesMap] = await Promise.all([
    resolveCourseRefs(unique),
    resolveStudentProfilesForTeacherAlerts(unique),
  ]);

  return unique.map((item) => {
    const courseRef = item.ref_id ? refMap.get(item.ref_id) ?? item.courseRef ?? null : null;
    const teacherRisk =
      item.kind === 'riesgo_asistencia_profesor'
        ? parseTeacherRiskBody(item.body || '', profilesMap)
        : item.teacherRisk ?? null;

    return {
      ...item,
      courseRef,
      teacherRisk,
    };
  });
}

export async function enrichSingleNotification(
  notification: AppNotification
): Promise<AppNotification> {
  const [enriched] = await enrichNotificationsWithCourseRefs([notification]);
  return enriched ?? notification;
}

const LOCAL_DISMISSED_NOTIF_PREFIX = 'ucvgo_dismissed_notif_ids_';

function readLocalDismissedNotifIds(userId?: string): Set<string> {
  if (!userId || typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(`${LOCAL_DISMISSED_NOTIF_PREFIX}${userId}`);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function addLocalDismissedNotifId(userId: string, id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readLocalDismissedNotifIds(userId);
    current.add(id);
    const trimmed = Array.from(current).slice(-200);
    window.localStorage.setItem(`${LOCAL_DISMISSED_NOTIF_PREFIX}${userId}`, JSON.stringify(trimmed));
  } catch {
  }
}

export async function fetchNotifications(
  limit = 50,
  userId?: string,
  kind?: NotificationKind
): Promise<AppNotification[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseClient();
  let query = supabase
    .from('notifications')
    .select('id, user_id, kind, title, body, ref_type, ref_id, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (kind) {
    query = query.eq('kind', kind);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingNotificationsTableError(error)) {
      console.warn('La tabla public.notifications no existe aún (falta la migración).');
      return [];
    }
    throw error;
  }

  const localDismissed = readLocalDismissedNotifIds(userId);
  const rawItems = ((data ?? []) as AppNotification[]).filter(
    (item) => !localDismissed.has(item.id)
  );
  return enrichNotificationsWithCourseRefs(rawItems);
}

export async function fetchTeacherRiskNotifications(
  teacherId: string,
  limit = 50
): Promise<AppNotification[]> {
  return fetchNotifications(limit, teacherId, 'riesgo_asistencia_profesor');
}

export async function markNotificationRead(id: string, userId?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = getSupabaseClient();
  let query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.select('id');

  if (error) {
    if (isMissingNotificationsTableError(error)) {
      console.warn('La tabla public.notifications no existe aún (falta la migración).');
      return false;
    }
    throw error;
  }

  return Boolean(data && data.length > 0);
}

export async function markNotificationUnread(id: string, userId?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = getSupabaseClient();
  let query = supabase
    .from('notifications')
    .update({ read_at: null })
    .eq('id', id);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.select('id');

  if (error) {
    if (isMissingNotificationsTableError(error)) {
      console.warn('La tabla public.notifications no existe aún (falta la migración).');
      return false;
    }
    throw error;
  }

  return Boolean(data && data.length > 0);
}

export async function markAllNotificationsRead(
  userId?: string,
  kind?: NotificationKind
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = getSupabaseClient();
  let query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (kind) {
    query = query.eq('kind', kind);
  }

  const { data, error } = await query.select('id');

  if (error) {
    if (isMissingNotificationsTableError(error)) {
      console.warn('La tabla public.notifications no existe aún (falta la migración).');
      return false;
    }
    throw error;
  }

  return Boolean(data && data.length > 0);
}

export async function deleteNotification(
  id: string,
  userId: string
): Promise<{ deletedInSupabase: boolean; sqlRequired: boolean }> {
  if (!isSupabaseConfigured()) {
    addLocalDismissedNotifId(userId, id);
    return { deletedInSupabase: false, sqlRequired: false };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id');

  if (error) {
    if (isMissingNotificationsTableError(error)) {
      console.warn('La tabla public.notifications no existe aún (falta la migración).');
      return { deletedInSupabase: false, sqlRequired: true };
    }
    const code = (error.code || '').toUpperCase();
    const msg = (error.message || '').toLowerCase();
    if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
      await markNotificationRead(id, userId).catch(() => {});
      addLocalDismissedNotifId(userId, id);
      return { deletedInSupabase: false, sqlRequired: true };
    }
    throw error;
  }

  if (!data || data.length === 0) {
    await markNotificationRead(id, userId).catch(() => {});
    addLocalDismissedNotifId(userId, id);
    return { deletedInSupabase: false, sqlRequired: true };
  }

  return { deletedInSupabase: true, sqlRequired: false };
}

