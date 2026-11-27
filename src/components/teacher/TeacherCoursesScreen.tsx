import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Users,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Loader2,
  ChevronRight,
  QrCode,
  Edit3,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { CourseOverview, SectionStudentBlockStatus } from '../../types';
import { fetchProfilesMapByIds, ProfileBasicInfo } from '../../lib/profileHelper';
import { formatDisplayDate } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { TeacherQrAttendanceScreen } from './TeacherQrAttendanceScreen';
import { TeacherAttendanceScreen } from './TeacherAttendanceScreen';
import { StudentAvatar } from '../StudentAvatar';
import { useStudentAvatarUrls } from '../../lib/avatarCache';
import { fetchSectionStudentsBlockStatus } from '../../services/blockService';
import { ActionButton, IconActionButton, SectionIconBadge } from '../ui';

type TeacherCourseTab = 'asistencia' | 'asistencia_manual' | 'alumnos';

interface CourseCardTheme {
  bgImageClass: string;
  cardSurface: string;
  gradientOverlay: string;
  codeBadge: string;
  sectionBadge: string;
  titleColor: string;
  metaText: string;
  buttonClass: string;
  dividerBorder: string;
}

function getCourseCardTheme(courseName: string, courseCode: string): CourseCardTheme {
  const normalized = `${courseName} ${courseCode}`.toLowerCase();

  const isLaw =
    normalized.includes('derecho') ||
    normalized.includes('penal') ||
    normalized.includes('civil') ||
    normalized.includes('constituc') ||
    normalized.includes('jurid') ||
    normalized.includes('procesal') ||
    normalized.includes('abogac');

  if (isLaw) {
    return {
      bgImageClass:
        "bg-[url('/assets/aistudio/Justicia_en_tonos_verdes_4b69c0f4.png')]",
      cardSurface:
        'bg-gradient-to-br from-white via-[#F5FCF8] to-[#E8F8EE] border-emerald-200/90 hover:border-emerald-300 shadow-[0_10px_28px_-12px_rgba(5,150,105,0.2)]',
      gradientOverlay:
        'bg-gradient-to-r from-white via-[#F5FCF8]/90 to-emerald-700/15',
      codeBadge:
        'bg-emerald-50/95 text-emerald-800 border-emerald-200/90',
      sectionBadge:
        'bg-white/95 text-emerald-900 border-emerald-200/80',
      titleColor:
        'text-[#0B2A5B] group-hover:text-emerald-900',
      metaText:
        'text-slate-600',
      buttonClass:
        'bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_6px_16px_-6px_rgba(5,150,105,0.5)]',
      dividerBorder:
        'border-emerald-200/60',
    };
  }

  const isTech =
    normalized.includes('software') ||
    normalized.includes('sistema') ||
    normalized.includes('comput') ||
    normalized.includes('inform') ||
    normalized.includes('program') ||
    normalized.includes('algorit') ||
    normalized.includes('tecnol') ||
    normalized.includes('web') ||
    normalized.includes('inf');

  return {
    bgImageClass: isTech
      ? "bg-[url('/assets/aistudio/Mujer_interactuando_con_hologramas_azules_e51a20c6.png')]"
      : "bg-[url('/assets/aistudio/Innovaci_n_empresarial_azul_y_sostenible_73c59fbc.png')]",
    cardSurface:
      'bg-gradient-to-br from-white via-[#F6FAFF] to-[#EAF2FF] border-blue-200/90 hover:border-blue-300 shadow-[0_10px_28px_-12px_rgba(31,95,168,0.2)]',
    gradientOverlay:
      'bg-gradient-to-r from-white via-[#F6FAFF]/90 to-[#1F5FA8]/15',
    codeBadge:
      'bg-blue-50/95 text-[#154A8A] border-blue-200/90',
    sectionBadge:
      'bg-white/95 text-[#0B2A5B] border-blue-200/80',
    titleColor:
      'text-[#0B2A5B] group-hover:text-[#1F5FA8]',
    metaText:
      'text-slate-600',
    buttonClass:
      'bg-[#1F5FA8] hover:bg-[#174B88] text-white shadow-[0_6px_16px_-6px_rgba(31,95,168,0.5)]',
    dividerBorder:
      'border-blue-200/60',
  };
}

