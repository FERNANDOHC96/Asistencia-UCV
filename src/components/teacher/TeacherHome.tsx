import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Users, Clock, ArrowRight, RefreshCw, AlertCircle, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { CourseOverview } from '../../types';
import { getTodayLima, formatDisplayDate } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';

interface TeacherHomeProps {
  onNavigate: (tab: string) => void;
}

function useAnimatedNumber(target: number, enabled: boolean, duration = 560): number {
  const [displayValue, setDisplayValue] = useState<number>(target);
  const previousRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      previousRef.current = target;
      setDisplayValue(target);
      return;
    }

    const startValue = previousRef.current;
    if (startValue === target) {
      setDisplayValue(target);
      return;
    }

    let frameId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (target - startValue) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        previousRef.current = target;
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, enabled, duration]);

  return displayValue;
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

  const animatedCourses = useAnimatedNumber(courses.length, !loading);
  const animatedSessions = useAnimatedNumber(sessionsTodayCount, !loading);
  const animatedStudents = useAnimatedNumber(totalStudentsCount, !loading);

  const teacherInitials = `${profile?.first_names?.charAt(0) || ''}${profile?.last_names?.charAt(0) || ''}`.trim().toUpperCase();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-8">

      <section className="ucv-card-pro ucv-hero-reveal rounded-2xl overflow-hidden">
        <div className="h-[3px] w-full ucv-topbar-split" />
        <div className="ucv-sheen-split px-6 py-6 sm:px-8 sm:py-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0B2A5B] via-[#1F5FA8] to-[#C8102E] p-[2px] shrink-0 shadow-sm">
              <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center text-[#0B2A5B] font-extrabold text-lg tracking-tight">
                {teacherInitials || <GraduationCap className="w-6 h-6 text-[#0B2A5B]" />}
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                <span className="font-bold text-[#C8102E]">Docente Titular</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="font-mono tabular-nums text-slate-600">
                  {formatDisplayDate(todayLima)} (Perú)
                </span>
                {profile?.code && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-mono tabular-nums font-semibold text-[#0B2A5B]">
                      Cód. {profile.code}
                    </span>
                  </>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B2A5B] tracking-tight text-balance">
                Bienvenido(a), Prof. {profile?.first_names} {profile?.last_names}
              </h1>

              <p className="text-xs sm:text-[13px] text-slate-500">
                Resumen académico de cursos asignados, sesiones programadas y control de asistencia.
              </p>
            </div>
          </div>

          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="self-start md:self-center px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#0B2A5B] border border-slate-200/90 hover:border-[#1F5FA8]/40 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.97] flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 shadow-xs disabled:opacity-60 group"
          >
            <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-300 ${loading ? 'animate-spin text-[#C8102E]' : 'text-[#1F5FA8] group-hover:rotate-45'}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </section>

      {error && (
        <div className="p-4 rounded-xl bg-red-50/90 border border-red-200 text-red-900 text-xs flex items-center gap-3 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {!loading && courses.length === 0 && (
        <div className="p-10 ucv-card-pro rounded-2xl text-center space-y-3 ucv-scale-in">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#0B2A5B]">
            Todavía no tienes cursos asignados. Pide al administrador que te asigne uno.
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Una vez que el administrador te asigne asignaturas, podrás configurar tus horarios, generar los días de clase y registrar asistencia por QR o manual.
          </p>
        </div>
      )}

      {(loading || courses.length > 0) && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          <div
            style={{ animationDelay: '70ms' }}
            className="ucv-card-pro ucv-card-reveal group rounded-2xl overflow-hidden flex flex-col justify-between hover:border-blue-300/70"
          >
            <div className="pointer-events-none absolute inset-0 ucv-sheen-blue opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="h-[3px] w-full bg-[#1F5FA8] relative z-10" />
            <div className="p-6 flex-1 flex flex-col justify-between relative z-10">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-500">
                    Carga lectiva
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-200/70 text-[#1F5FA8] flex items-center justify-center shadow-2xs transition-transform duration-300 group-hover:scale-105">
                    <BookOpen className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-[#0B2A5B]">
                  Mis Cursos
                </h3>
                <div className="mt-2.5 flex items-baseline gap-2.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#0B2A5B] font-mono tabular-nums tracking-tight">
                    {loading ? '—' : animatedCourses}
                  </span>
                  <span className="text-xs text-slate-500">asignaturas activas</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100/90">
                <button
                  onClick={() => onNavigate('mis_cursos')}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[#1F5FA8] hover:text-white bg-blue-50/70 hover:bg-[#1F5FA8] border border-blue-200/70 hover:border-[#1F5FA8] flex items-center justify-between group/btn cursor-pointer transition-all duration-200 active:scale-[0.98] whitespace-nowrap"
                >
                  <span>Ir a Mis Cursos</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
                </button>
              </div>
            </div>
          </div>

          <div
            style={{ animationDelay: '140ms' }}
            className="ucv-card-pro ucv-card-reveal group rounded-2xl overflow-hidden flex flex-col justify-between hover:border-red-300/70"
          >
            <div className="pointer-events-none absolute inset-0 ucv-sheen-red opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="h-[3px] w-full bg-[#C8102E] relative z-10" />
            <div className="p-6 flex-1 flex flex-col justify-between relative z-10">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-500">
                    Agenda del día
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-50 to-white border border-red-200/70 text-[#C8102E] flex items-center justify-center shadow-2xs transition-transform duration-300 group-hover:scale-105">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-[#0B2A5B]">
                  Sesiones para Hoy
                </h3>
                <div className="mt-2.5 flex items-baseline gap-2.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#C8102E] font-mono tabular-nums tracking-tight">
                    {loading ? '—' : animatedSessions}
                  </span>
                  <span className="text-xs text-slate-500">clases programadas</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100/90">
                <button
                  onClick={() => onNavigate('mis_cursos')}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[#C8102E] hover:text-white bg-red-50/70 hover:bg-[#C8102E] border border-red-200/70 hover:border-[#C8102E] flex items-center justify-between group/btn cursor-pointer transition-all duration-200 active:scale-[0.98] whitespace-nowrap"
                >
                  <span>Gestionar en Mis Cursos</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
                </button>
              </div>
            </div>
          </div>

          <div
            style={{ animationDelay: '210ms' }}
            className="ucv-card-pro ucv-card-reveal group rounded-2xl overflow-hidden flex flex-col justify-between hover:border-slate-300"
          >
            <div className="pointer-events-none absolute inset-0 ucv-sheen-split opacity-50 group-hover:opacity-95 transition-opacity duration-300" />
            <div className="h-[3px] w-full ucv-topbar-split relative z-10" />
            <div className="p-6 flex-1 flex flex-col justify-between relative z-10">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-500">
                    Estudiantes
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-white border border-slate-200/90 text-[#0B2A5B] flex items-center justify-center shadow-2xs transition-transform duration-300 group-hover:scale-105">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-[#0B2A5B]">
                  Total de Alumnos
                </h3>
                <div className="mt-2.5 flex items-baseline gap-2.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#0B2A5B] font-mono tabular-nums tracking-tight">
                    {loading ? '—' : animatedStudents}
                  </span>
                  <span className="text-xs text-slate-500">estudiantes matriculados</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100/90">
                <button
                  onClick={() => onNavigate('mis_cursos')}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[#0B2A5B] hover:text-white bg-slate-100/80 hover:bg-[#0B2A5B] border border-slate-200 hover:border-[#0B2A5B] flex items-center justify-between group/btn cursor-pointer transition-all duration-200 active:scale-[0.98] whitespace-nowrap"
                >
                  <span>Ver en Mis Cursos</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {(loading || courses.length > 0) && (
        <section style={{ animationDelay: '250ms' }} className="space-y-5 ucv-card-reveal">
          <div className="flex items-center justify-between gap-4 pb-3.5 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shadow-2xs">
                <BookOpen className="w-4 h-4 text-[#C8102E]" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#0B2A5B] tracking-tight">
                  Mis Cursos Asignados {!loading && `(${courses.length})`}
                </h2>
              </div>
            </div>

            <button
              onClick={() => onNavigate('mis_cursos')}
              className="text-xs font-semibold text-[#1F5FA8] hover:text-[#C8102E] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 group"
            >
              <span>Ver todos los cursos</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="ucv-card-pro rounded-2xl p-6 space-y-4 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-20 bg-slate-200 rounded" />
                    <div className="h-3.5 w-16 bg-slate-200 rounded" />
                  </div>
                  <div className="h-4 w-4/5 bg-slate-200 rounded" />
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="h-3.5 w-20 bg-slate-200 rounded" />
                    <div className="h-3.5 w-16 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map((c, idx) => {
                const isCrimsonAccent = idx % 2 === 1;
                const staggerDelay = Math.min(idx, 8) * 55 + 260;
                return (
                  <div
                    key={c.section_id}
                    onClick={() => onNavigate('mis_cursos')}
                    style={{ animationDelay: `${staggerDelay}ms` }}
                    className={`ucv-card-pro ucv-card-reveal rounded-2xl overflow-hidden cursor-pointer group flex flex-col justify-between ${
                      isCrimsonAccent ? 'hover:border-red-300/80' : 'hover:border-blue-300/80'
                    }`}
                  >
                    <div
                      className={`pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                        isCrimsonAccent ? 'ucv-sheen-red' : 'ucv-sheen-blue'
                      }`}
                    />
                    <div
                      className={`h-[3px] w-full relative z-10 origin-left transition-transform duration-300 ${
                        isCrimsonAccent ? 'bg-[#C8102E]' : 'bg-[#1F5FA8]'
                      }`}
                    />
                    <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-5 relative z-10">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className={`font-mono font-bold tracking-tight ${
                            isCrimsonAccent ? 'text-[#C8102E]' : 'text-[#1F5FA8]'
                          }`}>
                            {c.code}
                          </span>
                          <span className="font-mono text-slate-500 font-medium">
                            Sección {c.section_name}
                          </span>
                        </div>
                        <h3 className="text-[15px] font-bold text-[#0B2A5B] group-hover:text-[#1F5FA8] transition-colors line-clamp-2 leading-snug">
                          {c.name}
                        </h3>
                      </div>

                      <div className="pt-3.5 border-t border-slate-100/90 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium font-mono tabular-nums">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.students ?? 0} alumnos</span>
                        </span>
                        <span className={`font-semibold flex items-center gap-1 whitespace-nowrap ${
                          isCrimsonAccent ? 'text-[#C8102E]' : 'text-[#1F5FA8]'
                        }`}>
                          <span>Gestionar</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
