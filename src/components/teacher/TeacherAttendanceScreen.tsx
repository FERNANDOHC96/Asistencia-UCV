import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserCheck, Clock, XCircle, FileText, HelpCircle, Search, RefreshCw, AlertCircle, CheckCircle2, Loader2, Check, AlertTriangle, History, BookOpen, FlaskConical } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getTeacherSections, getSectionActiveStudents, TeacherSection } from '../../services/teacherService';
import { ClassSession, LearningUnit, AcademicWeek, AttendanceRecord, AttendanceStatus, Profile } from '../../types';
import { formatDisplayDate, formatTime } from '../../lib/dateUtils';
import { translateSupabaseError, translateAttendanceRpcError } from '../../lib/supabaseErrors';

interface StudentAttendanceRow {
  student: Profile;
  record?: AttendanceRecord;
  optimisticStatus?: AttendanceStatus | 'sin_registrar';
  justificationInput?: string;
  isSaving?: boolean;
}

export const TeacherAttendanceScreen: React.FC = () => {
  const { user } = useAuth();
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

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
      if (data.length > 0 && !selectedSectionId) {
        setSelectedSectionId(data[0].id);
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
    } finally {
      setLoadingSections(false);
    }
  }, [user, selectedSectionId]);

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

    // Optimistic update
    setAttendanceRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        optimisticStatus: targetStatus,
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
        // Revert row state
        setAttendanceRows((prev) => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            optimisticStatus: previousStatus,
            isSaving: false,
          },
        }));
        setActionFeedback({ type: 'error', message: `${currentRow.student.first_names}: ${translatedMsg}` });
        return;
      }

      // Success
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
      // Revert on exception
      setAttendanceRows((prev) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          optimisticStatus: previousStatus,
          isSaving: false,
        },
      }));
      const msg = err instanceof Error ? err.message : 'Error inesperado al invocar set_attendance.';
      setActionFeedback({ type: 'error', message: msg });
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1F5FA8] flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
              Registro de Asistencia Manual
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Control de asistencia por sesión con persistencia mediante función oficial institucional
          </p>
        </div>

        <button
          onClick={() => {
            fetchSections();
            fetchSessionAttendance();
          }}
          disabled={loadingSections || loadingAttendance}
          className="self-start sm:self-auto px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-[#1F5FA8] hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingAttendance ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Selectors Bar in Cascade */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          1. Selección de Sesión de Clase
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* 1. Sección */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Sección *</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={sections.length === 0}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] bg-white font-mono text-slate-900 truncate"
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
            <label className="block text-slate-500 font-medium mb-1">Tipo de Clase</label>
            <select
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value as 'all' | 'teoria' | 'practica')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] bg-white text-slate-900 truncate"
            >
              <option value="all">Todas (Teoría / Práctica)</option>
              <option value="teoria">Teoría</option>
              <option value="practica">Práctica</option>
            </select>
          </div>

          {/* 3. Unidad (Opcional) */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Unidad (Opcional)</label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              disabled={units.length === 0}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] bg-white text-slate-900 truncate"
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
            <label className="block text-slate-500 font-medium mb-1">Semana (Opcional)</label>
            <select
              value={selectedWeekId}
              onChange={(e) => setSelectedWeekId(e.target.value)}
              disabled={weeks.length === 0}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] bg-white text-slate-900 truncate"
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
            <label className="block text-slate-500 font-medium mb-1">Sesión de Clase *</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              disabled={filteredSessions.length === 0}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] bg-white font-mono text-slate-900 font-semibold truncate disabled:bg-slate-100"
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
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
          Selecciona una sección y una sesión de clase programada para registrar y consultar asistencias.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Session Banner and Summary Metrics */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Sesión Activa
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold border px-2.5 py-0.5 rounded-full ${
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
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                  <span>📅 {formatDisplayDate(currentSession?.session_date || '')}</span>
                  <span>•</span>
                  <span>⏰ {formatTime(currentSession?.starts_at)} a {formatTime(currentSession?.ends_at)}</span>
                  <span>•</span>
                  <span className="capitalize font-semibold text-slate-700">Estado: {currentSession?.status}</span>
                </div>
              </div>

              {/* Status Warning */}
              {currentSession?.status === 'cerrada' && (
                <span className="px-3 py-1 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                  Sesión cerrada
                </span>
              )}
              {currentSession?.status === 'cancelada' && (
                <span className="px-3 py-1 text-xs font-bold bg-red-50 text-red-700 rounded-lg border border-red-200">
                  Sesión cancelada
                </span>
              )}
            </div>

            {/* Real Summary Bar with Total Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-center">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Matriculados</span>
                <span className="text-lg font-extrabold text-slate-900 font-mono">{summary.total}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900">
                <span className="text-[10px] uppercase font-bold block">Presentes</span>
                <span className="text-lg font-extrabold font-mono text-emerald-700">{summary.presentes}</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                <span className="text-[10px] uppercase font-bold block">Tardanzas</span>
                <span className="text-lg font-extrabold font-mono text-amber-700">{summary.tardanzas}</span>
              </div>
              <div className="p-2.5 bg-red-50 rounded-xl border border-red-200 text-red-900">
                <span className="text-[10px] uppercase font-bold block">Faltas</span>
                <span className="text-lg font-extrabold font-mono text-red-700">{summary.faltas}</span>
              </div>
              <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-300 text-slate-800">
                <span className="text-[10px] uppercase font-bold block">Justificados</span>
                <span className="text-lg font-extrabold font-mono text-slate-700">{summary.justificados}</span>
              </div>
              <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-200 text-blue-900">
                <span className="text-[10px] uppercase font-bold block">Sin Registrar</span>
                <span className="text-lg font-extrabold font-mono text-blue-800">{summary.sinRegistrar}</span>
              </div>
            </div>
          </div>

          {/* Search Filter */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 flex items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar alumno por código o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8]"
              />
            </div>
            <span className="text-slate-500 font-medium">
              Alumnos: <strong className="text-slate-800">{filteredRows.length}</strong> de {students.length}
            </span>
          </div>

          {/* Student Attendance List with 4 Circular Controls */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            {loadingAttendance ? (
              <div className="py-16 text-center text-xs text-slate-500">
                <Loader2 className="w-6 h-6 text-[#1F5FA8] animate-spin mx-auto mb-2" />
                Cargando lista de asistencia...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                {searchQuery
                  ? 'No se encontraron alumnos con el criterio de búsqueda.'
                  : 'No hay alumnos matriculados activos en esta sección.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredRows.map(({ student, record, optimisticStatus, justificationInput, isSaving }) => {
                  const isJustificado = optimisticStatus === 'justificado';

                  return (
                    <div
                      key={student.id}
                      className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      {/* Left: Student Identity and Registered Info */}
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
                              className={`capitalize ${
                                optimisticStatus === 'presente'
                                  ? 'text-emerald-700'
                                  : optimisticStatus === 'tardanza'
                                  ? 'text-amber-700'
                                  : optimisticStatus === 'falta'
                                  ? 'text-red-700'
                                  : optimisticStatus === 'justificado'
                                  ? 'text-slate-700'
                                  : 'text-blue-800'
                              }`}
                            >
                              {optimisticStatus === 'sin_registrar' ? 'Sin registrar' : optimisticStatus}
                            </strong>
                          </span>

                          {record?.registered_at && (
                            <>
                              <span>•</span>
                              <span>
                                Método: <strong className="uppercase font-mono text-slate-700">{record.method}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Hora: <strong className="font-mono text-slate-700">{new Date(record.registered_at).toLocaleTimeString()}</strong>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Justification input if status is 'justificado' */}
                        {isJustificado && (
                          <div className="mt-2.5 max-w-md animate-in fade-in">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                              Motivo de justificación (médica / laboral / institucional):
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Ej: Certificado médico presentado..."
                                value={justificationInput || ''}
                                onChange={(e) => handleJustificationChange(student.id, e.target.value)}
                                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
                              />
                              <button
                                type="button"
                                onClick={() => handleSetAttendance(student.id, 'justificado')}
                                disabled={isSaving}
                                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold shrink-0 cursor-pointer"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: 4 Circular Controls with Icon and Text */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isSaving ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#1F5FA8] font-semibold bg-blue-50 rounded-lg border border-blue-200">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Guardando...</span>
                          </div>
                        ) : (
                          <>
                            {/* 1. Presente (Verde) */}
                            <button
                              type="button"
                              onClick={() => handleSetAttendance(student.id, 'presente')}
                              title="Marcar Presente"
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                                optimisticStatus === 'presente'
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs ring-2 ring-emerald-200'
                                  : 'bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Presente</span>
                            </button>

                            {/* 2. Tardanza (Ámbar) */}
                            <button
                              type="button"
                              onClick={() => handleSetAttendance(student.id, 'tardanza')}
                              title="Marcar Tardanza"
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                                optimisticStatus === 'tardanza'
                                  ? 'bg-amber-500 border-amber-500 text-white shadow-xs ring-2 ring-amber-200'
                                  : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Tardanza</span>
                            </button>

                            {/* 3. Falta (Rojo) */}
                            <button
                              type="button"
                              onClick={() => handleSetAttendance(student.id, 'falta')}
                              title="Marcar Falta"
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                                optimisticStatus === 'falta'
                                  ? 'bg-red-600 border-red-600 text-white shadow-xs ring-2 ring-red-200'
                                  : 'bg-white border-red-200 text-red-800 hover:bg-red-50'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Falta</span>
                            </button>

                            {/* 4. Justificado (Azul Grisáceo) */}
                            <button
                              type="button"
                              onClick={() => handleSetAttendance(student.id, 'justificado')}
                              title="Marcar Justificado"
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                                optimisticStatus === 'justificado'
                                  ? 'bg-slate-700 border-slate-700 text-white shadow-xs ring-2 ring-slate-300'
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Justificado</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Session Attendance History Table */}
          {attendanceRecords.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#1F5FA8]" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Historial de Marcaciones de la Sesión ({attendanceRecords.length})
                </h4>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Alumno</th>
                      <th className="px-4 py-2.5">Estado</th>
                      <th className="px-4 py-2.5">Método</th>
                      <th className="px-4 py-2.5">Hora de Registro</th>
                      <th className="px-4 py-2.5">Justificación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {attendanceRecords.map((r) => {
                      const studentObj = students.find((s) => s.id === r.student_id);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900">
                            {studentObj ? `${studentObj.first_names} ${studentObj.last_names}` : r.student_id}
                          </td>
                          <td className="px-4 py-2">
                            <span className="font-bold capitalize text-slate-800">{r.status}</span>
                          </td>
                          <td className="px-4 py-2 uppercase font-mono text-[11px] text-slate-500">
                            {r.method}
                          </td>
                          <td className="px-4 py-2 font-mono text-slate-600">
                            {r.registered_at ? new Date(r.registered_at).toLocaleTimeString() : '-'}
                          </td>
                          <td className="px-4 py-2 text-slate-500 max-w-xs truncate">
                            {r.justification || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
