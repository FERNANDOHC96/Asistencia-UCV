export type UserRole = 'administrador' | 'profesor' | 'alumno';

export interface Profile {
  id: string;
  code: string;
  first_names: string;
  last_names: string;
  role: UserRole;
  active: boolean;
  created_at?: string;
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

// Estructura Académica

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
  weekday: number; // 1 = lunes ... 7 = domingo
  starts_at: string;
  ends_at: string;
  room?: string | null;
  kind?: SessionKind;
  archived_at?: string | null;
}

// Gestión Docente y Sesiones

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
export type AttendanceMethod = 'manual' | 'qr' | 'sistema';

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
  student?: Profile;
  class_session?: ClassSession;
}

// Asistencia y Códigos QR

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