export const TeacherCoursesScreen: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseOverview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCourse, setSelectedCourse] = useState<CourseOverview | null>(null);
  const [activeTab, setActiveTab] = useState<TeacherCourseTab>('asistencia');

  const [students, setStudents] = useState<{ id: string; student_id: string; enrolled_at?: string; profile?: ProfileBasicInfo }[]>([]);
  const [studentsLoading, setStudentsLoading] = useState<boolean>(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [blockStatusMap, setBlockStatusMap] = useState<Record<string, SectionStudentBlockStatus>>({});

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
      const [profilesMap, statusMap] = await Promise.all([
        fetchProfilesMapByIds(studentIds),
        studentIds.length > 0
          ? fetchSectionStudentsBlockStatus(sectionId, studentIds).catch(() => ({}))
          : Promise.resolve({}),
      ]);

      const resolved = (enrData || []).map((e) => ({
        id: e.id,
        student_id: e.student_id,
        enrolled_at: e.enrolled_at,
        profile: profilesMap[e.student_id],
      }));

      setStudents(resolved);
      setBlockStatusMap(statusMap);
    } catch (err: any) {
      setStudentsError(translateSupabaseError(err));
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    if (activeTab === 'alumnos') {
      fetchStudents(selectedCourse.section_id);
    }
  }, [selectedCourse?.section_id, activeTab, fetchStudents]);

  useEffect(() => {
    if (!selectedCourse?.section_id || activeTab !== 'alumnos' || !isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`teacher-course-blocks-${selectedCourse.section_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_section_blocks',
          filter: `section_id=eq.${selectedCourse.section_id}`,
        },
        () => {
          fetchStudents(selectedCourse.section_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCourse?.section_id, activeTab, fetchStudents]);

  if (selectedCourse) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

        <div className="ucv-card rounded-2xl overflow-hidden">
          <div className="h-1 ucv-topbar-split w-full" />
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <IconActionButton
                  icon={ArrowLeft}
                  label="Volver a Mis Cursos"
                  variant="neutral"
                  size="md"
                  tooltipSide="bottom"
                  onClick={() => setSelectedCourse(null)}
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200/85 text-[#1F5FA8]">
                      {selectedCourse.code}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      Sección {selectedCourse.section_name}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B] mt-1 tracking-[-0.02em]">
                    {selectedCourse.name}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Estudiantes matriculados: <strong className="text-[#C8102E] font-mono tabular-nums">{selectedCourse.students ?? 0}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-3.5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTab('asistencia')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                  activeTab === 'asistencia'
                    ? 'bg-[#0B2A5B] text-white shadow-xs border-b-2 border-[#C8102E]'
                    : 'text-slate-600 hover:text-[#0B2A5B] hover:bg-slate-100/90'
                }`}
              >
                <QrCode className="w-4 h-4" strokeWidth={1.85} />
                <span>1. Asistencia</span>
              </button>

              <button
                onClick={() => setActiveTab('asistencia_manual')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                  activeTab === 'asistencia_manual'
                    ? 'bg-[#0B2A5B] text-white shadow-xs border-b-2 border-[#C8102E]'
                    : 'text-slate-600 hover:text-[#0B2A5B] hover:bg-slate-100/90'
                }`}
              >
                <Edit3 className="w-4 h-4" strokeWidth={1.85} />
                <span>2. Asistencia manual</span>
              </button>

              <button
                onClick={() => setActiveTab('alumnos')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                  activeTab === 'alumnos'
                    ? 'bg-[#0B2A5B] text-white shadow-xs border-b-2 border-[#C8102E]'
                    : 'text-slate-600 hover:text-[#0B2A5B] hover:bg-slate-100/90'
                }`}
              >
                <Users className="w-4 h-4" strokeWidth={1.85} />
                <span>3. Alumnos</span>
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'asistencia' && (
          <TeacherQrAttendanceScreen presetSectionId={selectedCourse.section_id} />
        )}

        {activeTab === 'asistencia_manual' && (
          <TeacherAttendanceScreen presetSectionId={selectedCourse.section_id} />
        )}

        {activeTab === 'alumnos' && (
          <div className="ucv-card ucv-animate-in rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <SectionIconBadge icon={Users} variant="red" size="sm" />
                <h2 className="text-[11px] font-bold text-[#0B2A5B] uppercase tracking-[0.06em]">
                  Alumnos Matriculados ({students.length})
                </h2>
              </div>
              <ActionButton
                icon={RefreshCw}
                variant="secondary"
                size="xs"
                spinningIcon={studentsLoading}
                disabled={studentsLoading}
                onClick={() => fetchStudents(selectedCourse.section_id)}
              >
                Actualizar
              </ActionButton>
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
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50/85 border border-slate-200/80 rounded-xl px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/85 font-semibold">
                      <CheckCircle2 className="w-3 h-3" strokeWidth={1.85} />
                      Habilitados:{' '}
                      {students.filter((s) => !blockStatusMap[s.student_id]?.isBlocked).length}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/85 font-semibold">
                      <AlertTriangle className="w-3 h-3" strokeWidth={1.85} />
                      En riesgo (2 faltas):{' '}
                      {
                        students.filter(
                          (s) =>
                            !blockStatusMap[s.student_id]?.isBlocked &&
                            blockStatusMap[s.student_id]?.cycleAbsences === 2
                        ).length
                      }
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-[#C8102E] border border-red-200/85 font-semibold">
                      <ShieldAlert className="w-3 h-3" strokeWidth={1.85} />
                      Inhabilitados:{' '}
                      {students.filter((s) => blockStatusMap[s.student_id]?.isBlocked).length}
                    </span>
                  </div>
                  <span className="text-slate-500 font-medium">
                    3 faltas inhabilitan automáticamente en este curso. Solo Administración puede rehabilitar.
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50/90 text-slate-500 font-semibold uppercase tracking-[0.06em] text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3 w-14">Foto</th>
                        <th className="py-3 px-3">Código</th>
                        <th className="py-3 px-3">Nombre Completo del Alumno</th>
                        <th className="py-3 px-3 text-center">Faltas</th>
                        <th className="py-3 px-3 text-center">Estado en Curso</th>
                        <th className="py-3 px-3 text-right">Fecha de Matrícula</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((st) => {
                        const status = blockStatusMap[st.student_id];
                        const isBlocked = Boolean(status?.isBlocked);
                        const cycleAbsences = status?.cycleAbsences ?? 0;
                        const totalAbsences = status?.totalAbsences ?? 0;
                        const isWarning = !isBlocked && cycleAbsences === 2;

                        return (
                          <tr
                            key={st.id}
                            className={`transition-colors ${
                              isBlocked
                                ? 'bg-red-50/35 hover:bg-red-50/60'
                                : isWarning
                                ? 'bg-amber-50/30 hover:bg-amber-50/50'
                                : 'hover:bg-slate-50/85'
                            }`}
                          >
                            <td className="py-3 px-3">
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
                            <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                              {st.profile?.code || '--'}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900">
                                {st.profile ? `${st.profile.last_names}, ${st.profile.first_names}` : 'Estudiante sin perfil'}
                              </div>
                              {st.profile?.career?.name && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200/85 text-[#1F5FA8] text-[10px] font-semibold uppercase tracking-[0.04em]">
                                  {st.profile.career.name}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono tabular-nums text-[11px] font-semibold border ${
                                  isBlocked || cycleAbsences >= 3
                                    ? 'bg-red-50 text-[#C8102E] border-red-200/85'
                                    : isWarning
                                    ? 'bg-amber-50 text-amber-800 border-amber-200/85'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {cycleAbsences}/3
                              </span>
                              {totalAbsences > cycleAbsences && (
                                <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                                  ({totalAbsences} total)
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isBlocked ? (
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <span
                                    title={status?.activeBlock?.reason || 'Inhabilitado por inasistencias'}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-red-50 text-[#C8102E] border border-red-200/85"
                                  >
                                    <ShieldAlert className="w-3 h-3" strokeWidth={1.85} />
                                    <span>INHABILITADO</span>
                                  </span>
                                  {status?.activeBlock?.reason && (
                                    <span className="text-[10px] text-red-700 max-w-[180px] truncate">
                                      {status.activeBlock.reason}
                                    </span>
                                  )}
                                </div>
                              ) : isWarning ? (
                                <div className="inline-flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/85">
                                    <CheckCircle2 className="w-3 h-3" strokeWidth={1.85} />
                                    <span>HABILITADO</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/85">
                                    <AlertTriangle className="w-3 h-3" strokeWidth={1.85} />
                                    <span>Advertencia: 2 faltas</span>
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/85">
                                  <CheckCircle2 className="w-3 h-3" strokeWidth={1.85} />
                                  <span>HABILITADO</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-500 font-mono tabular-nums text-[11px]">
                              {st.enrolled_at ? formatDisplayDate(st.enrolled_at.slice(0, 10)) : '--'}
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
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <SectionIconBadge icon={BookOpen} variant="red" size="md" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B] tracking-[-0.02em]">
              Mis Cursos
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Selecciona un curso para gestionar su horario, crear los días de clase y registrar asistencia.
            </p>
          </div>
        </div>

        <ActionButton
          icon={RefreshCw}
          variant="secondary"
          size="sm"
          spinningIcon={loading}
          disabled={loading}
          onClick={fetchTeacherCourses}
          className="self-start sm:self-auto"
        >
          Actualizar
        </ActionButton>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#1F5FA8] mb-3" />
          <span className="text-xs font-semibold">Cargando tus cursos asignados...</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="p-8 ucv-card rounded-2xl text-center ucv-scale-in">
          <SectionIconBadge icon={BookOpen} variant="neutral" size="lg" className="mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">
            Todavía no tienes cursos asignados. Pide al administrador que te asigne uno.
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Cuando el administrador te asigne una sección, podrás verla aquí y gestionar todo su ciclo académico.
          </p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-5 ${
            courses.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {courses.map((c, idx) => {
            const theme = getCourseCardTheme(c.name, c.code);
            return (
              <div
                key={c.section_id}
                onClick={() => {
                  setSelectedCourse(c);
                  setActiveTab('asistencia');
                }}
                className={`ucv-card-pro ucv-animate-in ucv-delay-${(idx % 4) + 1} relative rounded-2xl border overflow-hidden min-h-[214px] h-full p-6 flex flex-col justify-between cursor-pointer group ${theme.cardSurface}`}
              >
                <div
                  className={`pointer-events-none absolute inset-y-0 right-0 w-[62%] ${theme.bgImageClass} bg-cover bg-center bg-no-repeat opacity-[0.34] transition-transform duration-300 group-hover:scale-[1.03]`}
                  aria-hidden="true"
                />
                <div
                  className={`pointer-events-none absolute inset-0 ${theme.gradientOverlay}`}
                  aria-hidden="true"
                />

                <div className="relative z-10 flex-1 flex flex-col justify-between gap-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-md border shadow-2xs ${theme.codeBadge}`}
                      >
                        {c.code}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border shadow-2xs ${theme.sectionBadge}`}
                      >
                        Sección {c.section_name}
                      </span>
                    </div>

                    <h3
                      className={`text-lg sm:text-xl font-bold tracking-[-0.02em] leading-snug transition-colors max-w-[78%] line-clamp-2 ${theme.titleColor}`}
                    >
                      {c.name}
                    </h3>
                  </div>

                  <div
                    className={`pt-4 border-t ${theme.dividerBorder} flex flex-wrap items-center justify-between gap-3 text-xs`}
                  >
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium font-mono tabular-nums ${theme.metaText}`}
                    >
                      <Users className="w-4 h-4 shrink-0 opacity-75" strokeWidth={1.85} aria-hidden="true" />
                      <span>{c.students ?? 0} estudiantes</span>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCourse(c);
                        setActiveTab('asistencia');
                      }}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98] whitespace-nowrap shrink-0 ${theme.buttonClass}`}
                    >
                      <span>Entrar al curso</span>
                      <ChevronRight
                        className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                        strokeWidth={2.1}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
