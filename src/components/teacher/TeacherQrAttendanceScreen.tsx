import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  XCircle,
  HelpCircle,
  Calendar,
  Layers,
  BookOpen,
  FlaskConical,
  Edit3,
  X,
  Shield,
  Search,
  Filter,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getTeacherSections, getLateToleranceMinutes, TeacherSection } from '../../services/teacherService';
import { fetchProfilesMapByIds, ProfileBasicInfo } from '../../lib/profileHelper';
import { StudentAvatar } from '../StudentAvatar';
import { useStudentAvatarUrls } from '../../lib/avatarCache';
import { AttendanceStatusButtonGroup } from './AttendanceStatusButton';
import { ClassSession, AttendanceRecord, QrTokenPayload, CloseAttendanceResult, AttendanceStatus } from '../../types';
import {
  getTodayLima,
  formatDisplayDate,
  formatTime,
  formatLimaTime,
  calculateToleranceLimit
} from '../../lib/dateUtils';
import {
  translateOpenAttendanceError,
  translateCloseAttendanceError,
  translateAttendanceRpcError,
  translateSupabaseError
} from '../../lib/supabaseErrors';
import { getMethodLabel } from '../../lib/attendanceUtils';

interface TeacherQrAttendanceScreenProps {
  presetSectionId?: string;
}

interface ToastNotification {
  id: string;
  name: string;
  statusText: string;
  statusCode: string;
  time: string;
}

interface MergedStudentRow {
  student: ProfileBasicInfo;
  record?: AttendanceRecord;
  status: AttendanceStatus | 'sin_registrar';
  method: string | null;
  registered_at: string | null;
  justification: string | null;
}

// ==============================================================
// CONSTANTES DE ANIMACIÓN DEL MARCADOR VISUAL
// ==============================================================
const PIECE_MS = 400; // tiempo que dura cada pieza
const FADE_MS = 90;   // duración de la transición entre piezas (0 = corte seco)

