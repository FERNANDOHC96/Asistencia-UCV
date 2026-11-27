export type UserRole = 'administrador' | 'profesor' | 'alumno';

export interface Career {
  id: string;
  name: string;
}

export interface Profile {
  id: string;
  code: string;
  first_names: string;
  last_names: string;
  role: UserRole;
  active: boolean;
  created_at?: string;
  avatar_updated_at?: string | null;
  career_id?: string | null;
  career?: Career | null;
}

export interface CreateUserPayload {
  code: string;
  first_names: string;
  last_names: string;
  email?: string;
  role: 'alumno' | 'profesor';
}

export type EdgeFunctionResponseCode =
  | 'success'
  | 'invalid_code'
  | 'missing_name'
  | 'invalid_role'
  | 'forbidden'
  | 'unauthorized'
  | 'create_failed'
  | 'profile_failed';

export interface EdgeFunctionResponse {
  code: EdgeFunctionResponseCode | string;
  id?: string;
  error?: string;
  message?: string;
}

export type PeriodStatus = 'planificado' | 'activo' | 'finalizado';

export interface Period {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: PeriodStatus;
  archived_at?: string | null;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  archived_at?: string | null;
}

export interface CourseOffering {
  id: string;
  course_id: string;
  period_id: string;
  course?: Course;
  period?: Period;
}

export interface CourseOverview {
  course_id: string;
  code: string;
  name: string;
  offering_id: string;
  section_id: string;
  section_name: string;
  teacher_id: string | null;
  teacher_first_names: string | null;
  teacher_last_names: string | null;
  students: number;
}

export interface Section {
  id: string;
  offering_id: string;
  name: string;
  capacity?: number | null;
  archived_at?: string | null;
}

export interface TeachingAssignment {
  id: string;
  section_id: string;
  teacher_id: string;
  teacher?: Profile;
}

export type EnrollmentStatus = 'activa' | 'retirada';

export interface Enrollment {
  id: string;
  student_id: string;
  section_id: string;
  offering_id?: string;
  status: EnrollmentStatus;
  student?: Profile;
  enrolled_at?: string;
}

export type SessionKind = 'teoria' | 'practica';

export interface Schedule {
  id: string;
  section_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  room?: string | null;
  kind?: SessionKind;
  archived_at?: string | null;
}

export type UnitStatus = 'planificada' | 'en_curso' | 'finalizada';

export interface LearningUnit {
  id: string;
  offering_id: string;
  number: number;
  name: string;
  description: string;
  starts_on: string;
  ends_on: string;
  status: UnitStatus;
  archived_at?: string | null;
}

export interface AcademicWeek {
  id: string;
  offering_id: string;
  unit_id?: string | null;
  number: number;
  starts_on: string;
  ends_on: string;
  topic: string;
  content: string;
  activities: string;
  archived_at?: string | null;
}

export type SessionStatus = 'programada' | 'abierta' | 'cerrada' | 'cancelada';

export interface ClassSession {
  id: string;
  section_id: string;
  week_id?: string | null;
  unit_id?: string | null;
  session_date: string;
  starts_at: string;
  ends_at: string;
  topic: string;
  status: SessionStatus;
  kind?: SessionKind;
  unit?: LearningUnit;
  week?: AcademicWeek;
  archived_at?: string | null;
}

export type AttendanceStatus = 'presente' | 'tardanza' | 'falta' | 'justificado';
export type AttendanceMethod = 'manual' | 'qr' | 'sistema' | 'bluetooth' | (string & {});

export interface AttendanceRecord {
  id: string;
  class_session_id: string;
  student_id: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  justification?: string | null;
  registered_at?: string;
  modified_by?: string | null;
  modified_at?: string | null;
  bt_verified_at?: string | null;
  student?: Profile;
  class_session?: ClassSession;
}

export type AttendanceSessionStatus = 'abierta' | 'cerrada';

export interface AttendanceSession {
  id: string;
  class_session_id: string;
  status: AttendanceSessionStatus;
  qr_ttl_seconds: number;
  opened_at?: string;
  closed_at?: string | null;
}

