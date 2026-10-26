import { PostgrestError } from '@supabase/supabase-js';

export function translateSupabaseError(
  error: unknown,
  context?:
    | 'enrollments'
    | 'periods'
    | 'courses'
    | 'sections'
    | 'schedules'
    | 'teaching_assignments'
    | 'learning_units'
    | 'academic_weeks'
    | 'class_sessions'
    | 'attendance_records'
): string {
  if (!error) return 'Error desconocido.';

  const err = error as (PostgrestError & { code?: string; message?: string; details?: string; hint?: string });
  const code = err.code || '';
  const message = err.message || '';

  // Error de conexión o red real
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('fetch failed') ||
    message.includes('ERR_CONNECTION_REFUSED') ||
    message.toLowerCase().includes('apikey') ||
    message.toLowerCase().includes('invalid api key')
  ) {
    return 'No se pudo conectar con el servicio. Contacta al administrador.';
  }

  // 1. Error 23505: Unique constraint violation (valor duplicado)
  if (code === '23505') {
    if (context === 'learning_units' || context === 'academic_weeks') {
      return 'Ese número ya existe para este curso.';
    }
    if (context === 'enrollments') {
      return 'El alumno ya está matriculado en una sección de este curso y periodo.';
    }
    if (context === 'periods') {
      return 'Ya existe un periodo académico con este nombre.';
    }
    if (context === 'courses') {
      return 'Ya existe un curso con ese código (archivado). Pide a un administrador que lo elimine de la base de datos o use otro código.';
    }
    if (context === 'sections') {
      return 'Ya existe una sección con este nombre para el curso y periodo seleccionados.';
    }
    if (context === 'teaching_assignments') {
      return 'Este profesor ya se encuentra asignado a esta sección.';
    }
    if (context === 'class_sessions') {
      return 'Ya existe una sesión a esa hora.';
    }
    return 'Ya existe un registro con estos datos únicos (valor duplicado).';
  }

  // 2. Error 23503: Foreign key violation (referencia inexistente o vinculada)
  if (code === '23503') {
    return 'No se puede completar la operación: el registro está vinculado a otros datos existentes o la referencia no existe.';
  }

  // 3. Error 23514: Check constraint violation (restricción no cumplida)
  if (code === '23514') {
    if (context === 'periods' || context === 'learning_units' || context === 'academic_weeks') {
      return 'La fecha de fin debe ser posterior o igual a la fecha de inicio (ends_on >= starts_on).';
    }
    if (context === 'schedules' || context === 'class_sessions') {
      return 'La hora de fin debe ser mayor que la hora de inicio.';
    }
    if (context === 'sections') {
      return 'La capacidad de la sección debe ser un número entero mayor que 0.';
    }
    return 'Los datos ingresados no cumplen con las restricciones de validación del sistema.';
  }

  // 4. Falta de permisos (42501 o mensajes de RLS/Forbidden)
  if (
    code === '42501' ||
    message.toLowerCase().includes('permission') ||
    message.toLowerCase().includes('policy') ||
    message.toLowerCase().includes('forbidden')
  ) {
    return 'No tienes los permisos necesarios para realizar esta acción. Verifica tu sesión institucional.';
  }

  // Para cualquier otro error, mostrar el mensaje real
  return message || JSON.stringify(err);
}

/**
 * Traduce las respuestas de la función set_attendance de Supabase
 */
export function translateAttendanceRpcError(rpcResult: string): string {
  switch (rpcResult) {
    case 'unauthorized':
      return 'No tienes permiso sobre esta sesión.';
    case 'invalid_session':
      return 'La sesión no existe.';
    case 'session_cancelled':
      return 'La sesión está cancelada.';
    case 'future_session':
      return 'No se puede registrar asistencia en una sesión futura.';
    case 'session_closed':
      return 'La sesión ya está cerrada.';
    case 'not_enrolled':
      return 'El alumno no está matriculado en esta sección.';
    case 'success':
      return 'Asistencia registrada correctamente.';
    default:
      return `Error al registrar asistencia: ${rpcResult}`;
  }
}

/**
 * Traduce las respuestas de open_attendance
 */
export function translateOpenAttendanceError(rpcResult: string): string {
  switch (rpcResult) {
    case 'unauthorized':
      return 'No tienes permiso sobre esta sesión.';
    case 'invalid_session':
      return 'La sesión no existe.';
    case 'session_cancelled':
      return 'La sesión está cancelada.';
    case 'session_closed':
      return 'La sesión ya está cerrada.';
    case 'not_today':
      return 'Solo se puede abrir la asistencia el día de la clase.';
    case 'success':
      return 'Asistencia abierta exitosamente.';
    default:
      return `Error al abrir asistencia: ${rpcResult}`;
  }
}

/**
 * Traduce las respuestas de resolve_attendance_request
 */
export function translateResolveAttendanceError(rpcResult: string): string {
  switch (rpcResult) {
    case 'already_resolved':
      return 'Esta solicitud ya fue resuelta.';
    case 'unauthorized':
      return 'No tienes permiso para resolver solicitudes de esta sesión.';
    case 'invalid_request':
      return 'La solicitud no es válida o no existe.';
    case 'invalid_status':
      return 'El estado indicado no es válido.';
    case 'success':
      return 'Solicitud resuelta con éxito.';
    default:
      return `Error al resolver solicitud: ${rpcResult}`;
  }
}

/**
 * Traduce las respuestas de close_attendance
 */
export function translateCloseAttendanceError(code: string): string {
  switch (code) {
    case 'unauthorized':
      return 'No tienes permiso sobre esta sesión.';
    case 'invalid_session':
      return 'La sesión no existe.';
    case 'session_closed':
      return 'La sesión ya está cerrada.';
    case 'success':
      return 'Asistencia cerrada exitosamente.';
    default:
      return `Error al cerrar asistencia: ${code}`;
  }
}

