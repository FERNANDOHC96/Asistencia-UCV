import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Calendar,
  Layers,
  Clock,
  MapPin,
  UserCheck,
  RefreshCw,
  AlertCircle,
  GraduationCap,
  FlaskConical,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getStudentEnrollments, StudentEnrollmentWithDetails } from '../../services/studentService';
import { fetchStudentBlocksBySection } from '../../services/blockService';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { SectionStudentBlockStatus } from '../../types';
import { ActionButton, SectionIconBadge } from '../ui';

const WEEKDAYS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export const StudentCoursesScreen: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<StudentEnrollmentWithDetails[]>([]);
  const [blockStatusMap, setBlockStatusMap] = useState<Record<string, SectionStudentBlockStatus>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const data = await getStudentEnrollments(user.id);
      setCourses(data);

      const sectionIds = data.map((c) => c.section.id);
      if (sectionIds.length > 0) {
        const blocks = await fetchStudentBlocksBySection(user.id, sectionIds).catch(() => ({}));
        setBlockStatusMap(blocks);
      } else {
        setBlockStatusMap({});
      }
    } catch (err: any) {
      setError(translateSupabaseError(err, 'enrollments'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`student-courses-blocks-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_section_blocks',
          filter: `student_id=eq.${user.id}`,
        },
        () => {
          loadCourses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadCourses]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

      <div className="ucv-card-pro rounded-2xl overflow-hidden">
        <div className="h-[3px] w-full ucv-topbar-split" />
        <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <SectionIconBadge icon={BookOpen} variant="blue" size="md" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B] tracking-[-0.02em]">Mis Asignaturas Matriculadas</h1>
                <span className="text-[10px] uppercase font-semibold tracking-[0.06em] px-2 py-0.5 rounded-md bg-red-50 text-[#C8102E] border border-red-200/85">
                  Ciclo Lectivo
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Consulte los cursos en los que se encuentra formalmente matriculado, secciones, docentes a cargo y horarios de clase.
              </p>
            </div>
          </div>

          <ActionButton
            icon={RefreshCw}
            variant="secondary"
            size="sm"
            spinningIcon={loading}
            disabled={loading}
            onClick={loadCourses}
            className="self-start sm:self-auto"
          >
            Actualizar
          </ActionButton>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-900">Error al consultar asignaturas</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="ucv-card p-12 rounded-xl text-center">
          <RefreshCw className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">Cargando asignaturas matriculadas...</p>
          <p className="text-[11px] text-slate-400 mt-1">Consultando registros en Supabase</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="ucv-card p-12 rounded-xl text-center">
          <SectionIconBadge icon={BookOpen} variant="blue" size="lg" className="mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No tiene asignaturas matriculadas activas</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            El administrador académico aún no ha registrado matrículas activas para su código universitario en el periodo vigente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map((item, idx) => {
            const course = item.section.offering.course;
            const period = item.section.offering.period;
            const isBlueAccent = idx % 2 === 0;
            const delayClass =
              idx % 4 === 0
                ? 'ucv-delay-1'
                : idx % 4 === 1
                ? 'ucv-delay-2'
                : idx % 4 === 2
                ? 'ucv-delay-3'
                : 'ucv-delay-4';
            const blockStatus = blockStatusMap[item.section.id];
            const isCourseBlocked = Boolean(blockStatus?.isBlocked);
            const cycleAbsences = blockStatus?.cycleAbsences ?? 0;
            const isWarning = !isCourseBlocked && cycleAbsences === 2;

            return (
              <div
                key={item.enrollmentId}
                className={`ucv-card-pro ucv-card-interactive ucv-animate-in ${delayClass} rounded-2xl border-t-2 ${
                  isCourseBlocked
                    ? 'border-t-[#C8102E] ring-1 ring-red-200'
                    : isBlueAccent
                    ? 'border-t-[#1F5FA8]'
                    : 'border-t-[#C8102E]'
                } overflow-hidden flex flex-col justify-between`}
              >

                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <span
                      className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                        isBlueAccent
                          ? 'bg-blue-50 text-[#1F5FA8] border-blue-200/85'
                          : 'bg-red-50 text-[#C8102E] border-red-200/85'
                      }`}
                    >
                      {course.code}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isCourseBlocked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-50 text-[#C8102E] border border-red-200/85 uppercase">
                          <ShieldAlert className="w-3 h-3" strokeWidth={1.85} />
                          INHABILITADO ({cycleAbsences}/3 faltas)
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/85 uppercase">
                          <AlertTriangle className="w-3 h-3" strokeWidth={1.85} />
                          2/3 faltas (Riesgo)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/85 uppercase">
                          <CheckCircle2 className="w-3 h-3" strokeWidth={1.85} />
                          Habilitado ({cycleAbsences}/3 faltas)
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-[#0B2A5B] leading-snug">
                    {course.name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.85} />
                      Sección: <strong className="text-slate-700">{item.section.name}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.85} />
                      Créditos: <strong className="text-slate-700 font-mono tabular-nums">{course.credits}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.85} />
                      Periodo: <strong className="text-slate-700">{period.name}</strong>
                    </span>
                  </div>

                  {isCourseBlocked && (
                    <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-900 space-y-1">
                      <div className="font-extrabold text-[#C8102E] flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>Inhabilitado exclusivamente en este curso</span>
                      </div>
                      <p className="text-red-800">
                        El registro de asistencia por código QR y Bluetooth está bloqueado para esta asignatura hasta que Administración te rehabilite. Tus demás cursos no se ven afectados.
                      </p>
                      {blockStatus?.activeBlock?.reason && (
                        <p className="font-semibold text-red-900">
                          Motivo: {blockStatus.activeBlock.reason}
                        </p>
                      )}
                    </div>
                  )}

                  {isWarning && (
                    <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Tienes <strong>2 faltas</strong> en este ciclo. Una falta adicional inhabilitará automáticamente tu asistencia en este curso.
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50/75 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <UserCheck className={`w-3.5 h-3.5 ${isBlueAccent ? 'text-[#1F5FA8]' : 'text-[#C8102E]'}`} />
                    <span className="font-bold text-[11px] uppercase tracking-wider">
                      Docente a cargo:
                    </span>
                  </div>
                  {item.teachers.length === 0 ? (
                    <span className="text-slate-400 italic">Por asignar por administración</span>
                  ) : (
                    <div className="space-y-1">
                      {item.teachers.map((t) => (
                        <div key={t.id} className="font-semibold text-slate-800">
                          {t.last_names}, {t.first_names}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Horario de clases:</span>
                  </div>

                  {item.schedules.length === 0 ? (
                    <p className="text-slate-400 italic text-[11px]">
                      Horario pendiente de programación
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {item.schedules.map((sch) => {
                        const isPractica = sch.kind === 'practica';
                        return (
                          <div
                            key={sch.id}
                            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/70 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border ${
                                  isPractica
                                    ? 'bg-red-50 text-[#C8102E] border-red-200'
                                    : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                                }`}
                              >
                                {isPractica ? (
                                  <FlaskConical className="w-2.5 h-2.5 text-[#C8102E]" />
                                ) : (
                                  <BookOpen className="w-2.5 h-2.5 text-[#1F5FA8]" />
                                )}
                                <span>{isPractica ? 'Práctica' : 'Teoría'}</span>
                              </span>
                              <span className="font-bold text-slate-800">
                                {WEEKDAYS[sch.weekday] || `Día ${sch.weekday}`}:
                              </span>
                              <span className="font-mono text-[#0B2A5B] font-bold">
                                {sch.starts_at?.slice(0, 5)} - {sch.ends_at?.slice(0, 5)}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                              <MapPin className="w-3 h-3 text-[#C8102E]" />
                              {sch.room || 'Sin aula asignada'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
