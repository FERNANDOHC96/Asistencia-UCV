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

      const { data: cData, error: cErr } = await supabase
        .from('course_overview')
        .select('*')
        .eq('teacher_id', user.id)
        .order('name', { ascending: true });

      if (cErr) throw cErr;

      const teacherCourses = cData || [];
      setCourses(teacherCourses);

      const totalStudents = teacherCourses.reduce((acc, c) => acc + (Number(c.students) || 0), 0);
      setTotalStudentsCount(totalStudents);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

      <div className="ucv-card rounded-2xl overflow-hidden">
        <div className="h-1 ucv-topbar-split w-full" />
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-[#C8102E] border border-red-200 text-xs font-bold uppercase tracking-wider">
                Docente Titular
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Hoy: {formatDisplayDate(todayLima)} (Perú)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B2A5B] tracking-tight">
              Bienvenido(a), Prof. {profile?.first_names} {profile?.last_names}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Código Universitario: <span className="font-mono font-bold text-[#0B2A5B]">{profile?.code}</span>
            </p>
          </div>

          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="self-start sm:self-auto px-3.5 py-2 bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 hover:text-[#0B2A5B] rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C8102E]' : 'text-[#1F5FA8]'}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {!loading && courses.length === 0 && (
        <div className="p-8 ucv-card rounded-2xl text-center space-y-3 ucv-scale-in">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">
            Todavía no tienes cursos asignados. Pide al administrador que te asigne uno.
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Una vez que el administrador te asigne asignaturas, podrás configurar tus horarios, generar los días de clase y registrar asistencia por QR o manual.
          </p>
        </div>
      )}

      {(loading || courses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          <div className="ucv-card ucv-card-interactive ucv-animate-in ucv-delay-1 rounded-2xl border-t-2 border-t-[#1F5FA8] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-[#1F5FA8] flex items-center justify-center">
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
                <span className="text-3xl font-extrabold text-[#0B2A5B] font-mono">
                  {loading ? '...' : courses.length}
                </span>
                <span className="text-xs text-slate-500">asignaturas activas</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => onNavigate('mis_cursos')}
                className="w-full py-2 px-3 bg-blue-50/70 hover:bg-[#1F5FA8] text-[#1F5FA8] hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 group cursor-pointer transition-all border border-blue-100"
              >
                <span>Ir a Mis Cursos</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="ucv-card ucv-card-interactive ucv-animate-in ucv-delay-2 rounded-2xl border-t-2 border-t-[#C8102E] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 text-[#C8102E] flex items-center justify-center">
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
                <span className="text-3xl font-extrabold text-[#0B2A5B] font-mono">
                  {loading ? '...' : sessionsTodayCount}
                </span>
                <span className="text-xs text-slate-500">clases programadas</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => onNavigate('mis_cursos')}
                className="w-full py-2 px-3 bg-red-50/70 hover:bg-[#C8102E] text-[#C8102E] hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 group cursor-pointer transition-all border border-red-100"
              >
                <span>Gestionar en Mis Cursos</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="ucv-card ucv-card-interactive ucv-animate-in ucv-delay-3 rounded-2xl border-t-2 border-t-[#0B2A5B] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-[#0B2A5B] flex items-center justify-center">
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
                <span className="text-3xl font-extrabold text-[#0B2A5B] font-mono">
                  {loading ? '...' : totalStudentsCount}
                </span>
                <span className="text-xs text-slate-500">estudiantes matriculados</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => onNavigate('mis_cursos')}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-[#0B2A5B] text-[#0B2A5B] hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 group cursor-pointer transition-all border border-slate-200/80"
              >
                <span>Ver en Mis Cursos</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {courses.length > 0 && (
        <div className="ucv-card ucv-animate-in ucv-delay-3 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#0B2A5B] uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#C8102E]" />
              <span>Mis Cursos Asignados ({courses.length})</span>
            </h2>
            <button
              onClick={() => onNavigate('mis_cursos')}
              className="text-xs font-bold text-[#C8102E] hover:text-[#0B2A5B] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Ver todos los cursos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c, idx) => {
              const isCrimsonAccent = idx % 2 === 1;
              return (
                <div
                  key={c.section_id}
                  onClick={() => onNavigate('mis_cursos')}
                  className={`bg-slate-50/70 hover:bg-white rounded-xl border border-slate-200/90 border-t-2 ${
                    isCrimsonAccent
                      ? 'border-t-[#C8102E] hover:border-red-300'
                      : 'border-t-[#1F5FA8] hover:border-blue-300'
                  } p-4 cursor-pointer group ucv-card-interactive`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
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
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#0B2A5B] transition-colors line-clamp-1">
                    {c.name}
                  </h3>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2.5 border-t border-slate-200/60">
                    <span className="flex items-center gap-1 font-medium">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.students ?? 0} alumnos</span>
                    </span>
                    <span className={`font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1 ${
                      isCrimsonAccent ? 'text-[#C8102E]' : 'text-[#1F5FA8]'
                    }`}>
                      Gestionar
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