export const TeacherQrAttendanceScreen: React.FC<TeacherQrAttendanceScreenProps> = ({
  presetSectionId,
}) => {
  const { user } = useAuth();
  const todayLima = getTodayLima();

  // Tolerancia de tardanza en minutos (de settings, default 10)
  const [toleranceMinutes, setToleranceMinutes] = useState<number>(10);

  const [isOpenAttendanceLoading, setIsOpenAttendanceLoading] = useState<boolean>(false);

  // Secciones y sesiones
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(presetSectionId || '');
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedKind, setSelectedKind] = useState<'all' | 'teoria' | 'practica'>('all');
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sesión activa y cálculo de tolerancia
  const activeSession = sessions.find((s) => s.id === selectedSessionId);
  const sessionTolerance = activeSession
    ? calculateToleranceLimit(activeSession.session_date, activeSession.starts_at, toleranceMinutes)
    : null;

  // Estado del QR y la sesión de asistencia
  const [isAttendanceOpen, setIsAttendanceOpen] = useState<boolean>(false);
  const [attendanceSessionId, setAttendanceSessionId] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(8);

  // Modo del marcador: 'animated' (Marcador animado v2 en 4 piezas) o 'simple' (QR simple v1)
  const [qrMode, setQrMode] = useState<'animated' | 'simple'>('animated');

  // Marcador Animado v2: contador de generación g (empieza en 1), 4 piezas con cruce dual-canvas
  const generationRef = useRef<number>(0);
  const [pieceIndex, setPieceIndex] = useState<number>(0);
  const pieceIndexRef = useRef<number>(0);
  const [activeCanvas, setActiveCanvas] = useState<'A' | 'B'>('A');
  const activeCanvasRef = useRef<'A' | 'B'>('A');
  const [isHardCut, setIsHardCut] = useState<boolean>(true);
  const isHardCutRef = useRef<boolean>(true);

  const [animatedDataUrls, setAnimatedDataUrls] = useState<string[]>([]);
  const [simpleDataUrl, setSimpleDataUrl] = useState<string | null>(null);
  const pieceTimerRef = useRef<any>(null);
  const canvasARef = useRef<HTMLCanvasElement | null>(null);
  const canvasBRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSimpleRef = useRef<HTMLCanvasElement | null>(null);
  const preloadedImagesRef = useRef<HTMLImageElement[]>([]);
  const [hasEscudoImg, setHasEscudoImg] = useState<boolean>(false);

  // Accesibilidad: detección de prefers-reduced-motion para corte seco (FADE_MS = 0)
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else if ((mq as any).addListener) {
      (mq as any).addListener(handler);
      return () => (mq as any).removeListener(handler);
    }
  }, []);

  const effectiveFadeMs = reducedMotion ? 0 : FADE_MS;

  // ==============================================================
  // ALUMNOS MATRICULADOS Y REGISTROS DE ASISTENCIA
  // ==============================================================
  const [enrolledStudents, setEnrolledStudents] = useState<ProfileBasicInfo[]>([]);
  const [loadingEnrolled, setLoadingEnrolled] = useState<boolean>(false);
  const enrolledStudentsRef = useRef<ProfileBasicInfo[]>([]);
  enrolledStudentsRef.current = enrolledStudents;

  // URLs firmadas de avatares en caché
  const avatarUrls = useStudentAvatarUrls(enrolledStudents);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // Seguimiento de estado previo para detectar cambios y animar
  const previousStatusMapRef = useRef<Record<string, string>>({});
  const isInitialLoadRef = useRef<boolean>(true);
  const [animatedStudentIds, setAnimatedStudentIds] = useState<Record<string, string>>({});
  const [savingStudentStatus, setSavingStudentStatus] = useState<Record<string, AttendanceStatus>>({});
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [recentScansCount, setRecentScansCount] = useState<number>(0);

  // Filtros del panel derecho
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus | 'sin_registrar'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'qr' | 'manual'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal para justificar falta
  const [justifyingStudent, setJustifyingStudent] = useState<{
    studentId: string;
    studentName: string;
    studentCode: string;
  } | null>(null);
  const [justificationInput, setJustificationInput] = useState<string>('');
  const [isSavingJustification, setIsSavingJustification] = useState<boolean>(false);
  const [justificationError, setJustificationError] = useState<string | null>(null);

  // Modal confirmación cierre
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [closeSummary, setCloseSummary] = useState<CloseAttendanceResult | null>(null);

  // Interval refs
  const qrIntervalRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const recordsIntervalRef = useRef<any>(null);
  const enrolledIntervalRef = useRef<any>(null);

  // 1. Cargar secciones del docente
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
      if (presetSectionId) {
        setSelectedSectionId(presetSectionId);
      } else if (teacherSecs.length > 0) {
        setSelectedSectionId(teacherSecs[0].id);
      }
    } catch (err: any) {
      setError(translateSupabaseError(err, 'sections'));
    } finally {
      setLoadingInitial(false);
    }
  }, [user, presetSectionId]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  // Cargar tolerancia de tardanza
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
      const { data, error: sErr } = await supabase
        .from('class_sessions')
        .select(`
          id,
          section_id,
          session_date,
          starts_at,
          ends_at,
          topic,
          status,
          kind
        `)
        .eq('section_id', selectedSectionId)
        .eq('session_date', todayLima)
        .is('archived_at', null)
        .order('starts_at', { ascending: true });

      if (sErr) throw sErr;

      const loaded = (data || []) as ClassSession[];
      setSessions(loaded);

      if (loaded.length > 0) {
        const openOrScheduled = loaded.find((s) => s.status === 'abierta' || s.status === 'programada');
        setSelectedSessionId(openOrScheduled ? openOrScheduled.id : loaded[0].id);
      } else {
        setSelectedSessionId('');
      }
    } catch (err: any) {
      setError(translateSupabaseError(err, 'class_sessions'));
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedSectionId, todayLima]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 3. Cargar Alumnos Matriculados de la Sección (se actualiza al abrir y cada 60s)
  const loadEnrolledStudents = useCallback(async () => {
    if (!selectedSectionId) {
      setEnrolledStudents([]);
      return;
    }

    setLoadingEnrolled(true);
    try {
      const supabase = getSupabaseClient();
      // Consulta enrollments activos sin created_at
      const { data: enrData, error: enrErr } = await supabase
        .from('enrollments')
        .select('student_id, section_id, status')
        .eq('section_id', selectedSectionId)
        .eq('status', 'activa');

      if (enrErr) throw enrErr;

      const ids = (enrData || []).map((e: any) => e.student_id);
      if (ids.length > 0) {
        // Consulta profiles con .in('id', ids) sin joins anidados
        const { data: profs, error: profErr } = await supabase
          .from('profiles')
          .select('id, code, first_names, last_names, avatar_updated_at')
          .in('id', ids);

        if (profErr) throw profErr;

        // Orden FIJO por apellidos ASC y luego nombres ASC
        const sorted = (profs || []).sort((a: any, b: any) => {
          const ln = (a.last_names || '').localeCompare(b.last_names || '');
          if (ln !== 0) return ln;
          return (a.first_names || '').localeCompare(b.first_names || '');
        });

        setEnrolledStudents(sorted);
      } else {
        setEnrolledStudents([]);
      }
    } catch (err: any) {
      // Ignorar errores transitorios
    } finally {
      setLoadingEnrolled(false);
    }
  }, [selectedSectionId]);

  useEffect(() => {
    loadEnrolledStudents();
    // Refresco cada 60 segundos
    if (enrolledIntervalRef.current) clearInterval(enrolledIntervalRef.current);
    enrolledIntervalRef.current = setInterval(() => {
      loadEnrolledStudents();
    }, 60000);

    return () => {
      if (enrolledIntervalRef.current) clearInterval(enrolledIntervalRef.current);
    };
  }, [loadEnrolledStudents]);

  // 4. Polling Liviano: Consultar attendance_records cada 3 segundos
  const fetchSessionRecords = useCallback(async () => {
    if (!selectedSessionId) {
      setRecords([]);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error: recErr } = await supabase
        .from('attendance_records')
        .select('id, class_session_id, student_id, status, method, justification, registered_at')
        .eq('class_session_id', selectedSessionId);

      if (!recErr && data) {
        const fetchedRecords = data as AttendanceRecord[];
        setRecords(fetchedRecords);

        // Mapear nuevo estado por alumno
        const newRecordMap: Record<string, AttendanceRecord> = {};
        fetchedRecords.forEach((r) => {
          newRecordMap[r.student_id] = r;
        });

        // Comprobar cambios si ya no es la carga inicial
        if (!isInitialLoadRef.current) {
          const changed: Record<string, string> = {};
          const newToasts: ToastNotification[] = [];

          enrolledStudentsRef.current.forEach((st) => {
            const prevStatus = previousStatusMapRef.current[st.id] || 'sin_registrar';
            const currStatus = newRecordMap[st.id]?.status || 'sin_registrar';

            if (prevStatus !== currStatus) {
              changed[st.id] = currStatus;

              const statusLabels: Record<string, string> = {
                presente: 'Presente',
                tardanza: 'Tardanza',
                falta: 'Falta',
                justificado: 'Justificado',
                sin_registrar: 'Sin registrar',
              };

              newToasts.push({
                id: `${st.id}-${Date.now()}-${Math.random()}`,
                name: `${st.first_names} ${st.last_names}`,
                statusText: statusLabels[currStatus] || currStatus,
                statusCode: currStatus,
                time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              });
            }
          });

          if (Object.keys(changed).length > 0) {
            // Activar animación en las filas correspondientes
            setAnimatedStudentIds((prev) => ({ ...prev, ...changed }));
            setRecentScansCount((c) => c + Object.keys(changed).length);

            // Desvanecer animación tras 1.5s
            setTimeout(() => {
              setAnimatedStudentIds((prev) => {
                const next = { ...prev };
                Object.keys(changed).forEach((id) => delete next[id]);
                return next;
              });
            }, 1500);

            // Agregar toasts auto-descartables
            if (newToasts.length > 0) {
              setToasts((prev) => [...prev, ...newToasts]);
              newToasts.forEach((nt) => {
                setTimeout(() => {
                  setToasts((curr) => curr.filter((t) => t.id !== nt.id));
                }, 3500);
              });
            }
          }
        } else {
          // Primera carga: NO animar nada
          isInitialLoadRef.current = false;
        }

        // Actualizar el mapa de estados previos
        const nextMap: Record<string, string> = {};
        enrolledStudentsRef.current.forEach((st) => {
          nextMap[st.id] = newRecordMap[st.id]?.status || 'sin_registrar';
        });
        previousStatusMapRef.current = nextMap;
      }
    } catch {
      // Ignorar errores transitorios de polling
    }
  }, [selectedSessionId]);

  // Reset initial load flag al cambiar de sesión
  useEffect(() => {
    isInitialLoadRef.current = true;
    previousStatusMapRef.current = {};
    setAnimatedStudentIds({});
    setToasts([]);
    setRecentScansCount(0);
  }, [selectedSessionId]);

  // Polling de 3 segundos para attendance_records
  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionRecords();
      if (recordsIntervalRef.current) clearInterval(recordsIntervalRef.current);
      recordsIntervalRef.current = setInterval(() => {
        fetchSessionRecords();
      }, 3000);
    } else {
      if (recordsIntervalRef.current) clearInterval(recordsIntervalRef.current);
    }

    return () => {
      if (recordsIntervalRef.current) clearInterval(recordsIntervalRef.current);
    };
  }, [selectedSessionId, fetchSessionRecords]);

  // 5. Verificar estado de la sesión cada 5 segundos
  const checkCurrentSessionStatus = useCallback(async () => {
    if (!selectedSessionId) {
      setIsAttendanceOpen(false);
      setAttendanceSessionId(null);
      setAnimatedDataUrls([]);
      setSimpleDataUrl(null);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: classSess } = await supabase
        .from('class_sessions')
        .select('id, status')
        .eq('id', selectedSessionId)
        .single();

      // Consulta GET attendance_sessions?select=status&class_session_id=eq.<id>
      const { data: attSess } = await supabase
        .from('attendance_sessions')
        .select('id, status')
        .eq('class_session_id', selectedSessionId)
        .order('opened_at', { ascending: false })
        .limit(1);

      if (attSess && attSess.length > 0) {
        const latest = attSess[0];
        setAttendanceSessionId(latest.id);
        const isOpen = latest.status === 'abierta' && classSess?.status === 'abierta';
        setIsAttendanceOpen(isOpen);
      } else {
        setIsAttendanceOpen(false);
        setAttendanceSessionId(null);
      }
    } catch {
      // Ignorar errores transitorios de polling
    }
  }, [selectedSessionId]);

  useEffect(() => {
    checkCurrentSessionStatus();
    const interval = setInterval(checkCurrentSessionStatus, 5000);
    return () => clearInterval(interval);
  }, [checkCurrentSessionStatus]);

  // Comprobar escudo.png
  useEffect(() => {
    const img = new Image();
    img.onload = () => setHasEscudoImg(true);
    img.onerror = () => setHasEscudoImg(false);
    img.src = '/escudo.png';
  }, []);

  // 6. Generación del Token QR (rotación cada 8s con marcador animado v2 en rojo #9B0D20)
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
        if (payload.sid && payload.sid !== attendanceSessionId) {
          setAttendanceSessionId(payload.sid);
        }

        setQrError(null);
        generationRef.current += 1;
        const currentG = generationRef.current;

        const rawTok = String(payload.tok || '');
        const sidStr = String(payload.sid || '');

        const p0 = rawTok.slice(0, 16);
        const p1 = rawTok.slice(16, 32);
        const p2 = rawTok.slice(32, 48);
        const p3 = rawTok.slice(48, 64);
        const pieces = [p0, p1, p2, p3];

        const v2Texts = pieces.map(
          (piece, i) => `{"v":2,"sid":"${sidStr}","g":${currentG},"n":4,"i":${i},"p":"${piece}"}`
        );

        const v2Urls = await Promise.all(
          v2Texts.map((text) =>
            QRCode.toDataURL(text, {
              width: 340,
              margin: 4,
              errorCorrectionLevel: 'M',
              color: {
                dark: '#9B0D20',
                light: '#FFFFFF',
              },
            })
          )
        );
        // Preload de imágenes para dibujo instantáneo sin latencia
        const preloaded = v2Urls.map((url) => {
          const img = new Image();
          img.src = url;
          return img;
        });
        preloadedImagesRef.current = preloaded;

        setAnimatedDataUrls(v2Urls);

        // Nuevo token: reinicio inmediato en pieza 0 con corte seco (sin transición)
        pieceIndexRef.current = 0;
        activeCanvasRef.current = 'A';
        isHardCutRef.current = true;
        setPieceIndex(0);
        setActiveCanvas('A');
        setIsHardCut(true);

        // Dibujar inmediatamente la pieza 0 en Canvas A
        const canvasA = canvasARef.current;
        if (canvasA && preloaded[0]) {
          const drawP0 = () => {
            const ctxA = canvasA.getContext('2d');
            if (ctxA) {
              ctxA.clearRect(0, 0, canvasA.width, canvasA.height);
              ctxA.drawImage(preloaded[0], 0, 0, canvasA.width, canvasA.height);
            }
          };
          if (preloaded[0].complete && preloaded[0].naturalWidth > 0) {
            drawP0();
          } else {
            preloaded[0].onload = drawP0;
          }
        }

        // Limpiar Canvas B para evitar mezcla de piezas
        const canvasB = canvasBRef.current;
        if (canvasB) {
          const ctxB = canvasB.getContext('2d');
          if (ctxB) ctxB.clearRect(0, 0, canvasB.width, canvasB.height);
        }

        const v1Text = `{"v":1,"sid":"${sidStr}","tok":"${rawTok}","exp":${payload.exp ?? 0}}`;
        const v1Url = await QRCode.toDataURL(v1Text, {
          width: 340,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#9B0D20',
            light: '#FFFFFF',
          },
        });
        setSimpleDataUrl(v1Url);
        setCountdown(8);

        // Reiniciar el temporizador de piezas alineado con el nuevo token
        if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
        if (qrMode === 'animated') {
          startPieceRotationTimer();
        }
      } else {
        const errCode = payload?.code || 'error';
        setQrError(`El servidor no pudo generar el código QR: ${errCode}`);
        setAnimatedDataUrls([]);
        setSimpleDataUrl(null);
        if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
      }
    } catch (err: any) {
      setQrError(err.message || 'Error de conexión al generar el código QR.');
      setAnimatedDataUrls([]);
      setSimpleDataUrl(null);
    }
  }, [selectedSessionId, isAttendanceOpen, attendanceSessionId, qrMode]);

  // Temporizador de rotación de piezas dual-canvas gobernado por PIECE_MS
  const startPieceRotationTimer = useCallback(() => {
    if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);

    pieceTimerRef.current = setInterval(() => {
      const imgs = preloadedImagesRef.current;
      if (!imgs || imgs.length < 4) return;

      const currentIdx = pieceIndexRef.current;
      const nextIdx = (currentIdx + 1) % 4;
      const nextCanvas = activeCanvasRef.current === 'A' ? 'B' : 'A';
      const targetCanvasEl = nextCanvas === 'B' ? canvasBRef.current : canvasARef.current;

      // Dibujar la siguiente pieza en el canvas actualmente oculto (opacidad 0)
      if (targetCanvasEl && imgs[nextIdx]) {
        const ctx = targetCanvasEl.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, targetCanvasEl.width, targetCanvasEl.height);
          ctx.drawImage(imgs[nextIdx], 0, 0, targetCanvasEl.width, targetCanvasEl.height);
        }
      }

      // Conmutar canvas para iniciar cruce de opacidad linear de FADE_MS ms
      pieceIndexRef.current = nextIdx;
      activeCanvasRef.current = nextCanvas;
      isHardCutRef.current = false;
      setIsHardCut(false);
      setActiveCanvas(nextCanvas);
      setPieceIndex(nextIdx);
    }, PIECE_MS);
  }, []);

  // Control del ciclo de piezas según estado de apertura y modo
  useEffect(() => {
    if (isAttendanceOpen && qrMode === 'animated' && animatedDataUrls.length === 4) {
      startPieceRotationTimer();
    } else {
      if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
    }

    return () => {
      if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
    };
  }, [isAttendanceOpen, qrMode, animatedDataUrls.length, startPieceRotationTimer]);

  // Dibujo en Canvas del QR simple cuando está en modo 'simple'
  useEffect(() => {
    if (qrMode === 'simple' && simpleDataUrl && canvasSimpleRef.current) {
      const canvas = canvasSimpleRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = simpleDataUrl;
    }
  }, [qrMode, simpleDataUrl]);

  // Asegurar que el canvas activo tenga la pieza dibujada si cambia de modo o monta
  useEffect(() => {
    if (qrMode === 'animated' && preloadedImagesRef.current[pieceIndex]) {
      const currentCanvas = activeCanvas === 'A' ? canvasARef.current : canvasBRef.current;
      const img = preloadedImagesRef.current[pieceIndex];
      if (currentCanvas && img) {
        const ctx = currentCanvas.getContext('2d');
        if (ctx) {
          if (img.complete && img.naturalWidth > 0) {
            ctx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
            ctx.drawImage(img, 0, 0, currentCanvas.width, currentCanvas.height);
          } else {
            img.onload = () => {
              ctx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
              ctx.drawImage(img, 0, 0, currentCanvas.width, currentCanvas.height);
            };
          }
        }
      }
    }
  }, [qrMode, animatedDataUrls, pieceIndex, activeCanvas]);

  // Timer de 8s para regenerar token
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
      if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
      setAnimatedDataUrls([]);
      setSimpleDataUrl(null);
      setPieceIndex(0);
      pieceIndexRef.current = 0;
      activeCanvasRef.current = 'A';
      setActiveCanvas('A');
      isHardCutRef.current = true;
      setIsHardCut(true);
      preloadedImagesRef.current = [];
      generationRef.current = 0;
    }

    return () => {
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
    };
  }, [isAttendanceOpen, fetchNewQrToken]);

  // 7. Abrir Asistencia
  const handleOpenAttendance = async () => {
    if (!selectedSessionId) return;
    setError(null);
    setCloseSummary(null);
    setIsOpenAttendanceLoading(true);

    if (activeSession?.status === 'abierta') {
      setIsAttendanceOpen(true);
      setIsOpenAttendanceLoading(false);
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
        setSessions((prev) =>
          prev.map((s) => (s.id === selectedSessionId ? { ...s, status: 'abierta' } : s))
        );

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
    } finally {
      setIsOpenAttendanceLoading(false);
    }
  };

  // 8. Corregir Asistencia (set_attendance)
  const handleDirectSetAttendance = async (
    studentId: string,
    newStatus: AttendanceStatus,
    justification?: string | null
  ) => {
    if (!selectedSessionId) return;
    setError(null);
    setSavingStudentStatus((prev) => ({ ...prev, [studentId]: newStatus }));

    try {
      const supabase = getSupabaseClient();
      const { data: res, error: rpcErr } = await supabase.rpc('set_attendance', {
        p_class_session: selectedSessionId,
        p_student: studentId,
        p_status: newStatus,
        p_justification: justification || null,
      });

      if (rpcErr) throw rpcErr;

      const code = typeof res === 'string' ? res : res?.code;
      if (code === 'success') {
        // Animar fila
        setAnimatedStudentIds((prev) => ({ ...prev, [studentId]: newStatus }));
        setTimeout(() => {
          setAnimatedStudentIds((prev) => {
            const next = { ...prev };
            delete next[studentId];
            return next;
          });
        }, 1500);

        // Recargar registros
        await fetchSessionRecords();
      } else {
        setError(translateAttendanceRpcError(code));
      }
    } catch (err: any) {
      setError(translateSupabaseError(err));
    } finally {
      setSavingStudentStatus((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  };

  const handleSaveJustification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justifyingStudent || !selectedSessionId) return;

    const studentId = justifyingStudent.studentId;
    setIsSavingJustification(true);
    setJustificationError(null);
    setSavingStudentStatus((prev) => ({ ...prev, [studentId]: 'justificado' }));

    try {
      const supabase = getSupabaseClient();
      const { data: res, error: rpcErr } = await supabase.rpc('set_attendance', {
        p_class_session: selectedSessionId,
        p_student: studentId,
        p_status: 'justificado',
        p_justification: justificationInput.trim() || null,
      });

      if (rpcErr) throw rpcErr;

      const code = typeof res === 'string' ? res : res?.code;
      if (code === 'success') {
        setAnimatedStudentIds((prev) => ({ ...prev, [studentId]: 'justificado' }));
        setTimeout(() => {
          setAnimatedStudentIds((prev) => {
            const next = { ...prev };
            delete next[studentId];
            return next;
          });
        }, 1500);

        setJustifyingStudent(null);
        setJustificationInput('');
        await fetchSessionRecords();
      } else {
        setJustificationError(translateAttendanceRpcError(code));
      }
    } catch (err: any) {
      setJustificationError(translateSupabaseError(err));
    } finally {
      setIsSavingJustification(false);
      setSavingStudentStatus((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  };

  // 9. Cerrar Asistencia (close_attendance)
  const handleConfirmCloseAttendance = async () => {
    if (!selectedSessionId) return;
    setIsClosing(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data: res, error: rpcErr } = await supabase.rpc('close_attendance', {
        p_class_session: selectedSessionId,
      });

      if (rpcErr) throw rpcErr;

      const summary = res as CloseAttendanceResult;

      if (summary && summary.code === 'success') {
        setCloseSummary(summary);
        setIsAttendanceOpen(false);
        setIsCloseModalOpen(false);
        setSessions((prev) =>
          prev.map((s) => (s.id === selectedSessionId ? { ...s, status: 'cerrada' } : s))
        );

        // Detener polling después del cierre
        if (recordsIntervalRef.current) clearInterval(recordsIntervalRef.current);

        // Recargar de inmediato: alumnos sin registro pasarán a falta en rojo con animación
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

  // ==============================================================
  // COMBINACIÓN: ENROLLED STUDENTS + ATTENDANCE RECORDS
  // ==============================================================
  const recordsByStudentId = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    records.forEach((r) => {
      map[r.student_id] = r;
    });
    return map;
  }, [records]);

  // Lista unificada ordenada de manera fija por apellidos y nombres
  const allMergedStudents: MergedStudentRow[] = useMemo(() => {
    return enrolledStudents.map((st) => {
      const rec = recordsByStudentId[st.id];
      if (rec) {
        return {
          student: st,
          record: rec,
          status: rec.status,
          method: rec.method || null,
          registered_at: rec.registered_at || null,
          justification: rec.justification || null,
        };
      }
      return {
        student: st,
        record: undefined,
        status: 'sin_registrar',
        method: null,
        registered_at: null,
        justification: null,
      };
    });
  }, [enrolledStudents, recordsByStudentId]);

  // Contadores en vivo para la cabecera
  const countMatriculados = enrolledStudents.length;
  const countPresentes = allMergedStudents.filter((s) => s.status === 'presente').length;
  const countTardanzas = allMergedStudents.filter((s) => s.status === 'tardanza').length;
  const countFaltas = allMergedStudents.filter((s) => s.status === 'falta').length;
  const countSinRegistrar = allMergedStudents.filter((s) => s.status === 'sin_registrar').length;

  // Filtrado de la lista para el panel
  const filteredStudents = useMemo(() => {
    return allMergedStudents.filter((row) => {
      // Filtro por Estado
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }

      // Filtro por Método
      if (methodFilter !== 'all') {
        if (!row.method) return false;
        if (row.method.toLowerCase() !== methodFilter) return false;
      }

      // Filtro por Búsqueda (código, nombres, apellidos)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const code = (row.student.code || '').toLowerCase();
        const names = `${row.student.first_names || ''} ${row.student.last_names || ''}`.toLowerCase();
        if (!code.includes(q) && !names.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allMergedStudents, statusFilter, methodFilter, searchQuery]);

  // ==============================================================
  // RENDER: PANEL IZQUIERDO MARCADOR / QR
  // ==============================================================
  const renderQrPanel = () => {
    if (isAttendanceOpen) {
      return (
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col items-center justify-between text-center relative overflow-hidden">
          {/* Cabecera del Marcador con Switch de Modos */}
          <div className="w-full space-y-3 pb-3 border-b border-slate-100 mb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-slate-800 flex items-center gap-1.5 tracking-wide">
                <Shield className="w-4 h-4 text-[#C8102E]" />
                <span>MARCADOR ANIMADO UCV</span>
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#C8102E] bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5 text-[#C8102E]" />
                <span>Renovación: {countdown}s</span>
              </div>
            </div>

            {/* Selector de dos botones */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl">
              <button
                type="button"
                onClick={() => setQrMode('animated')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  qrMode === 'animated'
                    ? 'bg-[#C8102E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Marcador animado
              </button>
              <button
                type="button"
                onClick={() => setQrMode('simple')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  qrMode === 'simple'
                    ? 'bg-[#C8102E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                QR simple
              </button>
            </div>
          </div>

          {/* Canvas y Escudo Animado */}
          {qrMode === 'animated' ? (
            <div className="w-full flex justify-center my-2">
              <svg
                viewBox="0 0 400 500"
                className="w-full max-w-[480px] sm:max-w-[520px] md:max-w-[560px] h-auto select-none"
              >
                <defs>
                  {/* Sombra suave estática del escudo de color #C8102E */}
                  <filter id="shieldShadow" x="-15%" y="-10%" width="130%" height="130%">
                    <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#C8102E" floodOpacity="0.35" />
                  </filter>

                  {/* 1. Degradado vertical del escudo de #D9213B a #8A0A1C */}
                  <linearGradient id="shieldRedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D9213B" />
                    <stop offset="100%" stopColor="#8A0A1C" />
                  </linearGradient>

                  {/* 2. Brillo superior blanco con degradado de opacidad .22 a 0 */}
                  <linearGradient id="shieldGlossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.22" />
                  </linearGradient>

                  {/* ClipPath con el mismo path del escudo */}
                  <clipPath id="shieldPathClip">
                    <path d="M20 20H380V250C380 360 290 430 200 470C110 430 20 360 20 250Z" />
                  </clipPath>

                  {/* ClipPath para redondear la barra de progreso */}
                  <clipPath id="tokenBarClip">
                    <rect x="90" y="40" width="220" height="16" rx="8" />
                  </clipPath>
                </defs>

                {/* 1. Escudo: degradado vertical, borde #6E0A17 de 3px y sombra estática */}
                <path
                  d="M20 20H380V250C380 360 290 430 200 470C110 430 20 360 20 250Z"
                  fill="url(#shieldRedGrad)"
                  stroke="#6E0A17"
                  strokeWidth="3"
                  filter="url(#shieldShadow)"
                />

                {/* 2. Brillo superior: rectángulo con degradado recortado por el escudo */}
                <rect
                  x="20"
                  y="20"
                  width="360"
                  height="150"
                  fill="url(#shieldGlossGrad)"
                  clipPath="url(#shieldPathClip)"
                  pointerEvents="none"
                />

                {/* 3. Borde interior dorado: trazo #F4C542 con opacidad .55 y 1.5 px */}
                <path
                  d="M32 32H368V250C368 352 283 418 200 456C117 418 32 352 32 250Z"
                  fill="none"
                  stroke="#F4C542"
                  strokeOpacity="0.55"
                  strokeWidth="1.5"
                  pointerEvents="none"
                />

                {/* 4. Barra del token (arriba): rect rx=8 fondo #5A0612, progreso #F5A623 y texto */}
                <g>
                  <rect x="90" y="40" width="220" height="16" rx="8" fill="#5A0612" />
                  <rect
                    x="90"
                    y="40"
                    width={Math.max(0, Math.min(220, (countdown / 8) * 220))}
                    height="16"
                    fill="#F5A623"
                    clipPath="url(#tokenBarClip)"
                    style={{ transition: 'width 1s linear' }}
                  />
                  <text
                    x="200"
                    y="48"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#FFFFFF"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                  >
                    {countdown} s
                  </text>
                </g>

                {/* 5. Panel del QR: rect blanco puro rx=18 en x=70, y=72, ancho 260, alto 260 */}
                <rect x="70" y="72" width="260" height="260" rx="18" fill="#FFFFFF" />

                {/* Dual canvas apilados A y B dentro del panel blanco (área x=82..318, y=84..320) */}
                <foreignObject x="82" y="84" width="236" height="236">
                  <div
                    style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
                  >
                    <canvas
                      ref={canvasARef}
                      width={320}
                      height={320}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        opacity: activeCanvas === 'A' ? 1 : 0,
                        transition: isHardCut ? 'none' : `opacity ${effectiveFadeMs}ms linear`,
                      }}
                    />
                    <canvas
                      ref={canvasBRef}
                      width={320}
                      height={320}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        opacity: activeCanvas === 'B' ? 1 : 0,
                        transition: isHardCut ? 'none' : `opacity ${effectiveFadeMs}ms linear`,
                      }}
                    />
                  </div>
                </foreignObject>

                {/* 6. Indicadores de pieza (abajo): 4 círculos centrados en x=200, y=362 */}
                <g>
                  {[0, 1, 2, 3].map((idx) => {
                    const cx = 140 + idx * 40;
                    const cy = 362;
                    const r = 14;
                    const isCurrent = pieceIndex === idx;

                    return (
                      <g key={idx}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={isCurrent ? '#FFFFFF' : '#4A050E'}
                          stroke={isCurrent ? '#F5A623' : '#7A0A18'}
                          strokeWidth="2"
                        />
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={isCurrent ? '#C8102E' : '#FFFFFF'}
                          fontSize="11"
                          fontWeight="bold"
                          fontFamily="ui-sans-serif, system-ui, sans-serif"
                        >
                          {idx + 1}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* 7. Insignia inferior en la punta del escudo: centrado en x=200, y=424 */}
                <g>
                  <circle
                    cx="200"
                    cy="424"
                    r="19"
                    fill="#4A050E"
                    stroke="#F4C542"
                    strokeWidth="2"
                  />
                  <text
                    x="200"
                    y="424"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#F4C542"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    letterSpacing="0.5"
                  >
                    GO
                  </text>
                </g>
              </svg>
            </div>
          ) : (
            <div className="relative mx-auto my-3 w-[340px] max-w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col items-center">
              <div className="w-[300px] h-[300px] sm:w-[320px] sm:h-[320px] bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                <canvas
                  ref={canvasSimpleRef}
                  width={320}
                  height={320}
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <div className="mt-3 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wide">
                Código QR Estático · Expira en {countdown}s
              </div>
            </div>
          )}

          <div className="mt-3 text-center">
            <p className="text-xs sm:text-sm font-bold text-slate-800">
              Apunta la cámara al escudo y mantenla 2 segundos
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Marcador dinámico sincronizado en 4 fases · Pieza {pieceIndex + 1} de 4
            </p>
          </div>
        </div>
      );
    }

    // Cuando la asistencia aún no está abierta
    return (
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-8 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1F5FA8]">
          <QrCode className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Asistencia no iniciada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs font-medium">
            Abre la asistencia QR para proyectar el marcador animado a los estudiantes y registrar su asistencia en vivo.
          </p>
        </div>
        {activeSession && activeSession.status !== 'cerrada' && activeSession.status !== 'cancelada' && (
          <button
            type="button"
            onClick={handleOpenAttendance}
            disabled={isOpenAttendanceLoading}
            className="px-5 py-2.5 rounded-xl bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all"
          >
            {isOpenAttendanceLoading ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Play className="w-4 h-4 fill-white" />}
            <span>{isOpenAttendanceLoading ? 'Iniciando...' : 'Iniciar toma de asistencia'}</span>
          </button>
        )}
      </div>
    );
  };

  // ==============================================================
  // RENDER: PANEL DERECHO LISTA COMPLETA REUTILIZABLE
  // ==============================================================
  const renderStudentListPanel = () => {
    return (
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col space-y-4">
        {/* Cabecera del panel con Contadores en Vivo y Franja de Tolerancia */}
        <div className="space-y-3 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1F5FA8]" />
                <span>Lista Completa de Alumnos ({countMatriculados})</span>
              </h3>
              {sessionTolerance && (
                <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1.5 mt-1.5">
                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>Inicio {sessionTolerance.startTimeStr} · tolerancia hasta {sessionTolerance.limitTimeStr}</span>
                </div>
              )}
            </div>

            {recentScansCount > 0 && (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full animate-pulse self-start sm:self-auto">
                +{recentScansCount} nuevo(s) escaneo(s)
              </span>
            )}
          </div>

          {/* Contadores en vivo */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Matriculados</span>
              <span className="text-base font-black text-slate-800 font-mono">{countMatriculados}</span>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-emerald-700">
              <span className="text-[10px] font-bold uppercase block">Presentes</span>
              <span className="text-base font-black font-mono">{countPresentes}</span>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center text-amber-700">
              <span className="text-[10px] font-bold uppercase block">Tardanzas</span>
              <span className="text-base font-black font-mono">{countTardanzas}</span>
            </div>
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-center text-red-700">
              <span className="text-[10px] font-bold uppercase block">Faltas</span>
              <span className="text-base font-black font-mono">{countFaltas}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-600">
              <span className="text-[10px] font-bold uppercase block">Sin registrar</span>
              <span className="text-base font-black font-mono">{countSinRegistrar}</span>
            </div>
          </div>
        </div>

        {/* Filtros y Buscador */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
          {/* Buscador */}
          <div className="sm:col-span-5 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar código o nombre..."
              className="w-full pl-8 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] focus:ring-2 focus:ring-[#1F5FA8]/20 transition-all outline-none text-slate-800"
            />
          </div>

          {/* Filtro por Estado */}
          <div className="sm:col-span-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-2.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none text-slate-700 cursor-pointer"
            >
              <option value="all">Estado: Todos ({countMatriculados})</option>
              <option value="presente">Presente ({countPresentes})</option>
              <option value="tardanza">Tardanza ({countTardanzas})</option>
              <option value="falta">Falta ({countFaltas})</option>
              <option value="justificado">Justificado ({allMergedStudents.filter(s => s.status === 'justificado').length})</option>
              <option value="sin_registrar">Sin registrar ({countSinRegistrar})</option>
            </select>
          </div>

          {/* Filtro por Método */}
          <div className="sm:col-span-3">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              className="w-full px-2.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none text-slate-700 cursor-pointer"
            >
              <option value="all">Método: Todos</option>
              <option value="qr">Código QR</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>

        {/* LISTA COMPLETA DE ALUMNOS (FILAS CON ORDEN FIJO POR APELLIDOS Y NOMBRES) */}
        <div className="flex-1 overflow-y-auto max-h-[520px] space-y-2.5 pr-1">
          {loadingEnrolled ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-[#1F5FA8] mb-2" />
              <span className="text-xs font-mono">Cargando alumnos de la sesión...</span>
            </div>
          ) : countMatriculados === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
              <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">
                Este curso no tiene alumnos matriculados. Pide al administrador que los matricule.
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-600">
                No se encontraron alumnos con los filtros seleccionados.
              </p>
            </div>
          ) : (
            filteredStudents.map((row) => {
              const st = row.student;
              const isAnimated = Boolean(animatedStudentIds[st.id]);
              const animatedNewStatus = animatedStudentIds[st.id] || row.status;

              const isPresente = row.status === 'presente';
              const isTardanza = row.status === 'tardanza';
              const isFalta = row.status === 'falta';
              const isJustificado = row.status === 'justificado';
              const isSinRegistrar = row.status === 'sin_registrar';

              // Clases de resaltado durante la animación de 1.5s
              let flashClass = '';
              if (isAnimated) {
                if (animatedNewStatus === 'presente') flashClass = 'flash-presente';
                else if (animatedNewStatus === 'tardanza') flashClass = 'flash-tardanza';
                else if (animatedNewStatus === 'falta') flashClass = 'flash-falta';
                else if (animatedNewStatus === 'justificado') flashClass = 'flash-justificado';
              }

              return (
                <div
                  key={st.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isAnimated
                      ? `${flashClass} shadow-md`
                      : isSinRegistrar
                      ? 'bg-white border-slate-200 hover:bg-slate-50/80 shadow-2xs'
                      : isPresente
                      ? 'bg-emerald-50/60 border-emerald-200 shadow-2xs'
                      : isTardanza
                      ? 'bg-amber-50/60 border-amber-200 shadow-2xs'
                      : isFalta
                      ? 'bg-red-50/60 border-red-200 shadow-2xs'
                      : 'bg-slate-100/60 border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Indicador circular: Foto de perfil del alumno con anillo de estado e insignia */}
                    <StudentAvatar
                      student={st}
                      status={row.status}
                      signedUrl={avatarUrls[st.id]}
                      isAnimated={isAnimated}
                    />

                    {/* Código y Nombre Completo */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          {st.code}
                        </span>
                        <strong className="text-xs font-bold text-slate-900 truncate">
                          {st.last_names}, {st.first_names}
                        </strong>
                      </div>

                      {/* Metadatos: Estado en texto, Método, Hora de registro */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        {/* Estado en Texto */}
                        <span
                          className={`font-bold ${
                            isPresente
                              ? 'text-emerald-700'
                              : isTardanza
                              ? 'text-amber-700'
                              : isFalta
                              ? 'text-red-700'
                              : isJustificado
                              ? 'text-slate-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {isPresente
                            ? 'Presente'
                            : isTardanza
                            ? 'Tardanza'
                            : isFalta
                            ? 'Falta'
                            : isJustificado
                            ? 'Justificado'
                            : 'Sin registrar'}
                        </span>

                        <span className="text-slate-300">•</span>

                        {/* Método */}
                        <span className="text-slate-600 flex items-center gap-1 font-medium">
                          {row.method ? (
                            <>
                              {row.method.toLowerCase() === 'qr' && (
                                <QrCode className="w-3 h-3 text-[#1F5FA8]" />
                              )}
                              <span>{getMethodLabel(row.method)}</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </span>

                        <span className="text-slate-300">•</span>

                        {/* Hora de registro en hora de Lima */}
                        <span className="text-slate-500 font-mono">
                          {row.registered_at ? formatLimaTime(row.registered_at) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de Corrección Rápida (Gris por defecto, activo con color sólido) */}
                  <AttendanceStatusButtonGroup
                    currentStatus={row.status}
                    savingStatus={savingStudentStatus[st.id]}
                    isAnimated={isAnimated}
                    size="sm"
                    className="self-end sm:self-auto pt-1 sm:pt-0"
                    onSelectStatus={(status) => handleDirectSetAttendance(st.id, status)}
                    onJustifyClick={() => {
                      setJustifyingStudent({
                        studentId: st.id,
                        studentName: `${st.last_names}, ${st.first_names}`,
                        studentCode: st.code,
                      });
                      setJustificationInput(row.justification || '');
                      setJustificationError(null);
                    }}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Contenedor de Toasts Flotantes */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  t.statusCode === 'presente'
                    ? 'bg-emerald-100 text-emerald-700'
                    : t.statusCode === 'tardanza'
                    ? 'bg-amber-100 text-amber-800'
                    : t.statusCode === 'falta'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {t.statusCode === 'presente' ? '✓' : t.statusCode === 'tardanza' ? '⏱' : t.statusCode === 'falta' ? '✕' : 'J'}
              </span>
              <div>
                <p className="text-xs font-bold text-slate-800 leading-tight">{t.name}</p>
                <p className="text-[11px] font-semibold text-slate-500">
                  Marcó: <span className="font-bold text-slate-800">{t.statusText}</span> · {t.time}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-800">Error en Asistencia</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Selectores de Sesión de HOY (solo visible si no está fija) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs uppercase font-bold text-slate-700 tracking-wider">
              Sesión de Hoy ({formatDisplayDate(todayLima)})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadSessions();
                loadEnrolledStudents();
                fetchSessionRecords();
              }}
              disabled={loadingSessions || loadingEnrolled}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(loadingSessions || loadingEnrolled) ? 'animate-spin text-[#1F5FA8]' : ''}`} />
              <span>Actualizar datos</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Selector de Sesión de HOY */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Sesión programada para hoy:
            </label>
            <select
              value={selectedSessionId}
              disabled={isAttendanceOpen}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none text-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {sessions.length === 0 ? (
                <option value="">No hay sesiones programadas para hoy</option>
              ) : (
                sessions.map((sess) => {
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

          {/* Ficha rápida de estado */}
          {activeSession && (
            <div className="flex flex-col justify-center bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Estado de la sesión:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    activeSession.status === 'abierta'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : activeSession.status === 'cerrada'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                  }`}
                >
                  {activeSession.status}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-slate-500 font-medium text-[11px]">
                <span>Horario: {activeSession.starts_at?.slice(0, 5)} - {activeSession.ends_at?.slice(0, 5)}</span>
                <span>{activeSession.kind === 'practica' ? 'Práctica' : 'Teoría'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controles de Apertura / Cierre para Marcador / QR */}
      {activeSession && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-3.5 h-3.5 rounded-full ${
                isAttendanceOpen ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-400/20' : 'bg-slate-300'
              }`}
            />
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {isAttendanceOpen ? 'Asistencia en Curso (Código QR Activo)' : 'Asistencia Detenida'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isAttendanceOpen
                  ? 'El código QR rota cada 8 segundos. Los registros por QR actualizan la lista en vivo.'
                  : activeSession.status === 'cerrada'
                  ? 'Esta sesión ya fue cerrada. El resumen de asistencia se muestra abajo.'
                  : 'Presione el botón para abrir la toma de asistencia y mostrar el código QR.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isAttendanceOpen && activeSession.status !== 'cerrada' && activeSession.status !== 'cancelada' && (
              <button
                type="button"
                onClick={handleOpenAttendance}
                disabled={isOpenAttendanceLoading}
                className="px-5 py-2.5 rounded-xl bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all disabled:opacity-50"
              >
                {isOpenAttendanceLoading ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Play className="w-4 h-4 fill-white" />}
                <span>{isOpenAttendanceLoading ? 'Abriendo...' : 'Abrir Asistencia QR'}</span>
              </button>
            )}

            {isAttendanceOpen && (
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-[#C8102E] hover:bg-red-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all"
              >
                <StopCircle className="w-4 h-4" />
                <span>Cerrar Asistencia</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resumen Post-Cierre */}
      {(closeSummary || activeSession?.status === 'cerrada') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Resumen de Cierre de Asistencia</h3>
            </div>
            <span className="text-xs font-semibold text-slate-500 font-mono bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">Sesión Cerrada</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Matriculados</span>
              <strong className="text-xl font-black text-slate-800 font-mono">
                {closeSummary?.enrolled ?? countMatriculados}
              </strong>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-center text-emerald-700">
              <span className="text-[10px] font-bold uppercase block">Presentes</span>
              <strong className="text-xl font-black font-mono">
                {closeSummary?.presentes ?? countPresentes}
              </strong>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-center text-amber-700">
              <span className="text-[10px] font-bold uppercase block">Tardanzas</span>
              <strong className="text-xl font-black font-mono">
                {closeSummary?.tardanzas ?? countTardanzas}
              </strong>
            </div>
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl text-center text-red-700">
              <span className="text-[10px] font-bold uppercase block">Faltas</span>
              <strong className="text-xl font-black font-mono">
                {closeSummary?.faltas ?? countFaltas}
              </strong>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-center text-[#1F5FA8]">
              <span className="text-[10px] font-bold uppercase block">Justificados</span>
              <strong className="text-xl font-black font-mono">
                {closeSummary?.justificados ?? allMergedStudents.filter((s) => s.status === 'justificado').length}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Caso vacío: No hay sesiones de hoy */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#1F5FA8] flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            No hay sesiones programadas para hoy ({formatDisplayDate(todayLima)})
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
            Para registrar asistencia, primero debes crear el día de clase desde la pestaña <strong className="text-slate-700">Sesiones de clase</strong>.
          </p>
        </div>
      ) : activeSession && activeSession.session_date !== todayLima ? (
        /* Caso vacío: La sesión seleccionada no es de hoy */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-amber-900">
            Sesión no programada para hoy
          </h3>
          <p className="text-xs text-amber-800 max-w-md mx-auto font-medium">
            Solo se puede abrir el día de la clase. La fecha de la sesión es {activeSession.session_date} y hoy es {todayLima}.
          </p>
        </div>
      ) : (
        /* ============================================================== */
        /* CUERPO PRINCIPAL: QR (IZQ) + LISTA REUTILIZABLE (DER) */
        /* ============================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {renderQrPanel()}
          {renderStudentListPanel()}
        </div>
      )}
      {/* Modal Justificación de Asistencia */}
      {justifyingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                  J
                </span>
                <h3 className="text-sm font-bold text-slate-900">Justificar Inasistencia</h3>
              </div>
              <button
                onClick={() => setJustifyingStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Estudiante: <strong className="text-slate-800">{justifyingStudent.studentName}</strong> ({justifyingStudent.studentCode})
            </p>

            {justificationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
                {justificationError}
              </div>
            )}

            <form onSubmit={handleSaveJustification} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motivo de la Justificación *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej. Certificado médico presentado / Licencia académica"
                  value={justificationInput}
                  onChange={(e) => setJustificationInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] focus:ring-2 focus:ring-[#1F5FA8]/20 transition-all outline-none text-slate-800"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setJustifyingStudent(null)}
                  className="flex-1 py-2 px-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingJustification}
                  className="flex-1 py-2 px-3 disabled:opacity-50 text-white text-xs font-bold rounded-xl bg-[#1F5FA8] hover:bg-[#0B2A5B] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  {isSavingJustification ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Guardar Justificación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmación Cierre de Asistencia */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto">
              <StopCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">¿Cerrar la Asistencia?</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Al cerrar, los alumnos sin registro pasarán a <strong className="text-red-600">Falta</strong> de forma definitiva en la base de datos y se detendrá la rotación del código QR.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsCloseModalOpen(false)}
                disabled={isClosing}
                className="flex-1 py-2 px-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCloseAttendance}
                disabled={isClosing}
                className="flex-1 py-2 px-3 text-white text-xs font-bold rounded-xl bg-[#C8102E] hover:bg-red-800 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                {isClosing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Sí, cerrar asistencia</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos CSS de Animación y Respeto a prefers-reduced-motion */}
      <style>{`
        @keyframes popCircle {
          0% { transform: scale(0.8); }
          50% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }

        @media (prefers-reduced-motion: no-preference) {
          .animate-pop {
            animation: popCircle 0.45s ease-out;
          }
        }

        /* Resaltados de fila durante 1.5s */
        .flash-presente {
          background-color: #ecfdf5 !important;
          border-color: #10b981 !important;
          box-shadow: 0 0 0 1px #10b981;
        }
        .flash-tardanza {
          background-color: #fffbeb !important;
          border-color: #f59e0b !important;
          box-shadow: 0 0 0 1px #f59e0b;
        }
        .flash-falta {
          background-color: #fef2f2 !important;
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 1px #ef4444;
        }
        .flash-justificado {
          background-color: #f1f5f9 !important;
          border-color: #64748b !important;
          box-shadow: 0 0 0 1px #64748b;
        }
      `}</style>
    </div>
  );
};
