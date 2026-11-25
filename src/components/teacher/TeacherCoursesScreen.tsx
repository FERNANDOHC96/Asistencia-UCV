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
  Edit3
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { CourseOverview } from '../../types';
import { fetchProfilesMapByIds, ProfileBasicInfo } from '../../lib/profileHelper';
import { formatDisplayDate } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { TeacherQrAttendanceScreen } from './TeacherQrAttendanceScreen';
import { TeacherAttendanceScreen } from './TeacherAttendanceScreen';
import { StudentAvatar } from '../StudentAvatar';
import { useStudentAvatarUrls } from '../../lib/avatarCache';

type TeacherCourseTab = 'asistencia' | 'asistencia_manual' | 'alumnos';

export const TeacherCoursesScreen: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseOverview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCourse, setSelectedCourse] = useState<CourseOverview | null>(null);
  const [activeTab, setActiveTab] = useState<TeacherCourseTab>('asistencia');

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
    if (activeTab === 'alumnos') {
      fetchStudents(selectedCourse.section_id);
    }
  }, [selectedCourse?.section_id, activeTab]);

  if (selectedCourse) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

        <div className="ucv-card rounded-2xl overflow-hidden">
          <div className="h-1 ucv-topbar-split w-full" />
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 hover:text-[#0B2A5B] transition-all active:scale-95 cursor-pointer"
                  title="Volver a Mis Cursos"
                >
                  <ArrowLeft className="w-5 h-5 text-[#0B2A5B]" />
                </button>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#1F5FA8]">
                      {selectedCourse.code}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      Sección {selectedCourse.section_name}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B2A5B] mt-1 tracking-tight">
                    {selectedCourse.name}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Estudiantes matriculados: <strong className="text-[#C8102E] font-mono">{selectedCourse.students ?? 0}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-3.5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTab('asistencia')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                  activeTab === 'asistencia'
                    ? 'bg-gradient-to-r from-[#0B2A5B] via-[#1F5FA8] to-[#C8102E] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0B2A5B] hover:bg-slate-100'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>1. Asistencia</span>
              </button>

              <button
                onClick={() => setActiveTab('asistencia_manual')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                  activeTab === 'asistencia_manual'
                    ? 'bg-gradient-to-r from-[#0B2A5B] via-[#1F5FA8] to-[#C8102E] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0B2A5B] hover:bg-slate-100'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>2. Asistencia manual</span>
              </button>

              <button
                onClick={() => setActiveTab('alumnos')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                  activeTab === 'alumnos'
                    ? 'bg-gradient-to-r from-[#0B2A5B] via-[#1F5FA8] to-[#C8102E] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0B2A5B] hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
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
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#C8102E]" />
                <h2 className="text-sm font-bold text-[#0B2A5B] uppercase tracking-wider">
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B2A5B] flex items-center gap-2 tracking-tight">
            <BookOpen className="w-6 h-6 text-[#C8102E]" />
            <span>Mis Cursos</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Selecciona un curso para gestionar su horario, crear los días de clase y registrar asistencia.
          </p>
        </div>

        <button
          onClick={fetchTeacherCourses}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-2 bg-white border border-slate-200/90 text-slate-700 hover:text-[#0B2A5B] hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C8102E]' : 'text-[#1F5FA8]'}`} />
          <span>Actualizar</span>
        </button>
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
          {courses.map((c, idx) => {
            const isCrimsonAccent = idx % 2 === 1;
            return (
              <div
                key={c.section_id}
                onClick={() => {
                  setSelectedCourse(c);
                  setActiveTab('asistencia');
                }}
                className={`ucv-card ucv-card-interactive ucv-animate-in ucv-delay-${(idx % 4) + 1} rounded-2xl border-t-2 ${
                  isCrimsonAccent
                    ? 'border-t-[#C8102E] hover:border-red-300'
                    : 'border-t-[#1F5FA8] hover:border-blue-300'
                } p-5 flex flex-col justify-between cursor-pointer group`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      isCrimsonAccent
                        ? 'bg-red-50 text-[#C8102E] border border-red-100'
                        : 'bg-blue-50 text-[#1F5FA8] border border-blue-100'
                    }`}>
                      {c.code}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      Secc. {c.section_name}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0B2A5B] transition-colors mb-2">
                    {c.name}
                  </h3>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>{c.students ?? 0} estudiantes</span>
                  </span>
                  <span className={`font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform ${
                    isCrimsonAccent ? 'text-[#C8102E]' : 'text-[#1F5FA8]'
                  }`}>
                    <span>Entrar al curso</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
