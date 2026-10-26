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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0B2A5B]">Mis Asignaturas Matriculadas</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-50 text-[#1F5FA8] border border-blue-200">
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
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-800">Error al consultar asignaturas</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Main List */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-2xs">
          <RefreshCw className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">Cargando asignaturas matriculadas...</p>
          <p className="text-[11px] text-slate-400 mt-1">Consultando registros en Supabase</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-2xs">
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
          {courses.map((item) => {
            const course = item.section.offering.course;
            const period = item.section.offering.period;
            return (
              <div
                key={item.enrollmentId}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between"
              >
                {/* Cabecera del curso */}
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1F5FA8] border border-blue-200">
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

                {/* Docente a cargo */}
                <div className="p-4 bg-slate-50/70 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <UserCheck className="w-3.5 h-3.5 text-[#1F5FA8]" />
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

                {/* Horarios de la sección */}
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
                            className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase border ${
                                  isPractica
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                                }`}
                              >
                                {isPractica ? (
                                  <FlaskConical className="w-2.5 h-2.5 text-purple-600" />
                                ) : (
                                  <BookOpen className="w-2.5 h-2.5 text-[#1F5FA8]" />
                                )}
                                <span>{isPractica ? 'Práctica' : 'Teoría'}</span>
                              </span>
                              <span className="font-bold text-slate-800">
                                {WEEKDAYS[sch.weekday] || `Día ${sch.weekday}`}:
                              </span>
                              <span className="font-mono text-[#1F5FA8] font-bold">
                                {sch.starts_at?.slice(0, 5)} - {sch.ends_at?.slice(0, 5)}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                              <MapPin className="w-3 h-3 text-red-500" />
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
