/**
 * Utilidades para manejo de fechas en zona horaria America/Lima (Perú)
 * Asegura que session_date y fechas de inicio/fin nunca se desplacen por huso horario.
 */

export function getTodayLima(): string {
  // Retorna YYYY-MM-DD en America/Lima
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '-';
  // Extrae directamente año, mes, día sin parsear a UTC
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

export function formatTime(timeStr?: string | null): string {
  if (!timeStr) return '-';
  return timeStr.slice(0, 5);
}

/**
 * Formatea una fecha/hora ISO en la hora de Lima (America/Lima) en formato HH:MM
 */
export function formatLimaTime(isoOrTimestampStr?: string | null): string {
  if (!isoOrTimestampStr) return '--:--';
  try {
    const d = new Date(isoOrTimestampStr);
    if (isNaN(d.getTime())) return '--:--';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '--:--';
  }
}

export interface ToleranceEvaluation {
  startTimeStr: string;        // e.g. "06:10"
  limitTimeStr: string;        // e.g. "06:20"
  arrivalTimeStr: string;      // e.g. "06:24"
  isWithinTolerance: boolean;  // true si llegó dentro de tolerancia
  suggestedStatus: 'presente' | 'tardanza';
  displayText: string;         // e.g. "Llegó 06:24 · fuera de tolerancia (hasta 06:20) · sugerido: tardanza"
}

/**
 * Calcula el límite de puntualidad dado session_date, starts_at y minutos de tolerancia en America/Lima.
 */
export function calculateToleranceLimit(
  sessionDate: string,
  startsAt: string,
  toleranceMinutes: number = 10
): { startMs: number; limitMs: number; startTimeStr: string; limitTimeStr: string } {
  const [shStr = '00', smStr = '00'] = (startsAt || '00:00').slice(0, 5).split(':');
  const sh = parseInt(shStr, 10);
  const sm = parseInt(smStr, 10);
  const cleanStartTimeStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;

  const dateStr = sessionDate || getTodayLima();
  // Hora de Lima es UTC-5
  const startIso = `${dateStr}T${cleanStartTimeStr}:00-05:00`;
  const startMs = new Date(startIso).getTime();
  const limitMs = startMs + Math.max(0, toleranceMinutes) * 60 * 1000;

  const limitDate = new Date(limitMs);
  const limitTimeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(limitDate);

  return { startMs, limitMs, startTimeStr: cleanStartTimeStr, limitTimeStr };
}

/**
 * Evalúa si una solicitud de asistencia (requested_at) está dentro de la tolerancia de la clase.
 * Regla:
 * - Límite de puntualidad = session_date + starts_at + tolerancia, interpretado en America/Lima.
 * - Si requested_at, convertida a hora de Lima, es MENOR O IGUAL al límite: estado sugerido "presente".
 * - Si es posterior: "tardanza".
 */
export function evaluateAttendanceTolerance(
  sessionDate: string,
  startsAt: string,
  requestedAt: string,
  toleranceMinutes: number = 10
): ToleranceEvaluation {
  const { limitMs, startTimeStr, limitTimeStr } = calculateToleranceLimit(
    sessionDate,
    startsAt,
    toleranceMinutes
  );

  const arrivalTimeStr = formatLimaTime(requestedAt);
  const reqDate = new Date(requestedAt);
  const reqMs = reqDate.getTime();

  // Si requested_at es MENOR O IGUAL al límite: "presente". Si es posterior: "tardanza"
  const isWithinTolerance = !isNaN(reqMs) && reqMs <= limitMs;
  const suggestedStatus: 'presente' | 'tardanza' = isWithinTolerance ? 'presente' : 'tardanza';

  const conditionText = isWithinTolerance
    ? `dentro de tolerancia (hasta ${limitTimeStr})`
    : `fuera de tolerancia (hasta ${limitTimeStr})`;

  const displayText = `Llegó ${arrivalTimeStr} · ${conditionText} · sugerido: ${suggestedStatus}`;

  return {
    startTimeStr,
    limitTimeStr,
    arrivalTimeStr,
    isWithinTolerance,
    suggestedStatus,
    displayText,
  };
}
