
export function getTodayLima(): string {

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

export function formatLimaDate(isoOrTimestampStr?: string | null): string {
  if (!isoOrTimestampStr) return '-';
  try {
    const d = new Date(isoOrTimestampStr);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return '-';
  }
}

export function formatLimaDateTime(isoOrTimestampStr?: string | null): string {
  if (!isoOrTimestampStr) return '-';
  try {
    const d = new Date(isoOrTimestampStr);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '-';
  }
}

export interface ToleranceEvaluation {
  startTimeStr: string;
  limitTimeStr: string;
  arrivalTimeStr: string;
  isWithinTolerance: boolean;
  suggestedStatus: 'presente' | 'tardanza';
  displayText: string;
}

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