export type AttendanceRequestStatus = 'pendiente' | 'aprobada' | 'rechazada' | 'expirada';

export interface AttendanceRequest {
  id: string;
  attendance_session_id: string;
  student_id: string;
  status: AttendanceRequestStatus;
  requested_at: string;
  resolved_at?: string | null;
  student?: Profile;
}

export interface QrTokenPayload {
  code: string;
  v?: number;
  sid?: string;
  tok?: string;
  exp?: number;
  error?: string;
}

export interface CloseAttendanceResult {
  code: string;
  enrolled?: number;
  presentes?: number;
  tardanzas?: number;
  faltas?: number;
  justificados?: number;
  solicitudes_expiradas?: number;
  error?: string;
}

export interface TeacherName {
  id: string;
  first_names: string;
  last_names: string;
}

export type NotificationKind =
  | 'riesgo_asistencia'
  | 'riesgo_asistencia_profesor'
  | 'general'
  | (string & {});

export interface NotificationCourseRef {
  sectionId?: string;
  sectionName?: string;
  courseId?: string;
  courseCode?: string;
  courseName?: string;
}

export interface StudentAttendanceHistoryEntry {
  sessionId: string;
  date: string;
  startsAt: string;
  topic: string;
  kind: 'teoria' | 'practica';
  status: AttendanceStatus;
}

export interface TeacherRiskStudentEntry {
  studentId?: string | null;
  name: string;
  code?: string | null;
  careerName?: string | null;
  riskLevel?: string | null;
  absences?: string | null;
  absencesNum?: number;
  cycleAbsencesNum?: number;
  evaluatedSessionsNum?: number;
  attendedNum?: number;
  tardanzasNum?: number;
  justificadosNum?: number;
  absencePercentage?: string | null;
  absencePercentageNum?: number;
  consecutiveAbsences?: string | null;
  consecutiveAbsencesNum?: number;
  maxConsecutiveAbsencesNum?: number;
  isBlocked?: boolean;
  lastAbsenceSessionId?: string | null;
  absenceDates?: string[];
  attendanceHistory?: StudentAttendanceHistoryEntry[];
}

export interface TeacherRiskDetails {
  riskLevel: string | null;
  absencesCount: string | null;
  totalAbsencesNum?: number;
  maxAbsencesNum?: number;
  absencePercentage: string | null;
  consecutiveAbsences: string | null;
  recommendation: string | null;
  students: TeacherRiskStudentEntry[];
  formattedBody: string;
  evaluatedSessionsCount?: number;
  isLiveCalculated?: boolean;
  isResolved?: boolean;
  riskSignature?: string;
  sectionId?: string | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  ref_type?: string | null;
  ref_id?: string | null;
  read_at?: string | null;
  created_at: string;
  courseRef?: NotificationCourseRef | null;
  teacherRisk?: TeacherRiskDetails | null;
}

export interface TeacherAlertDismissal {
  id?: string;
  teacher_id: string;
  section_id: string;
  notification_id?: string | null;
  risk_signature: string;
  read_at?: string | null;
  dismissed_at?: string | null;
}

export interface LiveSectionRiskAlert {
  id: string;
  notificationId: string | null;
  notification: AppNotification | null;
  sectionId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  periodName: string;
  title: string;
  createdAt: string;
  readAt: string | null;
  isLiveOnly: boolean;
  details: TeacherRiskDetails;
}

export interface StudentSectionBlock {
  student_id: string;
  section_id: string;
  blocked_at: string;
  blocked_by?: string | null;
  reason?: string | null;
  unblocked_at?: string | null;
  unblocked_by?: string | null;
  unblock_reason?: string | null;
  absences_at_unblock?: number | null;
}

export interface StudentBlockRecordWithDetails extends StudentSectionBlock {
  studentName: string;
  studentCode: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  periodName: string;
  totalAbsences: number;
  cycleAbsences: number;
  isActive: boolean;
  unblockedByName?: string | null;
}

export interface SectionStudentBlockStatus {
  isBlocked: boolean;
  activeBlock: StudentSectionBlock | null;
  lastUnblock: StudentSectionBlock | null;
  totalAbsences: number;
  cycleAbsences: number;
}

