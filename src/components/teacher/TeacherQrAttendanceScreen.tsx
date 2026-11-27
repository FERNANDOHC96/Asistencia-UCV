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
  AlertTriangle,
  Calendar,
  X,
  Shield,
  Search,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getTeacherSections, getLateToleranceMinutes, TeacherSection } from '../../services/teacherService';
import { fetchSectionStudentsBlockStatus } from '../../services/blockService';
import { ProfileBasicInfo } from '../../lib/profileHelper';
import { StudentAvatar } from '../StudentAvatar';
import { useStudentAvatarUrls } from '../../lib/avatarCache';
import { AttendanceStatusButtonGroup } from './AttendanceStatusButton';
import { ClassSession, AttendanceRecord, QrTokenPayload, CloseAttendanceResult, AttendanceStatus, SectionStudentBlockStatus } from '../../types';
import { ActionButton, IconActionButton, SectionIconBadge } from '../ui';
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

const PIECE_MS = 400;
const FADE_MS = 90;

export const TeacherQrAttendanceScreen: React.FC<TeacherQrAttendanceScreenProps> = ({
  presetSectionId,
}) => {
  const { user } = useAuth();
  const todayLima = getTodayLima();

  const [toleranceMinutes, setToleranceMinutes] = useState<number>(10);

  const [isOpenAttendanceLoading, setIsOpenAttendanceLoading] = useState<boolean>(false);

  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(presetSectionId || '');
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedKind, setSelectedKind] = useState<'all' | 'teoria' | 'practica'>('all');
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeSession = sessions.find((s) => s.id === selectedSessionId);
  const sessionTolerance = activeSession
    ? calculateToleranceLimit(activeSession.session_date, activeSession.starts_at, toleranceMinutes)
    : null;

  const [isAttendanceOpen, setIsAttendanceOpen] = useState<boolean>(false);
  const [attendanceSessionId, setAttendanceSessionId] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(8);

  const [qrMode, setQrMode] = useState<'animated' | 'simple'>('animated');

  const generationRef = useRef<number>(0);
  const [pieceIndex, setPieceIndex] = useState<number>(0);
  const pieceIndexRef = useRef<number>(0);
  const [activeCanvas, setActiveCanvas] = useState<'A' | 'B'>('A');
  const activeCanvasRef = useRef<'A' | 'B'>('A');
  const [isHardCut, setIsHardCut] = useState<boolean>(true);
  const isHardCutRef = useRef<boolean>(true);

  const [animatedDataUrls, setAnimatedDataUrls] = useState<string[]>([]);
  const animatedDataUrlsRef = useRef<string[]>([]);
  const [slotAUrl, setSlotAUrl] = useState<string | null>(null);
  const [slotBUrl, setSlotBUrl] = useState<string | null>(null);
  const [simpleDataUrl, setSimpleDataUrl] = useState<string | null>(null);
  const pieceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAttendanceOpenRef = useRef<boolean>(false);
  isAttendanceOpenRef.current = isAttendanceOpen;
  const attendanceSessionIdRef = useRef<string | null>(null);
  attendanceSessionIdRef.current = attendanceSessionId;
  const qrModeRef = useRef<'animated' | 'simple'>('animated');
  qrModeRef.current = qrMode;
  const selectedSessionIdRef = useRef<string>('');
  selectedSessionIdRef.current = selectedSessionId;
  const statusCheckSeqRef = useRef<number>(0);
  const qrFetchSeqRef = useRef<number>(0);
  const justOpenedSessionIdRef = useRef<string | null>(null);

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

  const [enrolledStudents, setEnrolledStudents] = useState<ProfileBasicInfo[]>([]);
  const [loadingEnrolled, setLoadingEnrolled] = useState<boolean>(false);
  const enrolledStudentsRef = useRef<ProfileBasicInfo[]>([]);
  enrolledStudentsRef.current = enrolledStudents;

  const avatarUrls = useStudentAvatarUrls(enrolledStudents);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [blockStatusMap, setBlockStatusMap] = useState<Record<string, SectionStudentBlockStatus>>({});

  const previousStatusMapRef = useRef<Record<string, string>>({});
  const isInitialLoadRef = useRef<boolean>(true);
  const [animatedStudentIds, setAnimatedStudentIds] = useState<Record<string, string>>({});
  const [savingStudentStatus, setSavingStudentStatus] = useState<Record<string, AttendanceStatus>>({});
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [recentScansCount, setRecentScansCount] = useState<number>(0);

  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus | 'sin_registrar'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'qr' | 'manual'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [justifyingStudent, setJustifyingStudent] = useState<{
    studentId: string;
    studentName: string;
    studentCode: string;
  } | null>(null);
  const [justificationInput, setJustificationInput] = useState<string>('');
  const [isSavingJustification, setIsSavingJustification] = useState<boolean>(false);
  const [justificationError, setJustificationError] = useState<string | null>(null);

  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [closeSummary, setCloseSummary] = useState<CloseAttendanceResult | null>(null);

  const qrIntervalRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const recordsIntervalRef = useRef<any>(null);
  const enrolledIntervalRef = useRef<any>(null);

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

  useEffect(() => {
    getLateToleranceMinutes().then((mins) => {
      setToleranceMinutes(mins);
    });
  }, []);

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
        const currentStillExists = loaded.some((s) => s.id === selectedSessionIdRef.current);
        if (!currentStillExists) {
          const openOrScheduled = loaded.find((s) => s.status === 'abierta' || s.status === 'programada');
          setSelectedSessionId(openOrScheduled ? openOrScheduled.id : loaded[0].id);
        }
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
    justOpenedSessionIdRef.current = null;
    setIsAttendanceOpen(false);
    setAttendanceSessionId(null);
    setQrError(null);
    setCloseSummary(null);
    loadSessions();
  }, [loadSessions]);

  const loadEnrolledStudents = useCallback(async () => {
    if (!selectedSectionId) {
      setEnrolledStudents([]);
      return;
    }

    setLoadingEnrolled(true);
    try {
      const supabase = getSupabaseClient();

      const { data: enrData, error: enrErr } = await supabase
        .from('enrollments')
        .select('student_id, section_id, status')
        .eq('section_id', selectedSectionId)
        .eq('status', 'activa');

      if (enrErr) throw enrErr;

      const ids = (enrData || []).map((e: any) => e.student_id);
      if (ids.length > 0) {

        const { data: profs, error: profErr } = await supabase
          .from('profiles')
          .select('id, code, first_names, last_names, avatar_updated_at, career_id, career:careers(id, name)')
          .in('id', ids);

        if (profErr) throw profErr;

        const normalized: ProfileBasicInfo[] = (profs || []).map((p: any) => ({
          id: p.id,
          code: p.code,
          first_names: p.first_names,
          last_names: p.last_names,
          avatar_updated_at: p.avatar_updated_at,
          career_id: p.career_id ?? null,
          career: Array.isArray(p.career) ? p.career[0] || null : p.career || null,
        }));

        const sorted = normalized.sort((a, b) => {
          const ln = (a.last_names || '').localeCompare(b.last_names || '');
          if (ln !== 0) return ln;
          return (a.first_names || '').localeCompare(b.first_names || '');
        });

        setEnrolledStudents(sorted);

        const statusMap = await fetchSectionStudentsBlockStatus(selectedSectionId, ids).catch(() => ({}));
        setBlockStatusMap(statusMap);
      } else {
        setEnrolledStudents([]);
        setBlockStatusMap({});
      }
    } catch (err: any) {

    } finally {
      setLoadingEnrolled(false);
    }
  }, [selectedSectionId]);

  const refreshBlockStatuses = useCallback(async () => {
    if (!selectedSectionId || enrolledStudentsRef.current.length === 0 || !isSupabaseConfigured()) return;
    try {
      const statusMap = await fetchSectionStudentsBlockStatus(
        selectedSectionId,
        enrolledStudentsRef.current.map((s) => s.id)
      );
      setBlockStatusMap(statusMap);
    } catch {
    }
  }, [selectedSectionId]);

  useEffect(() => {
    loadEnrolledStudents();

    if (enrolledIntervalRef.current) clearInterval(enrolledIntervalRef.current);
    enrolledIntervalRef.current = setInterval(() => {
      loadEnrolledStudents();
    }, 60000);

    return () => {
      if (enrolledIntervalRef.current) clearInterval(enrolledIntervalRef.current);
    };
  }, [loadEnrolledStudents]);

  useEffect(() => {
    if (!selectedSectionId || !isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`teacher-qr-blocks-${selectedSectionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_section_blocks',
          filter: `section_id=eq.${selectedSectionId}`,
        },
        () => {
          refreshBlockStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSectionId, refreshBlockStatuses]);

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

        const newRecordMap: Record<string, AttendanceRecord> = {};
        fetchedRecords.forEach((r) => {
          newRecordMap[r.student_id] = r;
        });

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

            setAnimatedStudentIds((prev) => ({ ...prev, ...changed }));
            setRecentScansCount((c) => c + Object.keys(changed).length);

            setTimeout(() => {
              setAnimatedStudentIds((prev) => {
                const next = { ...prev };
                Object.keys(changed).forEach((id) => delete next[id]);
                return next;
              });
            }, 1500);

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

          isInitialLoadRef.current = false;
        }

        const nextMap: Record<string, string> = {};
        enrolledStudentsRef.current.forEach((st) => {
          nextMap[st.id] = newRecordMap[st.id]?.status || 'sin_registrar';
        });
        previousStatusMapRef.current = nextMap;
        refreshBlockStatuses();
      }
    } catch {

    }
  }, [selectedSessionId, refreshBlockStatuses]);

  useEffect(() => {
    isInitialLoadRef.current = true;
    previousStatusMapRef.current = {};
    setAnimatedStudentIds({});
    setToasts([]);
    setRecentScansCount(0);
  }, [selectedSessionId]);

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

  const checkCurrentSessionStatus = useCallback(async () => {
    const targetSessionId = selectedSessionId;
    if (!targetSessionId) {
      setIsAttendanceOpen(false);
      setAttendanceSessionId(null);
      setAnimatedDataUrls([]);
      animatedDataUrlsRef.current = [];
      setSlotAUrl(null);
      setSlotBUrl(null);
      setSimpleDataUrl(null);
      return;
    }

    const reqSeq = ++statusCheckSeqRef.current;

    try {
      const supabase = getSupabaseClient();
      const { data: classSess, error: classErr } = await supabase
        .from('class_sessions')
        .select('id, status')
        .eq('id', targetSessionId)
        .single();

      if (reqSeq !== statusCheckSeqRef.current || targetSessionId !== selectedSessionIdRef.current) {
        return;
      }
      if (classErr || !classSess) return;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId && s.status !== classSess.status
            ? { ...s, status: classSess.status }
            : s
        )
      );

      if (classSess.status === 'cerrada' || classSess.status === 'cancelada' || classSess.status === 'programada') {
        justOpenedSessionIdRef.current = null;
        setIsAttendanceOpen(false);
        setAttendanceSessionId(null);
        return;
      }

      const { data: attSess, error: attErr } = await supabase
        .from('attendance_sessions')
        .select('id, status')
        .eq('class_session_id', targetSessionId)
        .order('opened_at', { ascending: false })
        .limit(1);

      if (reqSeq !== statusCheckSeqRef.current || targetSessionId !== selectedSessionIdRef.current) {
        return;
      }

      if (!attErr && attSess && attSess.length > 0) {
        const latest = attSess[0];
        setAttendanceSessionId(latest.id);
        const isOpen = latest.status === 'abierta' && classSess.status === 'abierta';
        if (isOpen) {
          justOpenedSessionIdRef.current = targetSessionId;
          setIsAttendanceOpen(true);
        } else if (justOpenedSessionIdRef.current !== targetSessionId) {
          setIsAttendanceOpen(false);
        }
      } else if (attErr) {
        if (!isAttendanceOpenRef.current) {
          setIsAttendanceOpen(false);
          setAttendanceSessionId(null);
        }
      } else {
        if (justOpenedSessionIdRef.current !== targetSessionId || !isAttendanceOpenRef.current) {
          setIsAttendanceOpen(false);
          setAttendanceSessionId(null);
        }
      }
    } catch {

    }
  }, [selectedSessionId]);

  useEffect(() => {
    checkCurrentSessionStatus();
    const interval = setInterval(checkCurrentSessionStatus, 5000);
    return () => clearInterval(interval);
  }, [checkCurrentSessionStatus]);

  const startPieceRotationTimer = useCallback(() => {
    if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);

    pieceTimerRef.current = setInterval(() => {
      const urls = animatedDataUrlsRef.current;
      if (!urls || urls.length < 4) return;

      const currentIdx = pieceIndexRef.current;
      const nextIdx = (currentIdx + 1) % 4;
      const nextSlot = activeCanvasRef.current === 'A' ? 'B' : 'A';

      if (nextSlot === 'B') {
        setSlotBUrl(urls[nextIdx]);
      } else {
        setSlotAUrl(urls[nextIdx]);
      }

      pieceIndexRef.current = nextIdx;
      activeCanvasRef.current = nextSlot;
      isHardCutRef.current = false;
      setIsHardCut(false);
      setActiveCanvas(nextSlot);
      setPieceIndex(nextIdx);
    }, PIECE_MS);
  }, []);

  const fetchNewQrToken = useCallback(async () => {
    const targetSessionId = selectedSessionId;
    if (!targetSessionId || !isAttendanceOpen) return;

    const fetchSeq = ++qrFetchSeqRef.current;

    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('new_qr_token', {
        p_class_session: targetSessionId,
      });

      if (
        fetchSeq !== qrFetchSeqRef.current ||
        targetSessionId !== selectedSessionIdRef.current ||
        !isAttendanceOpenRef.current
      ) {
        return;
      }

      if (rpcErr) throw rpcErr;

      const payload = data as QrTokenPayload;

      if (payload && payload.code === 'success') {
        if (payload.sid && payload.sid !== attendanceSessionIdRef.current) {
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

        await Promise.all(
          v2Urls.map(
            (url) =>
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = url;
              })
          )
        );

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

        if (
          fetchSeq !== qrFetchSeqRef.current ||
          targetSessionId !== selectedSessionIdRef.current ||
          !isAttendanceOpenRef.current
        ) {
          return;
        }

        animatedDataUrlsRef.current = v2Urls;
        setAnimatedDataUrls(v2Urls);
        setSimpleDataUrl(v1Url);

        pieceIndexRef.current = 0;
        activeCanvasRef.current = 'A';
        isHardCutRef.current = true;
        setPieceIndex(0);
        setActiveCanvas('A');
        setIsHardCut(true);
        setSlotAUrl(v2Urls[0] || null);
        setSlotBUrl(v2Urls[1] || null);
        setCountdown(8);

        if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
        if (qrModeRef.current === 'animated') {
          startPieceRotationTimer();
        }
      } else {
        const errCode = payload?.code || 'error';
        setQrError(
          errCode === 'session_closed'
            ? 'La sesión de asistencia está cerrada.'
            : errCode === 'session_cancelled'
            ? 'La sesión fue cancelada.'
            : errCode === 'unauthorized'
            ? 'No tienes permiso para generar códigos QR en esta sesión.'
            : `El servidor no pudo generar el código QR (${errCode}).`
        );
        animatedDataUrlsRef.current = [];
        setAnimatedDataUrls([]);
        setSlotAUrl(null);
        setSlotBUrl(null);
        setSimpleDataUrl(null);
        if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
      }
    } catch (err: any) {
      if (
        fetchSeq !== qrFetchSeqRef.current ||
        targetSessionId !== selectedSessionIdRef.current ||
        !isAttendanceOpenRef.current
      ) {
        return;
      }
      setQrError(err.message || 'Error de conexión al generar el código QR.');
      animatedDataUrlsRef.current = [];
      setAnimatedDataUrls([]);
      setSlotAUrl(null);
      setSlotBUrl(null);
      setSimpleDataUrl(null);
      if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
    }
  }, [selectedSessionId, isAttendanceOpen, startPieceRotationTimer]);

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
      qrFetchSeqRef.current += 1;
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
      animatedDataUrlsRef.current = [];
      setAnimatedDataUrls([]);
      setSlotAUrl(null);
      setSlotBUrl(null);
      setSimpleDataUrl(null);
      setQrError(null);
      setPieceIndex(0);
      pieceIndexRef.current = 0;
      activeCanvasRef.current = 'A';
      setActiveCanvas('A');
      isHardCutRef.current = true;
      setIsHardCut(true);
      generationRef.current = 0;
    }

    return () => {
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (pieceTimerRef.current) clearInterval(pieceTimerRef.current);
    };
  }, [isAttendanceOpen, fetchNewQrToken]);

  const handleOpenAttendance = async () => {
    if (!selectedSessionId) return;
    setError(null);
    setQrError(null);
    setCloseSummary(null);
    setIsOpenAttendanceLoading(true);
    statusCheckSeqRef.current += 1;

    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('open_attendance', {
        p_class_session: selectedSessionId,
      });

      if (rpcErr) throw rpcErr;

      const result = String(data);
      if (result === 'success' || result === 'already_open') {
        statusCheckSeqRef.current += 1;
        justOpenedSessionIdRef.current = selectedSessionId;
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

        setAnimatedStudentIds((prev) => ({ ...prev, [studentId]: newStatus }));
        setTimeout(() => {
          setAnimatedStudentIds((prev) => {
            const next = { ...prev };
            delete next[studentId];
            return next;
          });
        }, 1500);

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
        statusCheckSeqRef.current += 1;
        qrFetchSeqRef.current += 1;
        justOpenedSessionIdRef.current = null;
        setCloseSummary(summary);
        setIsAttendanceOpen(false);
        setAttendanceSessionId(null);
        setQrError(null);
        setIsCloseModalOpen(false);
        setSessions((prev) =>
          prev.map((s) => (s.id === selectedSessionId ? { ...s, status: 'cerrada' } : s))
        );

        if (recordsIntervalRef.current) clearInterval(recordsIntervalRef.current);

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

  const recordsByStudentId = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    records.forEach((r) => {
      map[r.student_id] = r;
    });
    return map;
  }, [records]);

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

  const countMatriculados = enrolledStudents.length;
  const countPresentes = allMergedStudents.filter((s) => s.status === 'presente').length;
  const countTardanzas = allMergedStudents.filter((s) => s.status === 'tardanza').length;
  const countFaltas = allMergedStudents.filter((s) => s.status === 'falta').length;
  const countSinRegistrar = allMergedStudents.filter((s) => s.status === 'sin_registrar').length;

  const filteredStudents = useMemo(() => {
    return allMergedStudents.filter((row) => {

      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }

      if (methodFilter !== 'all') {
        if (!row.method) return false;
        if (row.method.toLowerCase() !== methodFilter) return false;
      }

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

  const renderQrPanel = () => {
    if (isAttendanceOpen) {
      return (
        <div className="lg:col-span-5 ucv-card rounded-2xl border-t-2 border-t-[#C8102E] p-6 flex flex-col items-center justify-between text-center relative overflow-hidden">

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

          {qrError && (
            <div className="w-full mb-2 p-3 rounded-xl bg-red-50 border border-red-200 text-left flex items-center justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-red-800 break-words">{qrError}</span>
              </div>
              <ActionButton
                icon={RefreshCw}
                variant="brand"
                size="xs"
                onClick={fetchNewQrToken}
              >
                Reintentar
              </ActionButton>
            </div>
          )}

          {qrMode === 'animated' ? (
            <div className="w-full flex justify-center my-2 relative">
              <svg
                viewBox="0 0 400 500"
                className="w-full max-w-[480px] sm:max-w-[520px] md:max-w-[560px] h-auto select-none"
              >
                <defs>
                  <filter id="shieldShadow" x="-15%" y="-10%" width="130%" height="130%">
                    <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#C8102E" floodOpacity="0.35" />
                  </filter>

                  <linearGradient id="shieldRedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D9213B" />
                    <stop offset="100%" stopColor="#8A0A1C" />
                  </linearGradient>

                  <linearGradient id="shieldGlossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.22" />
                  </linearGradient>

                  <clipPath id="shieldPathClip">
                    <path d="M20 20H380V250C380 360 290 430 200 470C110 430 20 360 20 250Z" />
                  </clipPath>

                  <clipPath id="tokenBarClip">
                    <rect x="90" y="40" width="220" height="16" rx="8" />
                  </clipPath>
                </defs>

                <path
                  d="M20 20H380V250C380 360 290 430 200 470C110 430 20 360 20 250Z"
                  fill="url(#shieldRedGrad)"
                  stroke="#6E0A17"
                  strokeWidth="3"
                  filter="url(#shieldShadow)"
                />

                <rect
                  x="20"
                  y="20"
                  width="360"
                  height="150"
                  fill="url(#shieldGlossGrad)"
                  clipPath="url(#shieldPathClip)"
                  pointerEvents="none"
                />

                <path
                  d="M32 32H368V250C368 352 283 418 200 456C117 418 32 352 32 250Z"
                  fill="none"
                  stroke="#F4C542"
                  strokeOpacity="0.55"
                  strokeWidth="1.5"
                  pointerEvents="none"
                />

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

                <rect x="70" y="72" width="260" height="260" rx="18" fill="#FFFFFF" />

                {slotAUrl && (
                  <image
                    x="82"
                    y="84"
                    width="236"
                    height="236"
                    href={slotAUrl}
                    preserveAspectRatio="xMidYMid meet"
                    style={{
                      opacity: activeCanvas === 'A' ? 1 : 0,
                      transition: isHardCut ? 'none' : `opacity ${effectiveFadeMs}ms linear`,
                    }}
                  />
                )}

                {slotBUrl && (
                  <image
                    x="82"
                    y="84"
                    width="236"
                    height="236"
                    href={slotBUrl}
                    preserveAspectRatio="xMidYMid meet"
                    style={{
                      opacity: activeCanvas === 'B' ? 1 : 0,
                      transition: isHardCut ? 'none' : `opacity ${effectiveFadeMs}ms linear`,
                    }}
                  />
                )}

                {!slotAUrl && !slotBUrl && (
                  <text
                    x="200"
                    y="202"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#94A3B8"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                  >
                    {qrError ? 'Sin QR disponible' : 'Generando QR...'}
                  </text>
                )}

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
                {simpleDataUrl ? (
                  <img
                    src={simpleDataUrl}
                    alt="Código QR de asistencia"
                    className="w-full h-full object-contain rounded-lg select-none"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#C8102E]" />
                    <span className="text-xs font-semibold">Generando QR...</span>
                  </div>
                )}
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

    return (
      <div className="lg:col-span-5 ucv-card rounded-2xl border-t-2 border-t-[#C8102E] p-8 flex flex-col items-center justify-center text-center space-y-4">
        <SectionIconBadge icon={QrCode} variant="navy" size="lg" />
        <div>
          <h3 className="text-base font-bold text-[#0B2A5B] tracking-[-0.015em]">Asistencia no iniciada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs font-medium">
            Abre la asistencia QR para proyectar el marcador animado a los estudiantes y registrar su asistencia en vivo.
          </p>
        </div>
        {activeSession && activeSession.status !== 'cerrada' && activeSession.status !== 'cancelada' && (
          <ActionButton
            icon={Play}
            variant="primary"
            size="md"
            loading={isOpenAttendanceLoading}
            onClick={handleOpenAttendance}
          >
            {isOpenAttendanceLoading ? 'Iniciando...' : 'Iniciar toma de asistencia'}
          </ActionButton>
        )}
      </div>
    );
  };

  const renderStudentListPanel = () => {
    return (
      <div className="lg:col-span-7 ucv-card rounded-2xl border-t-2 border-t-[#1F5FA8] p-6 flex flex-col space-y-4">

        <div className="space-y-3 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-[11px] font-bold text-[#0B2A5B] uppercase tracking-[0.06em] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1F5FA8]" strokeWidth={1.85} />
                <span>Lista Completa de Alumnos ({countMatriculados})</span>
              </h3>
              {sessionTolerance && (
                <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200/85 px-2.5 py-0.5 rounded-md font-semibold inline-flex items-center gap-1.5 mt-1.5">
                  <Clock className="w-3 h-3 text-amber-600 shrink-0" strokeWidth={1.85} />
                  <span>Inicio {sessionTolerance.startTimeStr} · tolerancia hasta {sessionTolerance.limitTimeStr}</span>
                </div>
              )}
            </div>

            {recentScansCount > 0 && (
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/85 px-2.5 py-1 rounded-md animate-pulse self-start sm:self-auto">
                +{recentScansCount} nuevo(s) escaneo(s)
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            <div className="p-2.5 bg-slate-50/85 border border-slate-200/85 rounded-xl text-center">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500 block">Matriculados</span>
              <span className="text-base font-bold text-slate-800 font-mono tabular-nums">{countMatriculados}</span>
            </div>
            <div className="p-2.5 bg-emerald-50/75 border border-emerald-200/85 rounded-xl text-center text-emerald-700">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] block">Presentes</span>
              <span className="text-base font-bold font-mono tabular-nums">{countPresentes}</span>
            </div>
            <div className="p-2.5 bg-amber-50/75 border border-amber-200/85 rounded-xl text-center text-amber-700">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] block">Tardanzas</span>
              <span className="text-base font-bold font-mono tabular-nums">{countTardanzas}</span>
            </div>
            <div className="p-2.5 bg-red-50/75 border border-red-200/85 rounded-xl text-center text-red-700">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] block">Faltas</span>
              <span className="text-base font-bold font-mono tabular-nums">{countFaltas}</span>
            </div>
            <div className="p-2.5 bg-slate-50/85 border border-slate-200/85 rounded-xl text-center text-slate-600">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] block">Sin registrar</span>
              <span className="text-base font-bold font-mono tabular-nums">{countSinRegistrar}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">

          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.85} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar código o nombre..."
              className="w-full h-10 pl-9 pr-3 text-xs font-medium bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] focus:ring-2 focus:ring-[#1F5FA8]/20 transition-all outline-hidden text-slate-800"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full h-10 px-2.5 text-xs font-medium bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] focus:ring-2 focus:ring-[#1F5FA8]/20 transition-all outline-hidden text-slate-700 cursor-pointer"
            >
              <option value="all">Estado: Todos ({countMatriculados})</option>
              <option value="presente">Presente ({countPresentes})</option>
              <option value="tardanza">Tardanza ({countTardanzas})</option>
              <option value="falta">Falta ({countFaltas})</option>
              <option value="justificado">Justificado ({allMergedStudents.filter(s => s.status === 'justificado').length})</option>
              <option value="sin_registrar">Sin registrar ({countSinRegistrar})</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              className="w-full h-10 px-2.5 text-xs font-medium bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] focus:ring-2 focus:ring-[#1F5FA8]/20 transition-all outline-hidden text-slate-700 cursor-pointer"
            >
              <option value="all">Método: Todos</option>
              <option value="qr">Código QR</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>

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
              const blockStatus = blockStatusMap[st.id];
              const isStudentBlocked = Boolean(blockStatus?.isBlocked);
              const cycleAbsences = blockStatus?.cycleAbsences ?? 0;
              const isAbsenceWarning = !isStudentBlocked && cycleAbsences === 2;

              const isPresente = row.status === 'presente';
              const isTardanza = row.status === 'tardanza';
              const isFalta = row.status === 'falta';
              const isJustificado = row.status === 'justificado';
              const isSinRegistrar = row.status === 'sin_registrar';

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
                      : isStudentBlocked
                      ? 'bg-red-50/50 border-red-300 shadow-2xs'
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

                    <StudentAvatar
                      student={st}
                      status={row.status}
                      signedUrl={avatarUrls[st.id]}
                      isAnimated={isAnimated}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          {st.code}
                        </span>
                        <strong className="text-xs font-bold text-slate-900 truncate">
                          {st.last_names}, {st.first_names}
                        </strong>
                        {isStudentBlocked ? (
                          <span
                            title={blockStatus?.activeBlock?.reason || 'Inhabilitado en este curso'}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200/85 text-[#C8102E] text-[10px] font-semibold uppercase tracking-[0.04em]"
                          >
                            <ShieldAlert className="w-3 h-3" strokeWidth={1.85} />
                            <span>INHABILITADO ({cycleAbsences}/3)</span>
                          </span>
                        ) : isAbsenceWarning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/85 text-amber-800 text-[10px] font-semibold">
                            <AlertTriangle className="w-3 h-3" strokeWidth={1.85} />
                            <span>2/3 faltas</span>
                          </span>
                        ) : blockStatus ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/85 text-emerald-700 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" strokeWidth={1.85} />
                            <span>Habilitado ({cycleAbsences}/3)</span>
                          </span>
                        ) : null}
                      </div>
                      {st.career?.name && (
                        <div className="mt-1">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/85 text-[#1F5FA8] text-[10px] font-semibold uppercase tracking-[0.04em]">
                            {st.career.name}
                          </span>
                        </div>
                      )}
                      {isStudentBlocked && (
                        <div className="mt-1 text-[10px] font-semibold text-[#C8102E]">
                          Bloqueado en este curso (QR/Bluetooth deshabilitado hasta rehabilitación por Administración)
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">

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

                        <span className="text-slate-500 font-mono">
                          {row.registered_at ? formatLimaTime(row.registered_at) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl p-3 flex items-center justify-between gap-3 ucv-slide-down"
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

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-800">Error en Asistencia</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="ucv-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] uppercase font-bold text-[#0B2A5B] tracking-[0.06em]">
              Sesión de Hoy ({formatDisplayDate(todayLima)})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton
              icon={RefreshCw}
              variant="secondary"
              size="sm"
              spinningIcon={loadingSessions || loadingEnrolled}
              disabled={loadingSessions || loadingEnrolled}
              onClick={() => {
                loadSessions();
                loadEnrolledStudents();
                fetchSessionRecords();
              }}
            >
              Actualizar datos
            </ActionButton>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-[0.06em]">
              Sesión programada para hoy:
            </label>
            <select
              value={selectedSessionId}
              disabled={isAttendanceOpen}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full h-10 text-xs px-3 font-medium bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] focus:ring-2 focus:ring-[#1F5FA8]/20 transition-all outline-hidden text-slate-800 disabled:opacity-50 cursor-pointer"
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

          {activeSession && (
            <div className="flex flex-col justify-center bg-slate-50/85 border border-slate-200/85 p-3.5 rounded-xl text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Estado de la sesión:</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase border ${
                    activeSession.status === 'abierta'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/85'
                      : activeSession.status === 'cerrada'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-blue-50 text-[#1F5FA8] border-blue-200/85'
                  }`}
                >
                  {activeSession.status}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-slate-500 font-medium text-[11px] font-mono tabular-nums">
                <span>Horario: {activeSession.starts_at?.slice(0, 5)} - {activeSession.ends_at?.slice(0, 5)}</span>
                <span className="font-sans">{activeSession.kind === 'practica' ? 'Práctica' : 'Teoría'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeSession && (
        <div className="ucv-card rounded-2xl border-t-2 border-t-[#C8102E] p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-3.5 h-3.5 rounded-full ${
                isAttendanceOpen ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-400/20' : 'bg-slate-300'
              }`}
            />
            <div>
              <h3 className="text-sm font-bold text-[#0B2A5B]">
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
              <ActionButton
                icon={Play}
                variant="primary"
                size="md"
                loading={isOpenAttendanceLoading}
                onClick={handleOpenAttendance}
              >
                {isOpenAttendanceLoading ? 'Abriendo...' : 'Abrir Asistencia QR'}
              </ActionButton>
            )}

            {isAttendanceOpen && (
              <ActionButton
                icon={StopCircle}
                variant="brand"
                size="md"
                onClick={() => setIsCloseModalOpen(true)}
              >
                Cerrar Asistencia
              </ActionButton>
            )}
          </div>
        </div>
      )}

      {(closeSummary || activeSession?.status === 'cerrada') && (
        <div className="ucv-card ucv-animate-in rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={1.85} />
              <h3 className="text-sm font-bold text-slate-900">Resumen de Cierre de Asistencia</h3>
            </div>
            <span className="text-xs font-semibold text-slate-500 font-mono bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">Sesión Cerrada</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            <div className="bg-slate-50/85 border border-slate-200/85 p-3.5 rounded-xl text-center">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.05em] block">Matriculados</span>
              <strong className="text-xl font-bold text-slate-800 font-mono tabular-nums">
                {closeSummary?.enrolled ?? countMatriculados}
              </strong>
            </div>
            <div className="bg-emerald-50/75 border border-emerald-200/85 p-3.5 rounded-xl text-center text-emerald-700">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] block">Presentes</span>
              <strong className="text-xl font-bold font-mono tabular-nums">
                {closeSummary?.presentes ?? countPresentes}
              </strong>
            </div>
            <div className="bg-amber-50/75 border border-amber-200/85 p-3.5 rounded-xl text-center text-amber-700">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] block">Tardanzas</span>
              <strong className="text-xl font-bold font-mono tabular-nums">
                {closeSummary?.tardanzas ?? countTardanzas}
              </strong>
            </div>
            <div className="bg-red-50/75 border border-red-200/85 p-3.5 rounded-xl text-center text-red-700">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] block">Faltas</span>
              <strong className="text-xl font-bold font-mono tabular-nums">
                {closeSummary?.faltas ?? countFaltas}
              </strong>
            </div>
            <div className="bg-blue-50/75 border border-blue-200/85 p-3.5 rounded-xl text-center text-[#1F5FA8]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] block">Justificados</span>
              <strong className="text-xl font-bold font-mono tabular-nums">
                {closeSummary?.justificados ?? allMergedStudents.filter((s) => s.status === 'justificado').length}
              </strong>
            </div>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-10 text-center space-y-3">
          <SectionIconBadge icon={Calendar} variant="blue" size="lg" className="mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            No hay sesiones programadas para hoy ({formatDisplayDate(todayLima)})
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
            Para registrar asistencia, primero debes crear el día de clase desde la pestaña <strong className="text-slate-700">Sesiones de clase</strong>.
          </p>
        </div>
      ) : activeSession && activeSession.session_date !== todayLima ? (

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-10 text-center space-y-3">
          <SectionIconBadge icon={AlertTriangle} variant="amber" size="lg" className="mx-auto" />
          <h3 className="text-sm font-bold text-amber-900">
            Sesión no programada para hoy
          </h3>
          <p className="text-xs text-amber-800 max-w-md mx-auto font-medium">
            Solo se puede abrir el día de la clase. La fecha de la sesión es {activeSession.session_date} y hoy es {todayLima}.
          </p>
        </div>
      ) : (

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {renderQrPanel()}
          {renderStudentListPanel()}
        </div>
      )}

      {justifyingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="ucv-card ucv-scale-in rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="h-1 ucv-topbar-split w-full" />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                    J
                  </span>
                  <h3 className="text-sm font-bold text-[#0B2A5B]">Justificar Inasistencia</h3>
                </div>
                <IconActionButton
                  icon={X}
                  label="Cerrar modal"
                  variant="neutral"
                  size="xs"
                  tooltipSide="bottom"
                  onClick={() => setJustifyingStudent(null)}
                />
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
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setJustifyingStudent(null)}
                    className="flex-1"
                  >
                    Cancelar
                  </ActionButton>
                  <ActionButton
                    type="submit"
                    icon={CheckCircle2}
                    variant="primary"
                    size="sm"
                    loading={isSavingJustification}
                    className="flex-1"
                  >
                    Guardar Justificación
                  </ActionButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="ucv-card ucv-scale-in rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="h-1 ucv-topbar-split w-full" />
            <div className="p-6 space-y-4">
              <SectionIconBadge icon={StopCircle} variant="red" size="lg" className="mx-auto" />
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">¿Cerrar la Asistencia?</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Al cerrar, los alumnos sin registro pasarán a <strong className="text-red-600">Falta</strong> de forma definitiva en la base de datos y se detendrá la rotación del código QR.
              </p>
            </div>
            <div className="flex gap-2">
              <ActionButton
                variant="secondary"
                size="sm"
                disabled={isClosing}
                onClick={() => setIsCloseModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </ActionButton>
              <ActionButton
                icon={StopCircle}
                variant="brand"
                size="sm"
                loading={isClosing}
                onClick={handleConfirmCloseAttendance}
                className="flex-1"
              >
                Sí, cerrar asistencia
              </ActionButton>
            </div>
            </div>
          </div>
        </div>
      )}

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
