import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen,
  Users,
  Calendar,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Scale,
  Code2,
  Calculator,
  Briefcase,
  Cpu,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { CourseOverview } from '../../types';
import { getTodayLima, formatDisplayDate } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { TeacherRiskAlertsSection } from './TeacherRiskAlertsSection';
import { ActionButton, SectionIconBadge } from '../ui';

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

function getCourseIcon(courseName: string, courseCode: string) {
  const combined = `${courseName} ${courseCode}`.toLowerCase();
  if (combined.includes('derecho') || combined.includes('penal') || combined.includes('civil') || combined.includes('constituc')) {
    return Scale;
  }
  if (
    combined.includes('software') ||
    combined.includes('programac') ||
    combined.includes('algoritm') ||
    combined.includes('sistema') ||
    combined.includes('comput') ||
    combined.includes('inf') ||
    combined.includes('web')
  ) {
    return Code2;
  }
  if (combined.includes('matem') || combined.includes('calculo') || combined.includes('cálculo') || combined.includes('estad')) {
    return Calculator;
  }
  if (combined.includes('admin') || combined.includes('gesti') || combined.includes('empresa') || combined.includes('negoc')) {
    return Briefcase;
  }
  if (combined.includes('ingenier') || combined.includes('red') || combined.includes('arquitect')) {
    return Cpu;
  }
  return BookOpen;
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      <section className="ucv-hero-reveal relative rounded-2xl overflow-hidden bg-[#071D42] shadow-[0_14px_34px_-12px_rgba(11,42,91,0.3)] border border-[#0B2A5B]/20">
        <div
          className="pointer-events-none absolute inset-0 bg-[url('/assets/aistudio/Vista_a_rea_azulada_de_edificio_universitario_938ef91a.png')] bg-cover bg-center bg-no-repeat"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#071D42] via-[#0B2A5B]/82 to-[#0B2A5B]/20"
          aria-hidden="true"
        />

        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/85">
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-white/85" strokeWidth={1.85} aria-hidden="true" />
                {formatDisplayDate(todayLima)} (Perú)
              </span>
              {profile?.code && (
                <>
                  <span aria-hidden="true" className="text-white/35">·</span>
                  <span className="font-mono tabular-nums text-white/80">
                    Cód. {profile.code}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-xl sm:text-[26px] font-bold text-white tracking-[-0.02em] leading-tight text-balance drop-shadow-2xs">
              Bienvenido(a), Prof. {profile?.first_names} {profile?.last_names}
            </h1>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={fetchDashboardData}
            className="self-start md:self-center inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white hover:bg-slate-50 text-[#0B2A5B] text-[13px] font-semibold shadow-[0_6px_18px_-4px_rgba(7,28,64,0.35)] border border-white/90 transition-all duration-150 cursor-pointer active:scale-[0.985] disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              strokeWidth={1.9}
              aria-hidden="true"
            />
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
          <SectionIconBadge icon={BookOpen} variant="neutral" size="lg" className="mx-auto" />
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
            style={{ animationDelay: '60ms' }}
            className="ucv-card-pro ucv-card-reveal group relative rounded-2xl overflow-hidden bg-gradient-to-br from-white via-[#F6FAFF] to-[#EBF3FF] border border-blue-100/95 shadow-[0_8px_24px_-12px_rgba(31,95,168,0.18)] flex flex-col justify-between"
          >
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-[68%] bg-[url('/assets/aistudio/Innovaci_n_empresarial_azul_y_sostenible_73c59fbc.png')] bg-cover bg-center bg-no-repeat opacity-[0.26] transition-transform duration-300 group-hover:scale-[1.03]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-[#F6FAFF]/88 to-[#1F5FA8]/15"
              aria-hidden="true"
            />

            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between relative z-10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-100/90 border border-blue-200/80 text-[#1F5FA8] flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-150 group-hover:scale-[1.03]">
                  <BookOpen className="w-6 h-6" strokeWidth={1.85} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                    Carga lectiva
                  </span>
                  <h3 className="text-[15px] font-bold text-[#0B2A5B] mt-0.5">
                    Mis Cursos
                  </h3>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-[#0B2A5B] font-mono tabular-nums tracking-[-0.02em]">
                      {loading ? '—' : animatedCourses}
                    </span>
                    <span className="text-xs text-slate-700 font-medium">asignaturas activas</span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <ActionButton
                  variant="view"
                  size="sm"
                  iconRight={ArrowRight}
                  onClick={() => onNavigate('mis_cursos')}
                  className="w-full h-9 rounded-xl bg-blue-50/95 backdrop-blur-xs hover:bg-blue-100/95 border-blue-200/90 text-[#154A8A]"
                >
                  Ir a Mis Cursos
                </ActionButton>
              </div>
            </div>
          </div>

          <div
            style={{ animationDelay: '120ms' }}
            className="ucv-card-pro ucv-card-reveal group relative rounded-2xl overflow-hidden bg-gradient-to-br from-white via-[#FFF9FA] to-[#FFF0F2] border border-red-100/95 shadow-[0_8px_24px_-12px_rgba(200,16,46,0.16)] flex flex-col justify-between"
          >
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-[68%] bg-[url('/assets/aistudio/Planificador_de_calendario_en_rojo_intenso_ffbcb112.png')] bg-cover bg-center bg-no-repeat opacity-[0.24] transition-transform duration-300 group-hover:scale-[1.03]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-[#FFF9FA]/88 to-[#C8102E]/12"
              aria-hidden="true"
            />

            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between relative z-10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-100/90 border border-red-200/80 text-[#C8102E] flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-150 group-hover:scale-[1.03]">
                  <Calendar className="w-6 h-6" strokeWidth={1.85} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                    Agenda del día
                  </span>
                  <h3 className="text-[15px] font-bold text-[#0B2A5B] mt-0.5">
                    Sesiones para Hoy
                  </h3>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-[#C8102E] font-mono tabular-nums tracking-[-0.02em]">
                      {loading ? '—' : animatedSessions}
                    </span>
                    <span className="text-xs text-slate-700 font-medium">clases programadas</span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <ActionButton
                  variant="delete"
                  size="sm"
                  iconRight={ArrowRight}
                  onClick={() => onNavigate('mis_cursos')}
                  className="w-full h-9 rounded-xl bg-red-50/95 backdrop-blur-xs hover:bg-red-100/95 border-red-200/90 text-[#B80E29]"
                >
                  Gestionar en Mis Cursos
                </ActionButton>
              </div>
            </div>
          </div>

          <div
            style={{ animationDelay: '180ms' }}
            className="ucv-card-pro ucv-card-reveal group relative rounded-2xl overflow-hidden bg-gradient-to-br from-white via-[#F5FCF8] to-[#E9F9F0] border border-emerald-100/95 shadow-[0_8px_24px_-12px_rgba(5,150,105,0.16)] flex flex-col justify-between"
          >
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-[68%] bg-[url('/assets/aistudio/Estudiantes_caminando_por_el_campus_en_verde_7d6206c1.png')] bg-cover bg-center bg-no-repeat opacity-[0.26] transition-transform duration-300 group-hover:scale-[1.03]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-[#F5FCF8]/88 to-emerald-600/12"
              aria-hidden="true"
            />

            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between relative z-10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/90 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-150 group-hover:scale-[1.03]">
                  <Users className="w-6 h-6" strokeWidth={1.85} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                    Estudiantes
                  </span>
                  <h3 className="text-[15px] font-bold text-[#0B2A5B] mt-0.5">
                    Total de Alumnos
                  </h3>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-[#0B2A5B] font-mono tabular-nums tracking-[-0.02em]">
                      {loading ? '—' : animatedStudents}
                    </span>
                    <span className="text-xs text-slate-700 font-medium">estudiantes matriculados</span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <ActionButton
                  variant="confirm"
                  size="sm"
                  iconRight={ArrowRight}
                  onClick={() => onNavigate('mis_cursos')}
                  className="w-full h-9 rounded-xl !bg-emerald-50/95 backdrop-blur-xs hover:!bg-emerald-100/95 !text-emerald-800 !border-emerald-200/90 !shadow-none"
                >
                  Ver en Mis Cursos
                </ActionButton>
              </div>
            </div>
          </div>
        </section>
      )}

      <TeacherRiskAlertsSection />

      {(loading || courses.length > 0) && (
        <section style={{ animationDelay: '240ms' }} className="space-y-4 ucv-card-reveal">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-[#0B2A5B]" strokeWidth={2} aria-hidden="true" />
              <h2 className="text-sm sm:text-base font-bold text-[#0B2A5B] tracking-[-0.015em]">
                Mis Cursos Asignados {!loading && `(${courses.length})`}
              </h2>
            </div>

            <ActionButton
              variant="ghost"
              size="xs"
              iconRight={ArrowRight}
              onClick={() => onNavigate('mis_cursos')}
              className="text-[#0B2A5B] hover:text-[#1F5FA8]"
            >
              Ver todos los cursos
            </ActionButton>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[0, 1].map((idx) => (
                <div key={idx} className="ucv-card-pro rounded-2xl p-5 flex items-center gap-4 animate-pulse">
                  <div className="w-14 h-14 rounded-2xl bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-3.5 w-24 bg-slate-200 rounded" />
                    <div className="h-4 w-3/4 bg-slate-200 rounded" />
                    <div className="h-3.5 w-1/2 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 gap-5 ${
                courses.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {courses.map((c, idx) => {
                const isCrimsonAccent = idx % 2 === 1;
                const staggerDelay = Math.min(idx, 8) * 55 + 260;
                const CourseIcon = getCourseIcon(c.name, c.code);
                return (
                  <div
                    key={c.section_id}
                    onClick={() => onNavigate('mis_cursos')}
                    style={{ animationDelay: `${staggerDelay}ms` }}
                    className={`ucv-card-pro ucv-card-reveal rounded-2xl bg-white border border-slate-200/85 shadow-[0_8px_22px_-12px_rgba(11,42,91,0.12)] overflow-hidden cursor-pointer group p-5 flex items-center gap-4 transition-all ${
                      isCrimsonAccent
                        ? 'hover:border-red-200'
                        : 'hover:border-blue-200'
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0 transition-transform duration-150 group-hover:scale-[1.03] ${
                        isCrimsonAccent
                          ? 'bg-gradient-to-br from-[#EB2640] to-[#A50D25]'
                          : 'bg-gradient-to-br from-[#2164B5] to-[#0B2A5B]'
                      }`}
                      aria-hidden="true"
                    >
                      <CourseIcon className="w-7 h-7" strokeWidth={1.75} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`font-mono font-semibold px-2.5 py-0.5 rounded-md border text-[11px] ${
                            isCrimsonAccent
                              ? 'bg-red-50/90 text-[#C8102E] border-red-200/80'
                              : 'bg-blue-50/90 text-[#1F5FA8] border-blue-200/80'
                          }`}
                        >
                          {c.code}
                        </span>
                        <span className="font-medium text-slate-600 bg-slate-100/90 border border-slate-200/75 px-2.5 py-0.5 rounded-md text-[11px] shrink-0">
                          Sección {c.section_name}
                        </span>
                      </div>

                      <h3 className="text-[15px] sm:text-base font-bold text-[#0B2A5B] group-hover:text-[#1F5FA8] transition-colors line-clamp-1">
                        {c.name}
                      </h3>

                      <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-500 font-medium font-mono tabular-nums">
                          <Users className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.85} />
                          <span>{c.students ?? 0} alumnos</span>
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-semibold whitespace-nowrap border transition-colors ${
                            isCrimsonAccent
                              ? 'bg-red-50/90 text-[#C8102E] border-red-200/80 group-hover:bg-red-100/80'
                              : 'bg-blue-50/90 text-[#154A8A] border-blue-200/80 group-hover:bg-blue-100/80'
                          }`}
                        >
                          <span>Gestionar</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.9} />
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
