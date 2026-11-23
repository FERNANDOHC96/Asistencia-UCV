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
  FlaskConical
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getStudentEnrollments, StudentEnrollmentWithDetails } from '../../services/studentService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';

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
    } catch (err: any) {
      setError(translateSupabaseError(err, 'enrollments'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

      <div className="ucv-card rounded-xl overflow-hidden">
        <div className="h-1 w-full ucv-topbar-split" />
        <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#0B2A5B] tracking-tight">Mis Asignaturas Matriculadas</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-50 text-[#C8102E] border border-red-200">
                Ciclo Lectivo
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Consulte los cursos en los que se encuentra formalmente matriculado, secciones, docentes a cargo y horarios de clase.
            </p>
          </div>

          <button
            onClick={loadCourses}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80 transition-all active:scale-95 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
            <span>Actualizar</span>
          </button>
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
          <div className="w-12 h-12 rounded-full bg-blue-50 text-[#1F5FA8] flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
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
            return (
              <div
                key={item.enrollmentId}
                className={`ucv-card ucv-card-interactive ucv-animate-in ${delayClass} rounded-xl border-t-2 ${
                  isBlueAccent ? 'border-t-[#1F5FA8]' : 'border-t-[#C8102E]'
                } overflow-hidden flex flex-col justify-between`}
              >

                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                        isBlueAccent
                          ? 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                          : 'bg-red-50 text-[#C8102E] border-red-200'
                      }`}
                    >
                      {course.code}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                      Matrícula Activa
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#0B2A5B]">
                    {course.name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      Sección: <strong className="text-slate-700">{item.section.name}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                      Créditos: <strong className="text-slate-700">{course.credits}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Periodo: <strong className="text-slate-700">{period.name}</strong>
                    </span>
                  </div>
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
