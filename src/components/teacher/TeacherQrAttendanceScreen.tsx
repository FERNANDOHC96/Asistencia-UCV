import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Play,
  StopCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  Check,
  CheckCircle,
  XCircle,
  HelpCircle,
  Calendar,
  Layers,
  BookOpen,
  FlaskConical
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getTeacherSections, getSectionActiveStudents, getLateToleranceMinutes, TeacherSection } from '../../services/teacherService';
import { fetchProfilesMapByIds } from '../../lib/profileHelper';
import { ClassSession, AttendanceRequest, AttendanceRecord, Profile, QrTokenPayload, CloseAttendanceResult } from '../../types';
import {
  getTodayLima,
  formatDisplayDate,
  formatTime,
  formatLimaTime,
  calculateToleranceLimit,
  evaluateAttendanceTolerance
} from '../../lib/dateUtils';
import {
  translateOpenAttendanceError,
  translateResolveAttendanceError,
  translateCloseAttendanceError,
  translateSupabaseError
} from '../../lib/supabaseErrors';

export const TeacherQrAttendanceScreen: React.FC = () => {
  const { user } = useAuth();
  const todayLima = getTodayLima();

  // Tolerancia de tardanza en minutos (de la tabla settings, key 'late_tolerance_minutes', default 10)
  const [toleranceMinutes, setToleranceMinutes] = useState<number>(10);

  // Estados de carga de datos iniciales
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedKind, setSelectedKind] = useState<'all' | 'teoria' | 'practica'>('all');
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sesión seleccionada
  const activeSession = sessions.find((s) => s.id === selectedSessionId);

  // Cálculo de hora de inicio y límite de tolerancia para la sesión activa
  const sessionTolerance = activeSession
    ? calculateToleranceLimit(activeSession.session_date, activeSession.starts_at, toleranceMinutes)
    : null;

  // Estado del QR y la sesión de asistencia
  const [isAttendanceOpen, setIsAttendanceOpen] = useState<boolean>(false);
  const [attendanceSessionId, setAttendanceSessionId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrRawString, setQrRawString] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(8);

  // Solicitudes y registros
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
  const [resolveActionFeedback, setResolveActionFeedback] = useState<string | null>(null);

  // Modal de confirmación para cerrar asistencia
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [closeSummary, setCloseSummary] = useState<CloseAttendanceResult | null>(null);

  // Intervalos de polling
  const qrIntervalRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const requestsIntervalRef = useRef<any>(null);

  // 1. Cargar secciones asignadas al profesor
  const loadSections = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoadingInitial(false);
      return;
    }
    setLoadingInitial(true);
    setError(null);

    try {
      const teacherSecs = await getTeacherSections(user.id);
      setSections(teacherSecs);
      if (teacherSecs.length > 0) {
        setSelectedSectionId(teacherSecs[0].id);
      }
    } catch (err: any) {
      setError(translateSupabaseError(err, 'sections'));
    } finally {
      setLoadingInitial(false);
    }
  }, [user]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  // Cargar tolerancia de tardanza desde la tabla settings (default 10)
  useEffect(() => {
    getLateToleranceMinutes().then((mins) => {
      setToleranceMinutes(mins);
    });
  }, []);

  // 2. Cargar sesiones de HOY para la sección seleccionada
  const loadSessions = useCallback(async () => {
    if (!selectedSectionId) {
      setSessions([]);
      setSelectedSessionId('');
      return;
    }
    setLoadingSessions(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      // Solo sesiones de HOY (zona America/Lima)
      const { data, error: sErr } = await supabase
        .from('class_sessions')
        .select(`
          id,
          section_id,
          week_id,
          unit_id,
          session_date,
          starts_at,
          ends_at,
          topic,
          status,
          kind,
          unit:learning_units (id, number, name),
          week:academic_weeks (id, number, topic)
        `)
        .eq('section_id', selectedSectionId)
        .eq('session_date', todayLima)
        .is('archived_at', null)
        .order('starts_at', { ascending: true });

      if (sErr) throw sErr;

      const loaded: ClassSession[] = (data || []).map((row: any) => {
        const un = Array.isArray(row.unit) ? row.unit[0] : row.unit;
        const wk = Array.isArray(row.week) ? row.week[0] : row.week;
        return {
          ...row,
          unit: un,
          week: wk,
        } as unknown as ClassSession;
      });
      setSessions(loaded);

      // Si hay una sesión abierta o programada, seleccionarla
      if (loaded.length > 0) {
        const openOrScheduled = loaded.find((s) => s.status === 'abierta' || s.status === 'programada');
        setSelectedSessionId(openOrScheduled ? openOrScheduled.id : loaded[0].id);
      } else {
        setSelectedSessionId('');
      }

      // También cargar alumnos activos de la sección seleccionada
      const enrolled = await getSectionActiveStudents(selectedSectionId);
      setStudents(enrolled);
    } catch (err: any) {
      setError(translateSupabaseError(err, 'class_sessions'));
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedSectionId, todayLima]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Filtrar sesiones según el tipo seleccionado (Todas / Teoría / Práctica)
  const filteredSessions = sessions.filter((s) => {
    if (selectedKind !== 'all' && (s.kind || 'teoria') !== selectedKind) return false;
    return true;
  });

  useEffect(() => {
    if (filteredSessions.length > 0) {
      if (!selectedSessionId || !filteredSessions.some((s) => s.id === selectedSessionId)) {
        const openOrScheduled = filteredSessions.find((s) => s.status === 'abierta' || s.status === 'programada');
        setSelectedSessionId(openOrScheduled ? openOrScheduled.id : filteredSessions[0].id);
      }
    } else {
      setSelectedSessionId('');
    }
  }, [filteredSessions, selectedSessionId]);

  // 3. Verificar estado actual de la sesión (si ya está 'abierta' o 'cerrada')
  const checkCurrentSessionStatus = useCallback(async () => {
    if (!selectedSessionId) {
      setIsAttendanceOpen(false);
      setAttendanceSessionId(null);
      setQrDataUrl(null);
      setRequests([]);
      setRecords([]);
      return;
    }

    try {
      const supabase = getSupabaseClient();

      // Consultar estado de la clase
      const { data: classSess, error: csErr } = await supabase
        .from('class_sessions')
        .select('id, status')
        .eq('id', selectedSessionId)
        .single();

      if (csErr) throw csErr;

      // Buscar si existe un attendance_sessions asociado
      const { data: attSess, error: asErr } = await supabase
        .from('attendance_sessions')
        .select('id, status, qr_ttl_seconds')
        .eq('class_session_id', selectedSessionId)
        .order('opened_at', { ascending: false })
        .limit(1);

      if (!asErr && attSess && attSess.length > 0) {
        const latestAttSess = attSess[0];
        setAttendanceSessionId(latestAttSess.id);

        if (latestAttSess.status === 'abierta' && classSess?.status === 'abierta') {
          setIsAttendanceOpen(true);
        } else {
          setIsAttendanceOpen(false);
        }
      } else {
        setIsAttendanceOpen(false);
        setAttendanceSessionId(null);
      }

      // Cargar registros existentes de asistencia para esta sesión
      await fetchSessionRecords();
    } catch (err: any) {
      // Ignorar errores transitorios
    }
  }, [selectedSessionId]);

  useEffect(() => {
    checkCurrentSessionStatus();
  }, [checkCurrentSessionStatus]);

  // 4. Consultar registros de asistencia de la sesión (attendance_records)
  const fetchSessionRecords = useCallback(async () => {
    if (!selectedSessionId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error: recErr } = await supabase
        .from('attendance_records')
        .select('id, class_session_id, student_id, status, method, justification, registered_at')
        .eq('class_session_id', selectedSessionId);

      if (!recErr && data) {
        setRecords(data as AttendanceRecord[]);
      }
    } catch (err) {
      // ignore
    }
  }, [selectedSessionId]);

  // 5. Polling de Solicitudes Pendientes (cada 3 segundos mientras esté abierta)
  const fetchPendingRequests = useCallback(async () => {
    if (!attendanceSessionId || !isAttendanceOpen) return;

    try {
      const supabase = getSupabaseClient();
      const { data: reqData, error: reqErr } = await supabase
        .from('attendance_requests')
        .select('id, attendance_session_id, student_id, status, requested_at, resolved_at')
        .eq('attendance_session_id', attendanceSessionId)
        .order('requested_at', { ascending: false });

      if (reqErr) throw reqErr;

      if (reqData && reqData.length > 0) {
        const studentIds = Array.from(new Set(reqData.map((r) => r.student_id)));
        const profilesMap = await fetchProfilesMapByIds(studentIds);

        const enrichedRequests: AttendanceRequest[] = reqData.map((r) => {
          const prof = profilesMap[r.student_id];
          return {
            ...r,
            student: prof
              ? {
                  ...prof,
                  role: 'alumno' as const,
                  active: true,
                }
              : undefined,
          };
        });

        setRequests(enrichedRequests);
      } else {
        setRequests([]);
      }

      // También refrescar registros de asistencia para actualizar contadores
      await fetchSessionRecords();
    } catch (err) {
      // Error silencioso en polling
    }
  }, [attendanceSessionId, isAttendanceOpen, fetchSessionRecords]);

  // Polling de solicitudes cada 3 segundos
  useEffect(() => {
    if (isAttendanceOpen && attendanceSessionId) {
      fetchPendingRequests();
      requestsIntervalRef.current = setInterval(() => {
        fetchPendingRequests();
      }, 3000);
    } else {
      if (requestsIntervalRef.current) clearInterval(requestsIntervalRef.current);
    }

    return () => {
      if (requestsIntervalRef.current) clearInterval(requestsIntervalRef.current);
    };
  }, [isAttendanceOpen, attendanceSessionId, fetchPendingRequests]);

  // 6. Generación del Token QR con new_qr_token cada 8 segundos
  const fetchNewQrToken = useCallback(async () => {
    if (!selectedSessionId || !isAttendanceOpen) return;

    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('new_qr_token', {
        p_class_session: selectedSessionId,
      });

      if (rpcErr) throw rpcErr;

      const payload = data as QrTokenPayload;

      if (payload && payload.code === 'success') {
        const qrJson = JSON.stringify({
          v: payload.v,
          sid: payload.sid,
          tok: payload.tok,
          exp: payload.exp,
        });

        setQrRawString(qrJson);
        setQrError(null);

        // Si aún no tenemos attendanceSessionId, actualizarlo desde sid
        if (payload.sid && payload.sid !== attendanceSessionId) {
          setAttendanceSessionId(payload.sid);
        }

        // Generar QR con la librería qrcode
        const dataUrl = await QRCode.toDataURL(qrJson, {
          width: 320,
          margin: 2,
          color: {
            dark: '#0B2A5B',
            light: '#FFFFFF',
          },
        });
        setQrDataUrl(dataUrl);
        setCountdown(8);
      } else {
        // Fallo devuelto por la función
        const errCode = payload?.code || 'error';
        setQrError(`El servidor no pudo generar el código QR: ${errCode}`);
        setQrDataUrl(null);
      }
    } catch (err: any) {
      setQrError(err.message || 'Error de conexión al generar el código QR.');
      setQrDataUrl(null);
    }
  }, [selectedSessionId, isAttendanceOpen, attendanceSessionId]);

  // Iniciar ciclo de regeneración cada 8 segundos y temporizador visible
  useEffect(() => {
    if (isAttendanceOpen) {
      fetchNewQrToken();

      qrIntervalRef.current = setInterval(() => {
        fetchNewQrToken();
      }, 8000);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => (prev > 1 ? prev - 1 : 8));
      }, 1000);
    } else {
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setQrDataUrl(null);
      setQrRawString(null);
    }

    return () => {
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isAttendanceOpen, fetchNewQrToken]);

  // 7. Acción: Abrir Asistencia
  const handleOpenAttendance = async () => {
    if (!selectedSessionId) return;
    setError(null);
    setCloseSummary(null);

    // Si la sesión ya está en estado 'abierta', solo retomar sin reabrir
    if (activeSession?.status === 'abierta') {
      setIsAttendanceOpen(true);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('open_attendance', {
        p_class_session: selectedSessionId,
      });

      if (rpcErr) throw rpcErr;

      const result = String(data);
      if (result === 'success') {
        setIsAttendanceOpen(true);
        // Actualizar estado local de la sesión
        setSessions((prev) =>
          prev.map((s) => (s.id === selectedSessionId ? { ...s, status: 'abierta' } : s))
        );
        // Consultar el attendance_session_id recién abierto
        const { data: attSess } = await supabase
          .from('attendance_sessions')
          .select('id')
          .eq('class_session_id', selectedSessionId)
          .eq('status', 'abierta')
          .order('opened_at', { ascending: false })
          .limit(1);

        if (attSess && attSess.length > 0) {
          setAttendanceSessionId(attSess[0].id);
        }
      } else {
        setError(translateOpenAttendanceError(result));
      }
    } catch (err: any) {
      setError(translateSupabaseError(err));
    }
  };

  // 8. Acción: Resolver Solicitud (Aprobar presente / tardanza / Rechazar)
  const handleResolveRequest = async (requestId: string, approve: boolean, status: 'presente' | 'tardanza') => {
    setResolvingRequestId(requestId);
    setResolveActionFeedback(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('resolve_attendance_request', {
        p_request: requestId,
        p_approve: approve,
        p_status: status,
      });

      if (rpcErr) throw rpcErr;

      const result = String(data);
      if (result === 'success') {
        // Quitar la solicitud resuelta de la lista pendiente
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        // Actualizar registros de asistencia
        await fetchSessionRecords();
      } else {
        setResolveActionFeedback(translateResolveAttendanceError(result));
      }
    } catch (err: any) {
      setResolveActionFeedback(translateSupabaseError(err));
    } finally {
      setResolvingRequestId(null);
    }
  };

  // 9. Acción: Cerrar Asistencia (close_attendance)
  const handleConfirmCloseAttendance = async () => {
    if (!selectedSessionId) return;
    setIsClosing(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('close_attendance', {
        p_class_session: selectedSessionId,
      });

      if (rpcErr) throw rpcErr;

      const summary = data as CloseAttendanceResult;

      if (summary && summary.code === 'success') {
        setCloseSummary(summary);
        setIsAttendanceOpen(false);
        setIsCloseModalOpen(false);
        // Actualizar estado de la sesión local
        setSessions((prev) =>
          prev.map((s) => (s.id === selectedSessionId ? { ...s, status: 'cerrada' } : s))
        );
        // Refrescar registros
        await fetchSessionRecords();
      } else {
        const errCode = summary?.code || 'error';
        setError(translateCloseAttendanceError(errCode));
        setIsCloseModalOpen(false);
      }
    } catch (err: any) {
      setError(translateSupabaseError(err));
      setIsCloseModalOpen(false);
    } finally {
      setIsClosing(false);
    }
  };

  // Contadores reales calculados
  const enrolledCount = students.length;
  const approvedQrRecords = records.filter((r) => r.method === 'qr' && (r.status === 'presente' || r.status === 'tardanza'));
  const pendingRequestsList = requests.filter((r) => r.status === 'pendiente');
  const rejectedRequestsList = requests.filter((r) => r.status === 'rechazada');

  // Mapa de asistencia de los estudiantes
  const studentRecordsMap: Record<string, AttendanceRecord> = {};
  records.forEach((r) => {
    studentRecordsMap[r.student_id] = r;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Encabezado */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B2A5B]">Asistencia por Código QR</h1>
          <p className="text-xs text-slate-500 mt-1">
            Genere códigos QR dinámicos para sus alumnos. El escaneo crea una solicitud que requiere su aprobación manual.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadSessions();
              fetchSessionRecords();
            }}
            disabled={loadingInitial || loadingSessions}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loadingInitial || loadingSessions) ? 'animate-spin text-[#1F5FA8]' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Aviso Permanente de Aprobación */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong className="font-bold">Aviso importante:</strong> Los alumnos no quedan presentes hasta que tú apruebes su solicitud. Escanear el código QR únicamente envía una solicitud de asistencia en espera de su confirmación.
        </div>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-800">Error en el módulo de Asistencia QR</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Selectores de Sección y Sesión de HOY */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
          1. Selección de Clase para Asistencia
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Selector de Asignatura */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Asignatura / Sección:
            </label>
            <select
              value={selectedSectionId}
              disabled={isAttendanceOpen}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] disabled:bg-slate-100 disabled:text-slate-400"
            >
              {sections.length === 0 ? (
                <option value="">No tiene asignaturas asignadas</option>
              ) : (
                sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.offering.course.code} - Sec. {sec.name} ({sec.offering.course.name})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Filtro por Tipo de Clase */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tipo de Clase:
            </label>
            <select
              value={selectedKind}
              disabled={isAttendanceOpen}
              onChange={(e) => setSelectedKind(e.target.value as 'all' | 'teoria' | 'practica')}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="all">Todas (Teoría y Práctica)</option>
              <option value="teoria">Solo Teoría</option>
              <option value="practica">Solo Práctica</option>
            </select>
          </div>

          {/* Selector de Sesión de HOY */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Sesión programada para hoy ({todayLima}):
            </label>
            <select
              value={selectedSessionId}
              disabled={isAttendanceOpen}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] disabled:bg-slate-100 disabled:text-slate-400"
            >
              {filteredSessions.length === 0 ? (
                <option value="">No hay sesiones programadas para hoy</option>
              ) : (
                filteredSessions.map((sess) => {
                  const kindLabel = sess.kind === 'practica' ? 'Práctica' : 'Teoría';
                  return (
                    <option key={sess.id} value={sess.id}>
                      {kindLabel} · {sess.starts_at?.slice(0, 5)} - {sess.ends_at?.slice(0, 5)}: {sess.topic} [{sess.status.toUpperCase()}]
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>

        {/* Ficha Informativa de la Sesión Seleccionada */}
        {activeSession ? (
          <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Tipo de clase:</span>
              <span
                className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] uppercase border mt-0.5 ${
                  activeSession.kind === 'practica'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                }`}
              >
                {activeSession.kind === 'practica' ? (
                  <FlaskConical className="w-3 h-3 text-purple-600" />
                ) : (
                  <BookOpen className="w-3 h-3 text-[#1F5FA8]" />
                )}
                <span>{activeSession.kind === 'practica' ? 'Práctica' : 'Teoría'}</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Tema:</span>
              <strong className="text-slate-800 font-bold">{activeSession.topic}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Horario:</span>
              <span className="text-[#1F5FA8] font-mono font-bold">
                {activeSession.starts_at?.slice(0, 5)} - {activeSession.ends_at?.slice(0, 5)}
              </span>
              {sessionTolerance && (
                <div className="text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold mt-1 inline-flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                  <span>Inicio {sessionTolerance.startTimeStr} · tolerancia hasta {sessionTolerance.limitTimeStr}</span>
                </div>
              )}
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Unidad / Semana:</span>
              <span className="text-slate-700 font-medium">
                {activeSession.unit ? `U${activeSession.unit.number}` : 'S/U'}
                {activeSession.week ? ` - Sem ${activeSession.week.number}` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Estado actual:</span>
              <span
                className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] uppercase border mt-0.5 ${
                  activeSession.status === 'abierta'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : activeSession.status === 'cerrada'
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : activeSession.status === 'cancelada'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {activeSession.status}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
            No hay sesión seleccionada para hoy. Verifique que la clase esté programada con la fecha de hoy ({todayLima}).
          </div>
        )}
      </div>

      {/* Controles de Apertura / Cierre */}
      {activeSession && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full ${
                isAttendanceOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
              }`}
            />
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {isAttendanceOpen ? 'Asistencia en Curso (Código QR Activo)' : 'Asistencia Detenida'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAttendanceOpen
                  ? 'El código QR rota automáticamente cada 8 segundos para evitar capturas antiguas.'
                  : activeSession.status === 'cerrada'
                  ? 'Esta sesión ya fue cerrada. A continuación puede consultar el resumen y el historial.'
                  : 'Presione el botón para abrir la toma de asistencia y proyectar el QR a los alumnos.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isAttendanceOpen && activeSession.status !== 'cerrada' && activeSession.status !== 'cancelada' && (
              <button
                type="button"
                onClick={handleOpenAttendance}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F5FA8] hover:bg-[#174B88] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Abrir Asistencia QR</span>
              </button>
            )}

            {isAttendanceOpen && (
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C8102E] hover:bg-red-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <StopCircle className="w-4 h-4" />
                <span>Cerrar Asistencia</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Panel del QR y Solicitudes Pendientes (cuando está abierto) */}
      {isAttendanceOpen && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tarjeta del Código QR Dinámico */}
          <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs flex flex-col items-center justify-center text-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-xs uppercase font-bold text-slate-500 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-[#1F5FA8]" />
                Código QR Dinámico
              </span>
              {/* Temporizador de rotación */}
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#1F5FA8] bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                <Clock className="w-3.5 h-3.5" />
                <span>Rotando en: {countdown}s</span>
              </div>
            </div>

            {/* Visualización del QR */}
            <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-sm mb-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Código QR de Asistencia Dinámico"
                  className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-lg"
                />
              ) : (
                <div className="w-64 h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#1F5FA8]" />
                  <span className="text-xs">Generando código seguro...</span>
                </div>
              )}
            </div>

            {qrError && (
              <div className="w-full text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 mb-3 text-left">
                {qrError}
              </div>
            )}

            <p className="text-xs text-slate-600 max-w-xs font-medium">
              Proyecte este código en pantalla. Cada código dura 10 segundos y se renueva automáticamente.
            </p>
          </div>

          {/* Tarjeta de Solicitudes Pendientes con Polling */}
          <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-3 gap-2">
              <div>
                <h3 className="text-xs uppercase font-bold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#1F5FA8]" />
                  Solicitudes Pendientes de Aprobación
                </h3>
                {sessionTolerance ? (
                  <div className="text-[11px] text-slate-600 font-medium flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Inicio {sessionTolerance.startTimeStr} · tolerancia hasta {sessionTolerance.limitTimeStr}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">({toleranceMinutes} min de tolerancia)</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Actualización periódica por consulta cada 3 segundos
                  </span>
                )}
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 self-start sm:self-auto">
                {pendingRequestsList.length} en espera
              </span>
            </div>

            {resolveActionFeedback && (
              <div className="p-3 mb-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
                {resolveActionFeedback}
              </div>
            )}

            {/* Lista de Solicitudes */}
            <div className="flex-1 overflow-y-auto max-h-96 space-y-2.5 pr-1">
              {pendingRequestsList.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No hay solicitudes pendientes</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Cuando los alumnos escaneen el código QR en sus teléfonos, sus solicitudes aparecerán aquí para que usted las valide y apruebe.
                  </p>
                </div>
              ) : (
                pendingRequestsList.map((req) => {
                  const evaluation = activeSession
                    ? evaluateAttendanceTolerance(
                        activeSession.session_date,
                        activeSession.starts_at,
                        req.requested_at,
                        toleranceMinutes
                      )
                    : null;

                  const isPresenteSuggested = evaluation?.suggestedStatus === 'presente';
                  const isTardanzaSuggested = evaluation?.suggestedStatus === 'tardanza';

                  return (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {req.student?.code || 'S/C'}
                          </span>
                          <strong className="text-xs font-bold text-slate-900">
                            {req.student ? `${req.student.last_names}, ${req.student.first_names}` : 'Estudiante'}
                          </strong>
                        </div>

                        {/* Texto de hora de llegada y sugerencia con cálculo en hora de Lima */}
                        {evaluation ? (
                          <div
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md border mt-0.5 ${
                              isPresenteSuggested
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-900 border-amber-200'
                            }`}
                          >
                            {isPresenteSuggested ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                            <span>{evaluation.displayText}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Llegó: {formatLimaTime(req.requested_at)}</span>
                          </div>
                        )}
                      </div>

                      {/* Botones de Decisión Docente: Resalta el sugerido sin bloquear los demás */}
                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <button
                          type="button"
                          disabled={resolvingRequestId === req.id}
                          onClick={() => handleResolveRequest(req.id, true, 'presente')}
                          className={`px-3 py-1.5 rounded-lg text-white text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                            isPresenteSuggested
                              ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400 ring-offset-1 font-black shadow-sm'
                              : 'bg-emerald-600/80 hover:bg-emerald-600'
                          }`}
                          title="Aprobar como Presente"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{isPresenteSuggested ? 'Presente (Sugerido)' : 'Presente'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={resolvingRequestId === req.id}
                          onClick={() => handleResolveRequest(req.id, true, 'tardanza')}
                          className={`px-3 py-1.5 rounded-lg text-white text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                            isTardanzaSuggested
                              ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400 ring-offset-1 font-black shadow-sm'
                              : 'bg-amber-600/80 hover:bg-amber-600'
                          }`}
                          title="Aprobar como Tardanza"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{isTardanzaSuggested ? 'Tardanza (Sugerido)' : 'Tardanza'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={resolvingRequestId === req.id}
                          onClick={() => handleResolveRequest(req.id, false, 'presente')}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 font-bold text-[11px] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 border border-slate-200"
                          title="Rechazar solicitud"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Rechazar</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contadores Reales de la Sesión */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Matriculados Activos */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase">Matriculados</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{enrolledCount}</div>
          <span className="text-[10px] text-slate-400">Total en la sección</span>
        </div>

        {/* Aprobados por QR */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase">Aprobados QR</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{approvedQrRecords.length}</div>
          <span className="text-[10px] text-slate-400">Asistencias confirmadas</span>
        </div>

        {/* Pendientes */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase">En Espera</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{pendingRequestsList.length}</div>
          <span className="text-[10px] text-slate-400">Por revisar</span>
        </div>

        {/* Rechazados */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase">Rechazados</span>
            <UserX className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600">{rejectedRequestsList.length}</div>
          <span className="text-[10px] text-slate-400">Solicitudes denegadas</span>
        </div>
      </div>

      {/* Resumen post-cierre (si la sesión está cerrada) */}
      {(closeSummary || activeSession?.status === 'cerrada') && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/60 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-[#0B2A5B]">Resumen de Cierre de Asistencia</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Tipo de sesión cerrada:</span>
              <span
                className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full text-xs uppercase border ${
                  activeSession?.kind === 'practica'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                }`}
              >
                {activeSession?.kind === 'practica' ? (
                  <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5 text-[#1F5FA8]" />
                )}
                <span>{activeSession?.kind === 'practica' ? 'Práctica' : 'Teoría'}</span>
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            La sesión ha concluido su proceso de registro de asistencia. A continuación se presentan las cifras finales registradas en la base de datos:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2">
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Matriculados</span>
              <strong className="text-lg font-black text-slate-800">
                {closeSummary?.enrolled ?? enrolledCount}
              </strong>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">Presentes</span>
              <strong className="text-lg font-black text-emerald-700">
                {closeSummary?.presentes ?? records.filter((r) => r.status === 'presente').length}
              </strong>
            </div>
            <div className="bg-white p-3 rounded-lg border border-amber-200 text-center">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">Tardanzas</span>
              <strong className="text-lg font-black text-amber-700">
                {closeSummary?.tardanzas ?? records.filter((r) => r.status === 'tardanza').length}
              </strong>
            </div>
            <div className="bg-white p-3 rounded-lg border border-red-200 text-center">
              <span className="text-[10px] font-bold text-red-700 uppercase block">Faltas</span>
              <strong className="text-lg font-black text-red-700">
                {closeSummary?.faltas ?? records.filter((r) => r.status === 'falta').length}
              </strong>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-200 text-center">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">Justificados</span>
              <strong className="text-lg font-black text-blue-700">
                {closeSummary?.justificados ?? records.filter((r) => r.status === 'justificado').length}
              </strong>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Expiradas</span>
              <strong className="text-lg font-black text-slate-700">
                {closeSummary?.solicitudes_expiradas ?? 0}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Alumnos de la Sección con su Estado Actual en la Sesión */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs uppercase font-bold text-slate-700 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#1F5FA8]" />
              Nómina de Estudiantes y Estado en la Sesión
            </h3>
            <span className="text-[11px] text-slate-500">
              Estudiantes matriculados activos con su registro actual de asistencia
            </span>
          </div>
          <span className="text-xs font-bold text-slate-700">
            {students.length} estudiante(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <th className="py-2.5 px-4">Código</th>
                <th className="py-2.5 px-4">Estudiante</th>
                <th className="py-2.5 px-4 text-center">Estado en Sesión</th>
                <th className="py-2.5 px-4 text-center">Método</th>
                <th className="py-2.5 px-4">Hora de Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                    No hay alumnos matriculados activos en esta sección.
                  </td>
                </tr>
              ) : (
                students.map((st) => {
                  const rec = studentRecordsMap[st.id];
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-600">
                        {st.code}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">
                        {st.last_names}, {st.first_names}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {rec ? (
                          <span
                            className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] uppercase border ${
                              rec.status === 'presente'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : rec.status === 'tardanza'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : rec.status === 'falta'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {rec.status === 'presente' && <Check className="w-3 h-3" />}
                            {rec.status === 'tardanza' && <Clock className="w-3 h-3" />}
                            {rec.status === 'falta' && <XCircle className="w-3 h-3" />}
                            {rec.status === 'justificado' && <HelpCircle className="w-3 h-3" />}
                            <span>{rec.status}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 border border-slate-200">
                            Sin registrar
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {rec ? (
                          <span className="font-mono text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {rec.method}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-[11px] text-slate-500 font-mono">
                        {rec?.registered_at ? formatTime(rec.registered_at) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diálogo Modal de Confirmación para Cerrar Asistencia */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <StopCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">¿Cerrar asistencia de la sesión?</h3>
                <span className="text-xs text-slate-500">Esta acción concluirá el registro</span>
              </div>
            </div>

            {/* Datos de balance */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between items-center pb-1 border-b border-slate-200/60">
                <span className="text-slate-600 font-medium">Tipo de sesión:</span>
                <span
                  className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] uppercase border ${
                    activeSession?.kind === 'practica'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                  }`}
                >
                  {activeSession?.kind === 'practica' ? (
                    <FlaskConical className="w-3 h-3 text-purple-600" />
                  ) : (
                    <BookOpen className="w-3 h-3 text-[#1F5FA8]" />
                  )}
                  <span>{activeSession?.kind === 'practica' ? 'Práctica' : 'Teoría'}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Matriculados activos:</span>
                <strong className="text-slate-900">{enrolledCount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Aprobados por QR:</span>
                <strong className="text-emerald-700">{approvedQrRecords.length}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Solicitudes pendientes:</span>
                <strong className="text-amber-700">{pendingRequestsList.length}</strong>
              </div>
            </div>

            {/* Advertencia obligatoria según requerimiento */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 leading-relaxed">
              <strong className="font-bold">Advertencia:</strong> Las solicitudes pendientes caducarán y los alumnos sin registro quedarán con falta.
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isClosing}
                onClick={() => setIsCloseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isClosing}
                onClick={handleConfirmCloseAttendance}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#C8102E] hover:bg-red-800 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isClosing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cerrando...</span>
                  </>
                ) : (
                  <span>Sí, cerrar asistencia</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
