import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Calendar, Users, Clock, ArrowRight, RefreshCw, AlertCircle, CheckCircle2, UserCheck, Layers, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { CourseOverview } from '../../types';
import { getTodayLima, formatDisplayDate } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';

interface TeacherHomeProps {
  onNavigate: (tab: string) => void;
}

export const TeacherHome: React.FC<TeacherHomeProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState<CourseOverview[]>([]);
  const [sessionsTodayCount, setSessionsTodayCount] = useState<number>(0);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const todayLima = getTodayLima();

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured()) {
      setError('No se pudo conectar con el servicio. Contacta al administrador.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // 1. Obtener cursos del profesor desde course_overview
      const { data: cData, error: cErr } = await supabase
        .from('course_overview')
        .select('*')
        .eq('teacher_id', user.id)
        .order('name', { ascending: true });

      if (cErr) throw cErr;

      const teacherCourses = cData || [];
      setCourses(teacherCourses);

      // 2. Alumnos matriculados en total (suma de students de course_overview)
      const totalStudents = teacherCourses.reduce((acc, c) => acc + (Number(c.students) || 0), 0);
      setTotalStudentsCount(totalStudents);

      // 3. Sesiones programadas para hoy en las secciones del profesor
      const sectionIds = teacherCourses.map((c) => c.section_id);
      if (sectionIds.length > 0) {
        const { count: sTodayCount, error: sErr } = await supabase
          .from('class_sessions')
          .select('*', { count: 'exact', head: true })
          .in('section_id', sectionIds)
          .is('archived_at', null)
          .eq('session_date', todayLima);

        if (sErr) throw sErr;
        setSessionsTodayCount(sTodayCount ?? 0);
      } else {
        setSessionsTodayCount(0);
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [user, todayLima]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header institucional */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1F5FA8] border border-blue-200 text-xs font-bold uppercase tracking-wider">
              Docente Titular
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Hoy: {formatDisplayDate(todayLima)} (Perú)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
            Bienvenido(a), Prof. {profile?.first_names} {profile?.last_names}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Código Universitario: <span className="font-mono font-bold text-slate-700">{profile?.code}</span>
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Sin cursos asignados: estado vacío claro */}
      {!loading && courses.length === 0 && (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">
            Todavía no tienes cursos asignados. Pide al administrador que te asigne uno.
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Una vez que el administrador te asigne asignaturas, podrás configurar tus horarios, generar los días de clase y registrar asistencia por QR o manual.
          </p>
        </div>
      )}

      {/* Métricas Principales (si tiene cursos o cargando) */}
      {(loading || courses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Card Cursos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1F5FA8] flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Carga Lectiva
                </span>
              </div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Mis Cursos
              </h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {loading ? '...' : courses.length}
                </span>
                <span className="text-xs text-slate-500">asignaturas activas</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => onNavigate('mis_cursos')}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#1F5FA8] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 group cursor-pointer transition-colors border border-slate-200/80"
              >
                <span>Ir a Mis Cursos</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Card Sesiones de Hoy */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Agenda del Día
                </span>
              </div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Sesiones para Hoy
              </h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {loading ? '...' : sessionsTodayCount}
                </span>
                <span className="text-xs text-slate-500">clases programadas</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => onNavigate('mis_cursos')}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#1F5FA8] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 group cursor-pointer transition-colors border border-slate-200/80"
              >
                <span>Gestionar en Mis Cursos</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Card Alumnos Matriculados */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Estudiantes
                </span>
              </div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total de Alumnos
              </h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {loading ? '...' : totalStudentsCount}
                </span>
                <span className="text-xs text-slate-500">estudiantes matriculados</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => onNavigate('mis_cursos')}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#1F5FA8] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 group cursor-pointer transition-colors border border-slate-200/80"
              >
                <span>Ver en Mis Cursos</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista rápida de cursos asignados */}
      {courses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#1F5FA8]" />
              <span>Mis Cursos Asignados ({courses.length})</span>
            </h2>
            <button
              onClick={() => onNavigate('mis_cursos')}
              className="text-xs font-bold text-[#1F5FA8] hover:text-[#0B2A5B] flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos los cursos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <div
                key={c.section_id}
                onClick={() => onNavigate('mis_cursos')}
                className="bg-slate-50/70 hover:bg-white rounded-xl border border-slate-200 hover:border-blue-300 p-4 cursor-pointer group transition-all hover:shadow-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-[#1F5FA8]">
                    {c.code}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Secc. {c.section_name}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#1F5FA8] transition-colors line-clamp-1">
                  {c.name}
                </h3>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2.5 border-t border-slate-200/60">
                  <span className="flex items-center gap-1 font-medium">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.students ?? 0} alumnos</span>
                  </span>
                  <span className="font-bold text-[#1F5FA8] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Gestionar
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
