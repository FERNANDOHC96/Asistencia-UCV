import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Users,
  Calendar,
  Clock,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ChevronRight,
  Plus,
  Trash2,
  QrCode,
  Edit3,
  Layers,
  FlaskConical,
  X,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { CourseOverview, Schedule, ClassSession, SessionKind, Profile } from '../../types';
import { fetchProfilesMapByIds, ProfileBasicInfo } from '../../lib/profileHelper';
import { getTodayLima, formatDisplayDate, formatTime } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { TeacherQrAttendanceScreen } from './TeacherQrAttendanceScreen';
import { TeacherAttendanceScreen } from './TeacherAttendanceScreen';
import { StudentAvatar } from '../StudentAvatar';
import { useStudentAvatarUrls } from '../../lib/avatarCache';

const WEEKDAYS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

type TeacherCourseTab = 'horario' | 'sesiones' | 'asistencia' | 'asistencia_manual' | 'alumnos';

export const TeacherCoursesScreen: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseOverview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCourse, setSelectedCourse] = useState<CourseOverview | null>(null);
  const [activeTab, setActiveTab] = useState<TeacherCourseTab>('horario');

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

  const [newWeekday, setNewWeekday] = useState<number>(1);
  const [newKind, setNewKind] = useState<SessionKind>('teoria');
  const [newStartsAt, setNewStartsAt] = useState<string>('08:00');
  const [newEndsAt, setNewEndsAt] = useState<string>('10:00');
  const [newRoom, setNewRoom] = useState<string>('');
  const [isAddingSchedule, setIsAddingSchedule] = useState<boolean>(false);
  const [savingSchedule, setSavingSchedule] = useState<boolean>(false);

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsSuccess, setSessionsSuccess] = useState<string | null>(null);

  const [isSingleDayModalOpen, setIsSingleDayModalOpen] = useState<boolean>(false);
  const [singleDate, setSingleDate] = useState<string>(getTodayLima());
  const [singleTopic, setSingleTopic] = useState<string>('');
  const [singleLoading, setSingleLoading] = useState<boolean>(false);
  const [singleError, setSingleError] = useState<string | null>(null);

  const [isMultiDayModalOpen, setIsMultiDayModalOpen] = useState<boolean>(false);
  const [rangeFrom, setRangeFrom] = useState<string>(getTodayLima());
  const [rangeTo, setRangeTo] = useState<string>(getTodayLima());
  const [rangeTopic, setRangeTopic] = useState<string>('');
  const [rangeLoading, setRangeLoading] = useState<boolean>(false);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [isManualSessionModalOpen, setIsManualSessionModalOpen] = useState<boolean>(false);
  const [manualDate, setManualDate] = useState<string>(getTodayLima());
  const [manualStartsAt, setManualStartsAt] = useState<string>('08:00');
  const [manualEndsAt, setManualEndsAt] = useState<string>('10:00');
  const [manualKind, setManualKind] = useState<SessionKind>('teoria');
  const [manualTopic, setManualTopic] = useState<string>('');
  const [manualLoading, setManualLoading] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [students, setStudents] = useState<{ id: string; enrolled_at?: string; profile?: ProfileBasicInfo }[]>([]);
  const [studentsLoading, setStudentsLoading] = useState<boolean>(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const studentProfiles = useMemo(
    () => students.map((s) => s.profile).filter((p): p is ProfileBasicInfo => Boolean(p)),
    [students]
  );
  const avatarUrls = useStudentAvatarUrls(studentProfiles);

  const fetchTeacherCourses = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: sbError } = await supabase
        .from('course_overview')
        .select('*')
        .eq('teacher_id', user.id)
        .order('name', { ascending: true });

      if (sbError) throw sbError;

      setCourses(data || []);
      if (selectedCourse) {
        const refreshed = (data || []).find((c) => c.section_id === selectedCourse.section_id);
        if (refreshed) {
          setSelectedCourse(refreshed);
        }
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [user, selectedCourse?.section_id]);

  useEffect(() => {
    fetchTeacherCourses();
  }, [user]);

  const fetchSchedules = useCallback(async (sectionId: string) => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: sbErr } = await supabase
        .from('schedules')
        .select('*')
        .eq('section_id', sectionId)
        .is('archived_at', null)
        .order('weekday', { ascending: true })
        .order('starts_at', { ascending: true });

      if (sbErr) throw sbErr;
      setSchedules(data || []);
    } catch (err: any) {
      setScheduleError(translateSupabaseError(err));
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const fetchSessions = useCallback(async (sectionId: string) => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: sbErr } = await supabase
        .from('class_sessions')
        .select('id, section_id, session_date, starts_at, ends_at, topic, status, kind, archived_at')
        .eq('section_id', sectionId)
        .is('archived_at', null)
        .order('session_date', { ascending: false })
        .order('starts_at', { ascending: true });

      if (sbErr) throw sbErr;
      setSessions(data || []);
    } catch (err: any) {
      setSessionsError(translateSupabaseError(err));
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const fetchStudents = useCallback(async (sectionId: string) => {
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      const supabase = getSupabaseClient();
      const { data: enrData, error: enrErr } = await supabase
        .from('enrollments')
        .select('id, student_id, enrolled_at, status')
        .eq('section_id', sectionId)
        .eq('status', 'activa')
        .order('enrolled_at', { ascending: false });

      if (enrErr) throw enrErr;

      const studentIds = (enrData || []).map((e) => e.student_id);
      const profilesMap = await fetchProfilesMapByIds(studentIds);

      const resolved = (enrData || []).map((e) => ({
        id: e.id,
        enrolled_at: e.enrolled_at,
        profile: profilesMap[e.student_id],
      }));

      setStudents(resolved);
    } catch (err: any) {
      setStudentsError(translateSupabaseError(err));
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    if (activeTab === 'horario') {
      fetchSchedules(selectedCourse.section_id);
    } else if (activeTab === 'sesiones') {
      fetchSessions(selectedCourse.section_id);
    } else if (activeTab === 'alumnos') {
      fetchStudents(selectedCourse.section_id);
    }
  }, [selectedCourse?.section_id, activeTab]);

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setScheduleError(null);
    setScheduleSuccess(null);

    if (newEndsAt <= newStartsAt) {
      setScheduleError('La hora de fin debe ser posterior a la de inicio.');
      return;
    }

    setSavingSchedule(true);
    try {
      const supabase = getSupabaseClient();
      const { error: insErr } = await supabase.from('schedules').insert({
        section_id: selectedCourse.section_id,
        weekday: Number(newWeekday),
        kind: newKind,
        starts_at: newStartsAt,
        ends_at: newEndsAt,
        room: newRoom.trim() || null,
      });

      if (insErr) {
        if (insErr.code === '23514') {
          setScheduleError('La hora de fin debe ser posterior a la de inicio.');
        } else if (insErr.code === '42501') {
          setScheduleError('No tienes permisos para modificar el horario.');
        } else {
          setScheduleError(translateSupabaseError(insErr));
        }
        return;
      }

      setScheduleSuccess('Franja horaria guardada con éxito.');
      setIsAddingSchedule(false);
      setNewRoom('');
      await fetchSchedules(selectedCourse.section_id);
    } catch (err: any) {
      setScheduleError(translateSupabaseError(err));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!selectedCourse) return;
    setScheduleError(null);
    setScheduleSuccess(null);

    try {
      const supabase = getSupabaseClient();

      const { error: delErr } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId);

      if (delErr) {
        if (delErr.code === '42501') {
          setScheduleError('No tienes permisos para modificar el horario.');
        } else {
          setScheduleError(translateSupabaseError(delErr));
        }
        return;
      }

      setScheduleSuccess('Franja horaria eliminada.');
      await fetchSchedules(selectedCourse.section_id);
    } catch (err: any) {
      setScheduleError(translateSupabaseError(err));
    }
  };

  const handleCreateSingleDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setSingleError(null);
    setSingleLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data: res, error: rpcErr } = await supabase.rpc('create_class_days', {
        p_section: selectedCourse.section_id,
        p_from: singleDate,
        p_to: null,
        p_topic: singleTopic.trim() || null,
      });

      if (rpcErr) throw rpcErr;

      const code = typeof res === 'string' ? res : res?.code;

      if (code === 'success') {
        const createdCount = res?.created ?? 0;
        const existingCount = res?.existing ?? 0;
        setSessionsSuccess(`Día de clase generado: ${createdCount} sesión(es) creada(s)${existingCount > 0 ? `, ${existingCount} ya existían` : ''}.`);
        setIsSingleDayModalOpen(false);
        setSingleTopic('');
        await fetchSessions(selectedCourse.section_id);
      } else if (code === 'no_schedule') {
        setSingleError('No hay franjas de horario configuradas para este día de la semana. Configúralas primero en la pestaña Horario.');
      } else if (code === 'unauthorized') {
        setSingleError('No tienes permisos de docente en esta sección.');
      } else if (code === 'invalid_dates') {
        setSingleError('Las fechas especificadas no son válidas.');
      } else if (code === 'range_too_long') {
        setSingleError('El rango de fechas es demasiado largo.');
      } else if (code === 'invalid_section') {
        setSingleError('Sección no válida.');
      } else {
        setSingleError(typeof res === 'string' ? res : res?.message || 'Error al generar día de clase.');
      }
    } catch (err: any) {
      setSingleError(translateSupabaseError(err));
    } finally {
      setSingleLoading(false);
    }
  };

  const handleCreateMultiDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setRangeError(null);
    setRangeLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data: res, error: rpcErr } = await supabase.rpc('create_class_days', {
        p_section: selectedCourse.section_id,
        p_from: rangeFrom,
        p_to: rangeTo,
        p_topic: rangeTopic.trim() || null,
      });

      if (rpcErr) throw rpcErr;

      const code = typeof res === 'string' ? res : res?.code;

      if (code === 'success') {
        const createdCount = res?.created ?? 0;
        const existingCount = res?.existing ?? 0;
        setSessionsSuccess(`Días de clase generados: ${createdCount} sesión(es) creada(s)${existingCount > 0 ? `, ${existingCount} ya existían` : ''}.`);
        setIsMultiDayModalOpen(false);
        setRangeTopic('');
        await fetchSessions(selectedCourse.section_id);
      } else if (code === 'no_schedule') {
        setRangeError('No se encontraron franjas de horario para los días del rango seleccionado.');
      } else if (code === 'unauthorized') {
        setRangeError('No tienes permisos de docente en esta sección.');
      } else if (code === 'invalid_dates') {
        setRangeError('Las fechas especificadas no son válidas (la fecha final debe ser posterior a la inicial).');
      } else if (code === 'range_too_long') {
        setRangeError('El rango de fechas es demasiado largo.');
      } else if (code === 'invalid_section') {
        setRangeError('Sección no válida.');
      } else {
        setRangeError(typeof res === 'string' ? res : res?.message || 'Error al generar días de clase.');
      }
    } catch (err: any) {
      setRangeError(translateSupabaseError(err));
    } finally {
      setRangeLoading(false);
    }
  };

  const handleCreateManualSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setManualError(null);

    if (manualEndsAt <= manualStartsAt) {
      setManualError('La hora de fin debe ser posterior a la de inicio.');
      return;
    }

    setManualLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error: insErr } = await supabase.from('class_sessions').insert({
        section_id: selectedCourse.section_id,
        session_date: manualDate,
        starts_at: manualStartsAt,
        ends_at: manualEndsAt,
        topic: manualTopic.trim() || 'Sesión de clase',
        kind: manualKind,
        status: 'programada',
      });

      if (insErr) throw insErr;

      setSessionsSuccess('Sesión manual creada exitosamente.');
      setIsManualSessionModalOpen(false);
      setManualTopic('');
      await fetchSessions(selectedCourse.section_id);
    } catch (err: any) {
      setManualError(translateSupabaseError(err));
    } finally {
      setManualLoading(false);
    }
  };

  if (selectedCourse) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <button
                onClick={() => setSelectedCourse(null)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="Volver a Mis Cursos"
              >
                <ArrowLeft className="w-5 h-5 text-[#0B2A5B]" />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#1F5FA8]">
                    {selectedCourse.code}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    Sección {selectedCourse.section_name}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  {selectedCourse.name}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Estudiantes matriculados: <strong className="text-slate-700">{selectedCourse.students ?? 0}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-3 flex flex-wrap items-center gap-2">

            <button
              onClick={() => setActiveTab('horario')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'horario'
                  ? 'bg-[#1F5FA8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>1. Horario</span>
            </button>

            <button
              onClick={() => setActiveTab('sesiones')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'sesiones'
                  ? 'bg-[#1F5FA8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>2. Sesiones</span>
            </button>

            <button
              onClick={() => setActiveTab('asistencia')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'asistencia'
                  ? 'bg-[#1F5FA8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>3. Asistencia</span>
            </button>

            <button
              onClick={() => setActiveTab('asistencia_manual')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'asistencia_manual'
                  ? 'bg-[#1F5FA8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>4. Asistencia manual</span>
            </button>

            <button
              onClick={() => setActiveTab('alumnos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'alumnos'
                  ? 'bg-[#1F5FA8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>5. Alumnos</span>
            </button>
          </div>
        </div>

        {activeTab === 'horario' && (
          <div className="space-y-5">

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
              <Info className="w-5 h-5 text-[#1F5FA8] shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900">
                <p className="font-bold">Configuración de Franjas Horarias</p>
                <p className="mt-0.5">
                  Cada día de clase se genera a partir de estas franjas. Ejemplo: Teoría 06:10 a 08:00 y Práctica 08:30 a 10:30.
                </p>
              </div>
            </div>

            {scheduleSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span>{scheduleSuccess}</span>
                <button onClick={() => setScheduleSuccess(null)} className="cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {scheduleError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span>{scheduleError}</span>
                <button onClick={() => setScheduleError(null)} className="cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1F5FA8]" />
                  <span>Franjas Horarias de la Sección ({schedules.length})</span>
                </h2>

                <button
                  onClick={() => setIsAddingSchedule(!isAddingSchedule)}
                  className="px-3.5 py-2 bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingSchedule ? 'Cerrar formulario' : 'Añadir franja horaria'}</span>
                </button>
              </div>

              {isAddingSchedule && (
                <form
                  onSubmit={handleSaveSchedule}
                  className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                >
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Nueva Franja Horaria
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Día *
                      </label>
                      <select
                        value={newWeekday}
                        onChange={(e) => setNewWeekday(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      >
                        {Object.entries(WEEKDAYS).map(([num, name]) => (
                          <option key={num} value={num}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Tipo *
                      </label>
                      <select
                        value={newKind}
                        onChange={(e) => setNewKind(e.target.value as SessionKind)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      >
                        <option value="teoria">Teoría</option>
                        <option value="practica">Práctica</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Inicio *
                      </label>
                      <input
                        type="time"
                        required
                        value={newStartsAt}
                        onChange={(e) => setNewStartsAt(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Fin *
                      </label>
                      <input
                        type="time"
                        required
                        value={newEndsAt}
                        onChange={(e) => setNewEndsAt(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Aula (opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Pab. B-302"
                        value={newRoom}
                        onChange={(e) => setNewRoom(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingSchedule(false)}
                      className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingSchedule}
                      className="px-4 py-2 bg-[#1F5FA8] hover:bg-[#0B2A5B] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>Guardar franja</span>
                    </button>
                  </div>
                </form>
              )}

              {scheduleLoading ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1F5FA8] mb-2" />
                  <span className="text-xs">Cargando horario...</span>
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Sin franjas horarias configuradas</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Añade los días y horas de clase para generar automáticamente los días de clase.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Día</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Horario</th>
                        <th className="py-2.5 px-3">Aula</th>
                        <th className="py-2.5 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedules.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {WEEKDAYS[s.weekday] || `Día ${s.weekday}`}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                s.kind === 'practica'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                              }`}
                            >
                              {s.kind === 'practica' ? (
                                <FlaskConical className="w-2.5 h-2.5" />
                              ) : (
                                <BookOpen className="w-2.5 h-2.5" />
                              )}
                              <span>{s.kind === 'practica' ? 'Práctica' : 'Teoría'}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#1F5FA8]">
                            {s.starts_at?.slice(0, 5)} - {s.ends_at?.slice(0, 5)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {s.room || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleDeleteSchedule(s.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar franja horaria"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sesiones' && (
          <div className="space-y-5">

            {sessionsSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span>{sessionsSuccess}</span>
                <button onClick={() => setSessionsSuccess(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {sessionsError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span>{sessionsError}</span>
                <button onClick={() => setSessionsError(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#1F5FA8]" />
                    <span>Sesiones del Curso ({sessions.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Genera las sesiones de clase a partir del horario semanal configurado.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setSingleDate(getTodayLima());
                      setSingleTopic('');
                      setSingleError(null);
                      setIsSingleDayModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear día de clase</span>
                  </button>

                  <button
                    onClick={() => {
                      setRangeFrom(getTodayLima());
                      setRangeTo(getTodayLima());
                      setRangeTopic('');
                      setRangeError(null);
                      setIsMultiDayModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-[#1F5FA8]" />
                    <span>Crear varios días</span>
                  </button>

                  <button
                    onClick={() => {
                      setManualDate(getTodayLima());
                      setManualStartsAt('08:00');
                      setManualEndsAt('10:00');
                      setManualTopic('');
                      setManualError(null);
                      setIsManualSessionModalOpen(true);
                    }}
                    className="px-2.5 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="Crear sesión manual individual"
                  >
                    + Manual
                  </button>
                </div>
              </div>

              {sessionsLoading ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1F5FA8] mb-2" />
                  <span className="text-xs">Cargando sesiones...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Sin sesiones programadas</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pulsa &quot;Crear día de clase&quot; para generar automáticamente las sesiones del día a partir de tu horario.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Horario</th>
                        <th className="py-2.5 px-3">Tema</th>
                        <th className="py-2.5 px-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessions.map((sess) => (
                        <tr key={sess.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                sess.kind === 'practica'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                              }`}
                            >
                              {sess.kind === 'practica' ? (
                                <FlaskConical className="w-2.5 h-2.5" />
                              ) : (
                                <BookOpen className="w-2.5 h-2.5" />
                              )}
                              <span>{sess.kind === 'practica' ? 'Práctica' : 'Teoría'}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">
                            {formatDisplayDate(sess.session_date)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#1F5FA8]">
                            {sess.starts_at?.slice(0, 5)} - {sess.ends_at?.slice(0, 5)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 font-medium">
                            {sess.topic || 'Sesión de clase'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                sess.status === 'abierta'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : sess.status === 'cerrada'
                                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                                  : sess.status === 'cancelada'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                              }`}
                            >
                              {sess.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {isSingleDayModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
                <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#1F5FA8]" />
                      <h3 className="text-sm font-bold text-slate-900">Crear Día de Clase</h3>
                    </div>
                    <button onClick={() => setIsSingleDayModalOpen(false)}>
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  {singleError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
                      {singleError}
                    </div>
                  )}

                  <form onSubmit={handleCreateSingleDay} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Fecha del Día *
                      </label>
                      <input
                        type="date"
                        required
                        value={singleDate}
                        onChange={(e) => setSingleDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Se crearán las sesiones de teoría y práctica según el horario de ese día.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Tema (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Introducción y arquitectura"
                        value={singleTopic}
                        onChange={(e) => setSingleTopic(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsSingleDayModalOpen(false)}
                        className="flex-1 py-2 px-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={singleLoading}
                        className="flex-1 py-2 px-3 bg-[#1F5FA8] hover:bg-[#0B2A5B] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {singleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        <span>Crear día</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {isMultiDayModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
                <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#1F5FA8]" />
                      <h3 className="text-sm font-bold text-slate-900">Crear Varios Días</h3>
                    </div>
                    <button onClick={() => setIsMultiDayModalOpen(false)}>
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  {rangeError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
                      {rangeError}
                    </div>
                  )}

                  <form onSubmit={handleCreateMultiDay} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Desde (Fecha inicio) *
                      </label>
                      <input
                        type="date"
                        required
                        value={rangeFrom}
                        onChange={(e) => setRangeFrom(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Hasta (Fecha fin) *
                      </label>
                      <input
                        type="date"
                        required
                        value={rangeTo}
                        onChange={(e) => setRangeTo(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Tema General (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Sesión regular de clases"
                        value={rangeTopic}
                        onChange={(e) => setRangeTopic(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsMultiDayModalOpen(false)}
                        className="flex-1 py-2 px-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={rangeLoading}
                        className="flex-1 py-2 px-3 bg-[#1F5FA8] hover:bg-[#0B2A5B] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {rangeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        <span>Crear rango</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {isManualSessionModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
                <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-5 h-5 text-[#1F5FA8]" />
                      <h3 className="text-sm font-bold text-slate-900">Nueva Sesión Manual</h3>
                    </div>
                    <button onClick={() => setIsManualSessionModalOpen(false)}>
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  {manualError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
                      {manualError}
                    </div>
                  )}

                  <form onSubmit={handleCreateManualSession} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Fecha *
                      </label>
                      <input
                        type="date"
                        required
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Inicio *
                        </label>
                        <input
                          type="time"
                          required
                          value={manualStartsAt}
                          onChange={(e) => setManualStartsAt(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Fin *
                        </label>
                        <input
                          type="time"
                          required
                          value={manualEndsAt}
                          onChange={(e) => setManualEndsAt(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Tipo *
                      </label>
                      <select
                        value={manualKind}
                        onChange={(e) => setManualKind(e.target.value as SessionKind)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                      >
                        <option value="teoria">Teoría</option>
                        <option value="practica">Práctica</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Tema *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Recuperación de clase"
                        value={manualTopic}
                        onChange={(e) => setManualTopic(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsManualSessionModalOpen(false)}
                        className="flex-1 py-2 px-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={manualLoading}
                        className="flex-1 py-2 px-3 bg-[#1F5FA8] hover:bg-[#0B2A5B] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {manualLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        <span>Crear sesión</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'asistencia' && (
          <TeacherQrAttendanceScreen presetSectionId={selectedCourse.section_id} />
        )}

        {activeTab === 'asistencia_manual' && (
          <TeacherAttendanceScreen presetSectionId={selectedCourse.section_id} />
        )}

        {activeTab === 'alumnos' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#1F5FA8]" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Alumnos Matriculados ({students.length})
                </h2>
              </div>
              <button
                onClick={() => fetchStudents(selectedCourse.section_id)}
                disabled={studentsLoading}
                className="text-xs text-slate-500 hover:text-[#1F5FA8] flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${studentsLoading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>

            {studentsError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold">
                {studentsError}
              </div>
            )}

            {studentsLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-[#1F5FA8] mb-2" />
                <span className="text-xs">Cargando alumnos...</span>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Sin alumnos matriculados en esta sección</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  El administrador es el responsable de matricular a los estudiantes en el curso.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-14">Foto</th>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Nombre Completo del Alumno</th>
                      <th className="py-2.5 px-3 text-right">Fecha de Matrícula</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          {st.profile ? (
                            <StudentAvatar
                              student={st.profile}
                              signedUrl={avatarUrls[st.profile.id]}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 ring-2 ring-slate-200 flex items-center justify-center font-bold text-xs text-slate-400">
                              --
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {st.profile?.code || '--'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {st.profile ? `${st.profile.last_names}, ${st.profile.first_names}` : 'Estudiante sin perfil'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 font-mono text-[11px]">
                          {st.enrolled_at ? formatDisplayDate(st.enrolled_at.slice(0, 10)) : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#1F5FA8]" />
            <span>Mis Cursos</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Selecciona un curso para gestionar su horario, crear los días de clase y registrar asistencia.
          </p>
        </div>

        <button
          onClick={fetchTeacherCourses}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-[#1F5FA8] hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#1F5FA8] mb-3" />
          <span className="text-xs font-semibold">Cargando tus cursos asignados...</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">
            Todavía no tienes cursos asignados. Pide al administrador que te asigne uno.
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Cuando el administrador te asigne una sección, podrás verla aquí y gestionar todo su ciclo académico.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c) => (
            <div
              key={c.section_id}
              onClick={() => {
                setSelectedCourse(c);
                setActiveTab('horario');
              }}
              className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all p-5 flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#1F5FA8]">
                    {c.code}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Secc. {c.section_name}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-[#1F5FA8] transition-colors mb-2">
                  {c.name}
                </h3>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{c.students ?? 0} estudiantes</span>
                </span>
                <span className="font-bold text-[#1F5FA8] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Entrar al curso</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
