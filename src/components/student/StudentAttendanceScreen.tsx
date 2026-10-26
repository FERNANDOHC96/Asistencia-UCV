import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarCheck,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  BookOpen,
  PieChart,
  Calendar,
  Layers,
  Info,
  FlaskConical
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getStudentAttendanceRecords,
  getStudentEnrollments,
  getClosedSessionsCountBySections,
  StudentEnrollmentWithDetails,
  SectionClosedCounts
} from '../../services/studentService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { formatDisplayDate, formatTime } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';

export const StudentAttendanceScreen: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollmentWithDetails[]>([]);
  const [closedSessionsMap, setClosedSessionsMap] = useState<Record<string, SectionClosedCounts>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedKindFilter, setSelectedKindFilter] = useState<'all' | 'teoria' | 'practica'>('all');

  const loadData = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Obtener registros de asistencia personales con class_session anidado
      const attRecords = await getStudentAttendanceRecords(user.id);
      setRecords(attRecords);

      // 2. Obtener asignaturas matriculadas
      const enrList = await getStudentEnrollments(user.id);
      setEnrollments(enrList);

      // 3. Obtener conteo de sesiones cerradas de sus secciones
      const sectionIds = enrList.map((e) => e.section.id);
      if (sectionIds.length > 0) {
        const closedCounts = await getClosedSessionsCountBySections(sectionIds);
        setClosedSessionsMap(closedCounts);
      }
    } catch (err: any) {
      setError(translateSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Resumen de asistencia por asignatura matriculada desglosado por Teoría y Práctica
  const courseSummaries = useMemo(() => {
    return enrollments.map((item) => {
      const sectionId = item.section.id;
      const course = item.section.offering.course;

      // Filtrar registros correspondientes a sesiones de esta sección
      const sectionRecords = records.filter(
        (r) => (r.class_session as any)?.section_id === sectionId
      );

      // Separación estricta por tipo: Teoría y Práctica
      const teoriaRecords = sectionRecords.filter(
        (r) => ((r.class_session as any)?.kind || 'teoria') === 'teoria'
      );
      const practicaRecords = sectionRecords.filter(
        (r) => (r.class_session as any)?.kind === 'practica'
      );

      const closedCounts = closedSessionsMap[sectionId] || { teoria: 0, practica: 0, total: 0 };

      // Métricas de Teoría
      const presentesTeoria = teoriaRecords.filter((r) => r.status === 'presente').length;
      const tardanzasTeoria = teoriaRecords.filter((r) => r.status === 'tardanza').length;
      const faltasTeoria = teoriaRecords.filter((r) => r.status === 'falta').length;
      const justificadosTeoria = teoriaRecords.filter((r) => r.status === 'justificado').length;
      const closedTeoria = closedCounts.teoria;
      const percentageTeoria =
        closedTeoria > 0 ? Math.round((presentesTeoria / closedTeoria) * 100) : null;

      // Métricas de Práctica
      const presentesPractica = practicaRecords.filter((r) => r.status === 'presente').length;
      const tardanzasPractica = practicaRecords.filter((r) => r.status === 'tardanza').length;
      const faltasPractica = practicaRecords.filter((r) => r.status === 'falta').length;
      const justificadosPractica = practicaRecords.filter((r) => r.status === 'justificado').length;
      const closedPractica = closedCounts.practica;
      const percentagePractica =
        closedPractica > 0 ? Math.round((presentesPractica / closedPractica) * 100) : null;

      return {
        sectionId,
        courseCode: course.code,
        courseName: course.name,
        sectionName: item.section.name,
        // Teoría
        teoria: {
          presentes: presentesTeoria,
          tardanzas: tardanzasTeoria,
          faltas: faltasTeoria,
          justificados: justificadosTeoria,
          closedSessions: closedTeoria,
          percentage: percentageTeoria,
        },
        // Práctica
        practica: {
          presentes: presentesPractica,
          tardanzas: tardanzasPractica,
          faltas: faltasPractica,
          justificados: justificadosPractica,
          closedSessions: closedPractica,
          percentage: percentagePractica,
        },
        totalClosed: closedCounts.total,
      };
    });
  }, [enrollments, records, closedSessionsMap]);

  // Filtrado de la tabla de registros
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const session = r.class_session as any;
      const sectionId = session?.section_id;
      const kind = session?.kind || 'teoria';

      if (selectedCourseFilter !== 'all' && sectionId !== selectedCourseFilter) {
        return false;
      }

      if (selectedStatusFilter !== 'all' && r.status !== selectedStatusFilter) {
        return false;
      }

      if (selectedKindFilter !== 'all' && kind !== selectedKindFilter) {
        return false;
      }

      return true;
    });
  }, [records, selectedCourseFilter, selectedStatusFilter, selectedKindFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B2A5B]">Mi Historial de Asistencia</h1>
          <p className="text-xs text-slate-500 mt-1">
            Visualización oficial de sus registros de asistencia, porcentajes de cumplimiento y detalle sesión por sesión.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-800">Error al consultar asistencia</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Fórmula del Porcentaje en Pantalla (Requerimiento estricto) */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#1F5FA8] shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 space-y-1.5 flex-1">
          <strong className="text-[#0B2A5B] block font-bold text-xs">
            Fórmula de cálculo de asistencia por tipo (Teoría y Práctica):
          </strong>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-white p-2.5 rounded-lg border border-blue-200 shadow-2xs">
              <span className="text-[#0B2A5B] font-bold block mb-0.5">Asistencia de Teoría:</span>
              <span className="text-[#1F5FA8] font-bold">
                (Presentes Teoría ÷ Sesiones Cerradas Teoría) × 100
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-purple-200 shadow-2xs">
              <span className="text-purple-900 font-bold block mb-0.5">Asistencia de Práctica:</span>
              <span className="text-purple-700 font-bold">
                (Presentes Práctica ÷ Sesiones Cerradas Práctica) × 100
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            * Si un tipo no tiene sesiones concluidas, se muestra <strong>«Sin sesiones cerradas»</strong> en vez de 0%. Las sesiones programadas o futuras <strong>NUNCA</strong> se contabilizan como ausencias.
          </p>
        </div>
      </div>

      {/* Resumen por Asignatura */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[#1F5FA8]" />
          Resumen de Cumplimiento por Asignatura (Teoría y Práctica)
        </h2>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-[#1F5FA8] mx-auto mb-2" />
            <span>Calculando porcentajes de asistencia...</span>
          </div>
        ) : courseSummaries.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">
            No tiene asignaturas matriculadas activas registradas.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseSummaries.map((cs) => {
              const isLowTeoria = cs.teoria.closedSessions > 0 && (cs.teoria.percentage ?? 0) < 70;
              const isLowPractica = cs.practica.closedSessions > 0 && (cs.practica.percentage ?? 0) < 70;

              return (
                <div
                  key={cs.sectionId}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-[11px] font-bold text-[#1F5FA8]">
                        {cs.courseCode}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200 font-bold">
                        Sec. {cs.sectionName}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                      {cs.courseName}
                    </h4>
                  </div>

                  {/* Porcentaje de Teoría */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-[#1F5FA8]" />
                        Teoría:
                      </span>
                      {cs.teoria.closedSessions === 0 ? (
                        <span className="text-[11px] font-bold text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Sin sesiones cerradas
                        </span>
                      ) : (
                        <span
                          className={`text-sm font-black font-mono ${
                            isLowTeoria ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {cs.teoria.percentage}%
                        </span>
                      )}
                    </div>
                    {cs.teoria.closedSessions > 0 ? (
                      <>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isLowTeoria ? 'bg-red-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, cs.teoria.percentage ?? 0))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 pt-0.5 font-mono">
                          <span>{cs.teoria.presentes} presentes de {cs.teoria.closedSessions} cerradas</span>
                          {cs.teoria.faltas > 0 && <span className="text-red-600 font-bold">{cs.teoria.faltas} falta(s)</span>}
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">
                        Aún no hay clases de teoría concluidas
                      </div>
                    )}
                  </div>

                  {/* Porcentaje de Práctica */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                        <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                        Práctica:
                      </span>
                      {cs.practica.closedSessions === 0 ? (
                        <span className="text-[11px] font-bold text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Sin sesiones cerradas
                        </span>
                      ) : (
                        <span
                          className={`text-sm font-black font-mono ${
                            isLowPractica ? 'text-red-600' : 'text-purple-700'
                          }`}
                        >
                          {cs.practica.percentage}%
                        </span>
                      )}
                    </div>
                    {cs.practica.closedSessions > 0 ? (
                      <>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isLowPractica ? 'bg-red-500' : 'bg-purple-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, cs.practica.percentage ?? 0))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 pt-0.5 font-mono">
                          <span>{cs.practica.presentes} presentes de {cs.practica.closedSessions} cerradas</span>
                          {cs.practica.faltas > 0 && <span className="text-red-600 font-bold">{cs.practica.faltas} falta(s)</span>}
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">
                        Aún no hay clases prácticas concluidas
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400 text-right pt-1 border-t border-slate-200/60 font-medium">
                    Total: {cs.totalClosed} sesión(es) concluida(s)
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filtros de la Tabla */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mr-2">
          <Filter className="w-4 h-4 text-[#1F5FA8]" />
          <span>Filtros:</span>
        </div>

        {/* Filtro por Asignatura */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Asignatura:</span>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
          >
            <option value="all">Todas las asignaturas ({enrollments.length})</option>
            {enrollments.map((enr) => (
              <option key={enr.section.id} value={enr.section.id}>
                {enr.section.offering.course.code} - Sec. {enr.section.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Estado */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Estado:</span>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
          >
            <option value="all">Todos los estados</option>
            <option value="presente">Presente</option>
            <option value="tardanza">Tardanza</option>
            <option value="falta">Falta</option>
            <option value="justificado">Justificado</option>
          </select>
        </div>

        {/* Filtro por Tipo */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Tipo:</span>
          <select
            value={selectedKindFilter}
            onChange={(e) => setSelectedKindFilter(e.target.value as 'all' | 'teoria' | 'practica')}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
          >
            <option value="all">Todos los tipos</option>
            <option value="teoria">Teoría</option>
            <option value="practica">Práctica</option>
          </select>
        </div>

        <div className="ml-auto text-xs text-slate-500 font-medium">
          Mostrando <strong className="text-slate-800">{filteredRecords.length}</strong> registro(s)
        </div>
      </div>

      {/* Tabla de Registros de Asistencia */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs uppercase font-bold text-slate-700 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#1F5FA8]" />
            Detalle Sesión por Sesión
          </h3>
          <span className="text-xs font-bold text-slate-500">
            {filteredRecords.length} registro(s) encontrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <th className="py-2.5 px-4">Asignatura</th>
                <th className="py-2.5 px-4 text-center">Tipo</th>
                <th className="py-2.5 px-4">Fecha</th>
                <th className="py-2.5 px-4">Horario</th>
                <th className="py-2.5 px-4">Tema de Clase</th>
                <th className="py-2.5 px-4 text-center">Estado</th>
                <th className="py-2.5 px-4 text-center">Método</th>
                <th className="py-2.5 px-4">Hora Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-[#1F5FA8]" />
                    <span>Cargando historial de asistencia...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                    No se encontraron registros de asistencia para los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const sess = rec.class_session as any;
                  const sec = sess?.section;
                  const course = sec?.offering?.course;
                  const sessionKind = sess?.kind === 'practica' ? 'practica' : 'teoria';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-slate-900">
                          {course?.name || 'Asignatura'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {course?.code} • Sec. {sec?.name}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] uppercase border ${
                            sessionKind === 'practica'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                          }`}
                        >
                          {sessionKind === 'practica' ? (
                            <FlaskConical className="w-3 h-3 text-purple-600" />
                          ) : (
                            <BookOpen className="w-3 h-3 text-[#1F5FA8]" />
                          )}
                          <span>{sessionKind === 'practica' ? 'Práctica' : 'Teoría'}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        {sess?.session_date ? formatDisplayDate(sess.session_date) : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[#1F5FA8] whitespace-nowrap">
                        {sess?.starts_at?.slice(0, 5)} - {sess?.ends_at?.slice(0, 5)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate" title={sess?.topic}>
                        {sess?.topic || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] uppercase border ${
                            rec.status === 'presente'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : rec.status === 'tardanza'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : rec.status === 'falta'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {rec.status === 'presente' && <CheckCircle2 className="w-3 h-3" />}
                          {rec.status === 'tardanza' && <Clock className="w-3 h-3" />}
                          {rec.status === 'falta' && <XCircle className="w-3 h-3" />}
                          {rec.status === 'justificado' && <HelpCircle className="w-3 h-3" />}
                          <span>{rec.status}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="font-mono text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {rec.method}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                        {rec.registered_at ? formatTime(rec.registered_at) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
