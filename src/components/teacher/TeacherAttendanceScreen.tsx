import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserCheck, Clock, XCircle, FileText, HelpCircle, Search, RefreshCw, AlertCircle, CheckCircle2, Loader2, Check, AlertTriangle, History, BookOpen, FlaskConical } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getTeacherSections, getSectionActiveStudents, TeacherSection } from '../../services/teacherService';
import { ClassSession, LearningUnit, AcademicWeek, AttendanceRecord, AttendanceStatus, Profile } from '../../types';
import { formatDisplayDate, formatTime, formatLimaTime } from '../../lib/dateUtils';
import { translateSupabaseError, translateAttendanceRpcError } from '../../lib/supabaseErrors';
import { getMethodLabel } from '../../lib/attendanceUtils';
import { StudentAvatar } from '../StudentAvatar';
import { useStudentAvatarUrls } from '../../lib/avatarCache';
import { AttendanceStatusButtonGroup } from './AttendanceStatusButton';

interface StudentAttendanceRow {
  student: Profile;
  record?: AttendanceRecord;
  optimisticStatus?: AttendanceStatus | 'sin_registrar';
  justificationInput?: string;
  isSaving?: boolean;
}

interface TeacherAttendanceScreenProps {
  presetSectionId?: string;
}

export const TeacherAttendanceScreen: React.FC<TeacherAttendanceScreenProps> = ({ presetSectionId }) => {
  const { user } = useAuth();
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(presetSectionId || '');

  // Cascade selectors
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');

  const [weeks, setWeeks] = useState<AcademicWeek[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('all');

  // Filter by kind (Todas / Teoría / Práctica)
  const [selectedKind, setSelectedKind] = useState<'all' | 'teoria' | 'practica'>('all');

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Attendance state
  const [students, setStudents] = useState<Profile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<Record<string, StudentAttendanceRow>>({});

  // URLs firmadas de avatares en caché
  const avatarUrls = useStudentAvatarUrls(students);

  // Estados de guardado individual por botón y animación
  const [savingTargetStatus, setSavingTargetStatus] = useState<Record<string, AttendanceStatus>>({});
  const [animatedStudentIds, setAnimatedStudentIds] = useState<Record<string, AttendanceStatus>>({});

  const [loadingSections, setLoadingSections] = useState<boolean>(true);
  const [loadingCascade, setLoadingCascade] = useState<boolean>(false);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Fetch teacher sections
  const fetchSections = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoadingSections(false);
      return;
    }

    setLoadingSections(true);
    setError(null);

    try {
      const data = await getTeacherSections(user.id);
      setSections(data);
      if (presetSectionId) {
        setSelectedSectionId(presetSectionId);
      } else if (data.length > 0 && !selectedSectionId) {
        setSelectedSectionId(data[0].id);
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
    } finally {
      setLoadingSections(false);
    }
  }, [user, selectedSectionId, presetSectionId]);

  useEffect(() => {
    fetchSections();
  }, [user]);

  const currentSection = sections.find((s) => s.id === selectedSectionId) || null;

  // 2. Cascade Fetch: Units, Weeks, and Sessions for current section
  const fetchCascadeData = useCallback(async () => {
    if (!selectedSectionId || !currentSection || !isSupabaseConfigured()) {
      setUnits([]);
      setWeeks([]);
      setSessions([]);
      setSelectedSessionId('');
      return;
    }

    setLoadingCascade(true);
    try {
      const supabase = getSupabaseClient();

      // Units
      const { data: uData } = await supabase
        .from('learning_units')
        .select('*')
        .eq('offering_id', currentSection.offering_id)
        .is('archived_at', null)
        .order('number', { ascending: true });
      setUnits(uData || []);

      // Weeks
      const { data: wData } = await supabase
        .from('academic_weeks')
        .select('*')
        .eq('offering_id', currentSection.offering_id)
        .is('archived_at', null)
        .order('number', { ascending: true });
      setWeeks(wData || []);

      // Sessions
      const { data: sData } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('section_id', selectedSectionId)
        .is('archived_at', null)
        .order('session_date', { ascending: false })
        .order('starts_at', { ascending: false });

      const allSessions = sData || [];
      setSessions(allSessions);

      if (allSessions.length > 0) {
        setSelectedSessionId(allSessions[0].id);
      } else {
        setSelectedSessionId('');
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'class_sessions'));
    } finally {
      setLoadingCascade(false);
    }
  }, [selectedSectionId, currentSection]);

  useEffect(() => {
    if (selectedSectionId) {
      fetchCascadeData();
      setSelectedUnitId('all');
      setSelectedWeekId('all');
    }
  }, [selectedSectionId, fetchCascadeData]);

  // Filtered Sessions according to selected Unit / Week / Kind
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedUnitId !== 'all' && s.unit_id !== selectedUnitId) return false;
      if (selectedWeekId !== 'all' && s.week_id !== selectedWeekId) return false;
      if (selectedKind !== 'all' && (s.kind || 'teoria') !== selectedKind) return false;
      return true;
    });
  }, [sessions, selectedUnitId, selectedWeekId, selectedKind]);

  // Auto-select session if current selection isn't in filtered list
  useEffect(() => {
    if (filteredSessions.length > 0) {
      if (!selectedSessionId || !filteredSessions.some((s) => s.id === selectedSessionId)) {
        setSelectedSessionId(filteredSessions[0].id);
      }
    } else {
      setSelectedSessionId('');
    }
  }, [filteredSessions, selectedSessionId]);

  const currentSession = sessions.find((s) => s.id === selectedSessionId) || null;

  // 3. Fetch Active Students & Existing Attendance Records for selected Session
  const fetchSessionAttendance = useCallback(async () => {
    if (!selectedSessionId || !selectedSectionId || !isSupabaseConfigured()) {
      setStudents([]);
      setAttendanceRecords([]);
      setAttendanceRows({});
      return;
    }

    setLoadingAttendance(true);
    setActionFeedback(null);

    try {
      const supabase = getSupabaseClient();

      // A. Active enrolled students (via helper)
      const activeStudents = await getSectionActiveStudents(selectedSectionId);
      setStudents(activeStudents);

      // B. Attendance records for this class_session_id (ONLY READ, NO created_at)
      const { data: aRecords, error: aErr } = await supabase
        .from('attendance_records')
        .select('id, class_session_id, student_id, status, method, justification, registered_at, modified_by, modified_at')
        .eq('class_session_id', selectedSessionId);

      if (aErr) throw aErr;
      const records = (aRecords as AttendanceRecord[]) || [];
      setAttendanceRecords(records);

      // Build rows map
      const recordsMapByStudentId: Record<string, AttendanceRecord> = {};
      records.forEach((r) => {
        recordsMapByStudentId[r.student_id] = r;
      });

      const initialRows: Record<string, StudentAttendanceRow> = {};
      activeStudents.forEach((stu) => {
        const rec = recordsMapByStudentId[stu.id];
        initialRows[stu.id] = {
          student: stu,
          record: rec,
          optimisticStatus: rec ? rec.status : 'sin_registrar',
          justificationInput: rec?.justification || '',
          isSaving: false,
        };
      });

      setAttendanceRows(initialRows);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'attendance_records'));
    } finally {
      setLoadingAttendance(false);
    }
  }, [selectedSessionId, selectedSectionId]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionAttendance();
    }
  }, [selectedSessionId, fetchSessionAttendance]);

  // Handle setting attendance via RPC
  const handleSetAttendance = async (studentId: string, targetStatus: AttendanceStatus) => {
    if (!selectedSessionId) return;

    const currentRow = attendanceRows[studentId];
    if (!currentRow || currentRow.isSaving) return;

    const previousStatus = currentRow.optimisticStatus;
    const justification = currentRow.justificationInput || null;

    // Estado cargando: el botón se muestra en gris con spinner girando
    setSavingTargetStatus((prev) => ({ ...prev, [studentId]: targetStatus }));
    setAttendanceRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        isSaving: true,
      },
    }));
    setActionFeedback(null);

    try {
      const supabase = getSupabaseClient();

      // CRITICAL: Call set_attendance RPC
      const { data: rpcResponse, error: rpcError } = await supabase.rpc('set_attendance', {
        p_class_session: selectedSessionId,
        p_student: studentId,
        p_status: targetStatus,
        p_justification: targetStatus === 'justificado' ? justification : null,
      });

      if (rpcError) {
        throw new Error(translateSupabaseError(rpcError));
      }

      // Check return string: strictly "success"
      if (rpcResponse !== 'success') {
        const translatedMsg = translateAttendanceRpcError(String(rpcResponse));
        setAttendanceRows((prev) => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            isSaving: false,
          },
        }));
        setActionFeedback({ type: 'error', message: `${currentRow.student.first_names}: ${translatedMsg}` });
        return;
      }

      // Success: Solo ahora pasa al nuevo color y se anima
      setAttendanceRows((prev) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          optimisticStatus: targetStatus,
          record: {
            id: prev[studentId].record?.id || 'temp',
            class_session_id: selectedSessionId,
            student_id: studentId,
            status: targetStatus,
            method: 'manual',
            justification: targetStatus === 'justificado' ? justification : null,
            registered_at: new Date().toISOString(),
          },
          isSaving: false,
        },
      }));

      // Animación pop para el nuevo estado
      setAnimatedStudentIds((prev) => ({ ...prev, [studentId]: targetStatus }));
      setTimeout(() => {
        setAnimatedStudentIds((prev) => {
          const n = { ...prev };
          delete n[studentId];
          return n;
        });
      }, 1500);

      setActionFeedback({
        type: 'success',
        message: `Asistencia actualizada para ${currentRow.student.first_names} ${currentRow.student.last_names} (${targetStatus}).`,
      });

      // Refetch records in background to keep history fresh
      const { data: freshRecords } = await supabase
        .from('attendance_records')
        .select('id, class_session_id, student_id, status, method, justification, registered_at, modified_by, modified_at')
        .eq('class_session_id', selectedSessionId);
      if (freshRecords) {
        setAttendanceRecords(freshRecords as AttendanceRecord[]);
      }
    } catch (err: unknown) {
      setAttendanceRows((prev) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          isSaving: false,
        },
      }));
      const msg = err instanceof Error ? err.message : 'Error inesperado al invocar set_attendance.';
      setActionFeedback({ type: 'error', message: msg });
    } finally {
      setSavingTargetStatus((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  };

  const handleJustificationChange = (studentId: string, text: string) => {
    setAttendanceRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        justificationInput: text,
      },
    }));
  };

  // Summary Metrics
  const summary = useMemo(() => {
    const list = Object.values(attendanceRows);
    const total = list.length;
    let presentes = 0;
    let tardanzas = 0;
    let faltas = 0;
    let justificados = 0;
    let sinRegistrar = 0;

    list.forEach((r) => {
      const st = r.optimisticStatus;
      if (st === 'presente') presentes++;
      else if (st === 'tardanza') tardanzas++;
      else if (st === 'falta') faltas++;
      else if (st === 'justificado') justificados++;
      else sinRegistrar++;
    });

    return { total, presentes, tardanzas, faltas, justificados, sinRegistrar };
  }, [attendanceRows]);

  // Filtered rows by search query
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = Object.values(attendanceRows);
    if (!q) return rows;
    return rows.filter((r) => {
      const codeMatch = (r.student.code || '').toLowerCase().includes(q);
      const nameMatch = `${r.student.first_names} ${r.student.last_names}`.toLowerCase().includes(q);
      return codeMatch || nameMatch;
    });
  }, [attendanceRows, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-mono font-bold text-[#1F5FA8] uppercase tracking-wider mb-2">
            <span>Módulo de Asistencia</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-[#1F5FA8] flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Registro de Asistencia Manual
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Control de asistencia por sesión con persistencia mediante función oficial institucional
          </p>
        </div>

        <button
          onClick={() => {
            fetchSections();
            fetchSessionAttendance();
          }}
          disabled={loadingSections || loadingAttendance}
          className="self-start sm:self-auto px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingAttendance ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Selectors Bar in Cascade */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span>1. Selección de Sesión de Clase</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
          {/* 1. Sección */}
          <div>
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">Sección *</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={sections.length === 0}
              className="w-full px-3 py-2 font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none truncate cursor-pointer"
            >
              {sections.length === 0 ? (
                <option value="">Sin secciones asignadas</option>
              ) : (
                sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.offering.course.code} ({s.offering.course.name}) — Sec. {s.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Tipo (Filtro por Tipo) */}
          <div>
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">Tipo de Clase</label>
            <select
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value as 'all' | 'teoria' | 'practica')}
              className="w-full px-3 py-2 text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none truncate cursor-pointer font-medium"
            >
              <option value="all">Todas (Teoría / Práctica)</option>
              <option value="teoria">Teoría</option>
              <option value="practica">Práctica</option>
            </select>
          </div>

          {/* 3. Unidad (Opcional) */}
          <div>
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">Unidad (Opcional)</label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              disabled={units.length === 0}
              className="w-full px-3 py-2 text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none truncate cursor-pointer font-medium"
            >
              <option value="all">Todas las unidades</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  Unidad {u.number}: {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Semana (Opcional) */}
          <div>
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">Semana (Opcional)</label>
            <select
              value={selectedWeekId}
              onChange={(e) => setSelectedWeekId(e.target.value)}
              disabled={weeks.length === 0}
              className="w-full px-3 py-2 text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none truncate cursor-pointer font-medium"
            >
              <option value="all">Todas las semanas</option>
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  Semana {w.number}: {w.topic || 'Tema'}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Sesión de Clase */}
          <div>
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">Sesión de Clase *</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              disabled={filteredSessions.length === 0}
              className="w-full px-3 py-2 font-mono text-slate-900 font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none truncate disabled:opacity-50 cursor-pointer"
            >
              {filteredSessions.length === 0 ? (
                <option value="">No hay sesiones programadas</option>
              ) : (
                filteredSessions.map((s) => {
                  const kindLabel = s.kind === 'practica' ? 'Práctica' : 'Teoría';
                  return (
                    <option key={s.id} value={s.id}>
                      {kindLabel} · {formatDisplayDate(s.session_date)} · {formatTime(s.starts_at)} - {formatTime(s.ends_at)} — {s.topic || 'Clase'} [{s.status.toUpperCase()}]
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Action feedback */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span className="font-semibold">{actionFeedback.message}</span>
        </div>
      )}

      {!selectedSessionId ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center text-xs text-slate-500 font-medium">
          Selecciona una sección y una sesión de clase programada para registrar y consultar asistencias.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Session Banner and Summary Metrics */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Sesión Activa
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      currentSession?.kind === 'practica'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                    }`}
                  >
                    {currentSession?.kind === 'practica' ? (
                      <FlaskConical className="w-3 h-3 text-purple-600" />
                    ) : (
                      <BookOpen className="w-3 h-3 text-[#1F5FA8]" />
                    )}
                    <span>{currentSession?.kind === 'practica' ? 'Práctica' : 'Teoría'}</span>
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {currentSession?.topic || 'Clase Presencial'}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono mt-1 font-medium">
                  <span>📅 {formatDisplayDate(currentSession?.session_date || '')}</span>
                  <span>•</span>
                  <span>⏰ {formatTime(currentSession?.starts_at)} a {formatTime(currentSession?.ends_at)}</span>
                  <span>•</span>
                  <span className="capitalize font-bold text-slate-700">Estado: {currentSession?.status}</span>
                </div>
              </div>

              {/* Status Warning */}
              {currentSession?.status === 'cerrada' && (
                <span className="bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 rounded-full">
                  Sesión cerrada
                </span>
              )}
              {currentSession?.status === 'cancelada' && (
                <span className="bg-red-50 border border-red-200 px-3 py-1 text-xs font-bold text-red-700 rounded-full">
                  Sesión cancelada
                </span>
              )}
            </div>

            {/* Real Summary Bar with Total Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-center">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Matriculados</span>
                <span className="text-lg font-black text-slate-900 font-mono">{summary.total}</span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
                <span className="text-[10px] uppercase font-bold block">Presentes</span>
                <span className="text-lg font-black font-mono">{summary.presentes}</span>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
                <span className="text-[10px] uppercase font-bold block">Tardanzas</span>
                <span className="text-lg font-black font-mono">{summary.tardanzas}</span>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <span className="text-[10px] uppercase font-bold block">Faltas</span>
                <span className="text-lg font-black font-mono">{summary.faltas}</span>
              </div>
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700">
                <span className="text-[10px] uppercase font-bold block">Justificados</span>
                <span className="text-lg font-black font-mono">{summary.justificados}</span>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[#1F5FA8]">
                <span className="text-[10px] uppercase font-bold block">Sin Registrar</span>
                <span className="text-lg font-black font-mono">{summary.sinRegistrar}</span>
              </div>
            </div>
          </div>

          {/* Search Filter */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar alumno por código o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] focus:ring-2 focus:ring-[#1F5FA8]/20 transition-all outline-none text-slate-800"
              />
            </div>
            <span className="text-slate-500 font-medium">
              Alumnos: <strong className="text-slate-800 font-mono">{filteredRows.length}</strong> de {students.length}
            </span>
          </div>

          {/* Student Attendance List with 4 Circular Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
            {loadingAttendance ? (
              <div className="py-16 text-center text-xs text-slate-500 font-mono">
                <Loader2 className="w-6 h-6 text-[#1F5FA8] animate-spin mx-auto mb-2" />
                Cargando lista de asistencia...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 font-medium">
                {searchQuery
                  ? 'No se encontraron alumnos con el criterio de búsqueda.'
                  : 'No hay alumnos matriculados activos en esta sección.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredRows.map(({ student, record, optimisticStatus, justificationInput, isSaving }) => {
                  const isJustificado = optimisticStatus === 'justificado';

                  return (
                    <div
                      key={student.id}
                      className="p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs rounded-2xl bg-white border border-slate-200 shadow-2xs hover:bg-slate-50/60"
                    >
                      {/* Left: Student Avatar + Identity and Registered Info */}
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                        <StudentAvatar
                          student={student}
                          status={optimisticStatus}
                          signedUrl={avatarUrls[student.id]}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#0B2A5B] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                              {student.code}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">
                              {student.first_names} {student.last_names}
                            </span>
                          </div>

                        {/* Status, method and time indicator */}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>
                            Estado actual:{' '}
                            <strong
                              className={`capitalize font-bold ${
                                optimisticStatus === 'presente'
                                  ? 'text-emerald-700'
                                  : optimisticStatus === 'tardanza'
                                  ? 'text-amber-700'
                                  : optimisticStatus === 'falta'
                                  ? 'text-red-700'
                                  : optimisticStatus === 'justificado'
                                  ? 'text-slate-700'
                                  : 'text-slate-400'
                              }`}
                            >
                              {optimisticStatus === 'sin_registrar' ? 'Sin registrar' : optimisticStatus}
                            </strong>
                          </span>

                          {record?.registered_at && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>
                                Método: <strong className="font-semibold text-slate-800">{getMethodLabel(record.method)}</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span>
                                Hora: <strong className="font-mono text-slate-700">{formatLimaTime(record.registered_at)}</strong>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Justification input if status is 'justificado' */}
                        {isJustificado && (
                          <div className="mt-2.5 max-w-md animate-in fade-in">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Motivo de justificación (médica / laboral / institucional):
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Ej: Certificado médico presentado..."
                                value={justificationInput || ''}
                                onChange={(e) => handleJustificationChange(student.id, e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs text-slate-800 font-medium bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#1F5FA8] outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSetAttendance(student.id, 'justificado')}
                                disabled={isSaving}
                                className="px-3 py-1.5 bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white text-[11px] font-bold rounded-lg shrink-0 cursor-pointer shadow-xs transition-all"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                      {/* Right: 4 Controles Circulares de Estado (Componente Reutilizable) */}
                      <AttendanceStatusButtonGroup
                        currentStatus={optimisticStatus}
                        savingStatus={savingTargetStatus[student.id]}
                        isAnimated={Boolean(animatedStudentIds[student.id])}
                        size="md"
                        className="self-end sm:self-auto shrink-0"
                        onSelectStatus={(status) => handleSetAttendance(student.id, status)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Session Attendance History Table */}
          {attendanceRecords.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#1F5FA8]" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Historial de Marcaciones de la Sesión ({attendanceRecords.length})
                </h4>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3">Alumno</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Método</th>
                        <th className="px-4 py-3">Hora de Registro</th>
                        <th className="px-4 py-3">Justificación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {attendanceRecords.map((r) => {
                        const studentObj = students.find((s) => s.id === r.student_id);
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-2.5 font-bold text-slate-900">
                              {studentObj ? `${studentObj.first_names} ${studentObj.last_names}` : r.student_id}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 border border-slate-200 text-slate-800">{r.status}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              <span className="font-semibold text-slate-800">{getMethodLabel(r.method)}</span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-600">
                              {r.registered_at ? formatLimaTime(r.registered_at) : '-'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate font-medium">
                              {r.justification || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
