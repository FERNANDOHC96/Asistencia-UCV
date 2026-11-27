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
  FlaskConical,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getStudentAttendanceRecords,
  getStudentEnrollments,
  getClosedSessionsCountBySections,
  StudentEnrollmentWithDetails,
  SectionClosedCounts
} from '../../services/studentService';
import { fetchStudentBlocksBySection } from '../../services/blockService';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { AttendanceRecord, AttendanceStatus, SectionStudentBlockStatus } from '../../types';
import { formatDisplayDate, formatTime, formatLimaTime } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { getMethodLabel } from '../../lib/attendanceUtils';
import { ActionButton, SectionIconBadge } from '../ui';

interface StudentAttendanceScreenProps {
  targetSectionOrCourseRequest?: { refId: string; key: number } | null;
}

export const StudentAttendanceScreen: React.FC<StudentAttendanceScreenProps> = ({
  targetSectionOrCourseRequest = null,
}) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollmentWithDetails[]>([]);
  const [closedSessionsMap, setClosedSessionsMap] = useState<Record<string, SectionClosedCounts>>({});
  const [blockStatusMap, setBlockStatusMap] = useState<Record<string, SectionStudentBlockStatus>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedKindFilter, setSelectedKindFilter] = useState<'all' | 'teoria' | 'practica'>('all');
  const prevTargetKeyRef = React.useRef<number | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {

      const attRecords = await getStudentAttendanceRecords(user.id);
      setRecords(attRecords);

      const enrList = await getStudentEnrollments(user.id);
      setEnrollments(enrList);

      const sectionIds = enrList.map((e) => e.section.id);
      if (sectionIds.length > 0) {
        const [closedCounts, blocks] = await Promise.all([
          getClosedSessionsCountBySections(sectionIds),
          fetchStudentBlocksBySection(user.id, sectionIds).catch(() => ({})),
        ]);
        setClosedSessionsMap(closedCounts);
        setBlockStatusMap(blocks);
      } else {
        setClosedSessionsMap({});
        setBlockStatusMap({});
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

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`student-attendance-blocks-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_section_blocks',
          filter: `student_id=eq.${user.id}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadData]);

  useEffect(() => {
    if (!targetSectionOrCourseRequest) {
      if (prevTargetKeyRef.current !== null) {
        setSelectedCourseFilter('all');
      }
      prevTargetKeyRef.current = null;
      return;
    }

    prevTargetKeyRef.current = targetSectionOrCourseRequest.key;
    if (enrollments.length === 0) return;

    const targetId = targetSectionOrCourseRequest.refId;
    const matchBySection = enrollments.find(
      (enr) => enr.section.id === targetId
    );
    if (matchBySection) {
      setSelectedCourseFilter(matchBySection.section.id);
      return;
    }

    const matchByCourse = enrollments.find(
      (enr) => enr.section.offering.course.id === targetId
    );
    if (matchByCourse) {
      setSelectedCourseFilter(matchByCourse.section.id);
    }
  }, [targetSectionOrCourseRequest, enrollments]);

  const courseSummaries = useMemo(() => {
    return enrollments.map((item) => {
      const sectionId = item.section.id;
      const course = item.section.offering.course;

      const sectionRecords = records.filter(
        (r) => (r.class_session as any)?.section_id === sectionId
      );

      const teoriaRecords = sectionRecords.filter(
        (r) => ((r.class_session as any)?.kind || 'teoria') === 'teoria'
      );
      const practicaRecords = sectionRecords.filter(
        (r) => (r.class_session as any)?.kind === 'practica'
      );

      const closedCounts = closedSessionsMap[sectionId] || { teoria: 0, practica: 0, total: 0 };

      const presentesTeoria = teoriaRecords.filter((r) => r.status === 'presente').length;
      const tardanzasTeoria = teoriaRecords.filter((r) => r.status === 'tardanza').length;
      const faltasTeoria = teoriaRecords.filter((r) => r.status === 'falta').length;
      const justificadosTeoria = teoriaRecords.filter((r) => r.status === 'justificado').length;
      const closedTeoria = closedCounts.teoria;
      const percentageTeoria =
        closedTeoria > 0 ? Math.round((presentesTeoria / closedTeoria) * 100) : null;

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

        teoria: {
          presentes: presentesTeoria,
          tardanzas: tardanzasTeoria,
          faltas: faltasTeoria,
          justificados: justificadosTeoria,
          closedSessions: closedTeoria,
          percentage: percentageTeoria,
        },

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

      <div className="ucv-card-pro rounded-2xl overflow-hidden">
        <div className="h-[3px] w-full ucv-topbar-split" />
        <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <SectionIconBadge icon={CalendarCheck} variant="blue" size="md" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B] tracking-[-0.02em]">Mi Historial de Asistencia</h1>
              <p className="text-xs text-slate-500 mt-1">
                Visualización oficial de sus registros de asistencia, porcentajes de cumplimiento y detalle sesión por sesión.
              </p>
            </div>
          </div>

          <ActionButton
            icon={RefreshCw}
            variant="secondary"
            size="sm"
            spinningIcon={loading}
            disabled={loading}
            onClick={loadData}
            className="self-start sm:self-auto"
          >
            Actualizar
          </ActionButton>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" strokeWidth={1.85} />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-900">Error al consultar asistencia</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!loading && courseSummaries.some((cs) => blockStatusMap[cs.sectionId]?.isBlocked) && (
        <div className="ucv-card p-4 rounded-2xl bg-red-50/75 border border-red-200 flex items-start gap-3 ucv-slide-down">
          <ShieldAlert className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" strokeWidth={1.85} />
          <div className="text-xs text-red-900 space-y-1 flex-1">
            <h4 className="font-bold text-[#C8102E]">
              Inhabilitación activa en curso(s) específico(s)
            </h4>
            <p className="text-red-800">
              No podrás registrar asistencia por QR ni Bluetooth en los cursos señalados como <strong>INHABILITADO</strong> hasta que Administración te rehabilite. Tus demás cursos siguen habilitados con normalidad.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {courseSummaries
                .filter((cs) => blockStatusMap[cs.sectionId]?.isBlocked)
                .map((cs) => (
                  <span
                    key={cs.sectionId}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-red-200/85 text-[#C8102E] font-semibold text-[11px]"
                  >
                    {cs.courseCode} ({cs.courseName}) — Sec. {cs.sectionName}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="ucv-card p-5 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-[#1F5FA8] shrink-0 mt-0.5" strokeWidth={1.85} />
        <div className="text-xs text-slate-700 space-y-2 flex-1">
          <strong className="text-[#0B2A5B] block font-bold text-xs">
            Fórmula de cálculo de asistencia por tipo (Teoría y Práctica):
          </strong>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px] font-mono">
            <div className="bg-slate-50/85 p-3 rounded-xl border border-blue-200/80">
              <span className="text-[#0B2A5B] font-bold block mb-0.5 font-sans">Asistencia de Teoría:</span>
              <span className="text-[#1F5FA8] font-semibold">
                (Presentes Teoría ÷ Sesiones Cerradas Teoría) × 100
              </span>
            </div>
            <div className="bg-slate-50/85 p-3 rounded-xl border border-red-200/80">
              <span className="text-[#0B2A5B] font-bold block mb-0.5 font-sans">Asistencia de Práctica:</span>
              <span className="text-[#C8102E] font-semibold">
                (Presentes Práctica ÷ Sesiones Cerradas Práctica) × 100
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            * Si un tipo no tiene sesiones concluidas, se muestra <strong>«Sin sesiones cerradas»</strong> en vez de 0%. Las sesiones programadas o futuras <strong>NUNCA</strong> se contabilizan como ausencias.
          </p>
        </div>
      </div>

      <div className="ucv-card p-5 rounded-2xl space-y-4">
        <h2 className="text-[11px] uppercase font-bold text-[#0B2A5B] tracking-[0.06em] flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[#C8102E]" strokeWidth={1.85} />
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
            {courseSummaries.map((cs, idx) => {
              const isLowTeoria = cs.teoria.closedSessions > 0 && (cs.teoria.percentage ?? 0) < 70;
              const isLowPractica = cs.practica.closedSessions > 0 && (cs.practica.percentage ?? 0) < 70;
              const isBlueAccent = idx % 2 === 0;
              const isSelectedCourse = selectedCourseFilter === cs.sectionId;
              const blockStatus = blockStatusMap[cs.sectionId];
              const isCourseBlocked = Boolean(blockStatus?.isBlocked);
              const cycleAbsences = blockStatus?.cycleAbsences ?? 0;
              const isWarning = !isCourseBlocked && cycleAbsences === 2;

              return (
                <div
                  key={cs.sectionId}
                  onClick={() => setSelectedCourseFilter(isSelectedCourse ? 'all' : cs.sectionId)}
                  className={`ucv-card-interactive p-4 rounded-xl border border-t-2 cursor-pointer transition-all ${
                    isCourseBlocked
                      ? 'border-red-300 border-t-[#C8102E] bg-red-50/30 shadow-xs'
                      : isSelectedCourse
                      ? 'border-[#C8102E] border-t-[#C8102E] ring-2 ring-[#C8102E]/25 bg-white shadow-sm'
                      : `border-slate-200/90 ${
                          isBlueAccent ? 'border-t-[#1F5FA8]' : 'border-t-[#C8102E]'
                        } bg-slate-50/40`
                  } flex flex-col justify-between space-y-3`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
                      <span
                        className={`font-mono text-[11px] font-bold ${
                          isBlueAccent ? 'text-[#1F5FA8]' : 'text-[#C8102E]'
                        }`}
                      >
                        {cs.courseCode}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isSelectedCourse && (
                          <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-[#C8102E] border border-red-200">
                            Filtrado
                          </span>
                        )}
                        {isCourseBlocked ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-100 text-[#C8102E] border border-red-300">
                            <ShieldAlert className="w-2.5 h-2.5" />
                            INHABILITADO
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            2/3 Faltas
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Habilitado
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                          Sec. {cs.sectionName}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-[#0B2A5B] line-clamp-1">
                      {cs.courseName}
                    </h4>
                  </div>

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
                          className={`text-sm font-bold font-mono tabular-nums ${
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
                        <div className="flex justify-between text-[10px] text-slate-500 pt-0.5 font-mono tabular-nums">
                          <span>{cs.teoria.presentes} presentes de {cs.teoria.closedSessions} cerradas</span>
                          {cs.teoria.faltas > 0 && <span className="text-red-600 font-semibold">{cs.teoria.faltas} falta(s)</span>}
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">
                        Aún no hay clases de teoría concluidas
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200/85 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#0B2A5B] flex items-center gap-1">
                        <FlaskConical className="w-3.5 h-3.5 text-[#C8102E]" strokeWidth={1.85} />
                        Práctica:
                      </span>
                      {cs.practica.closedSessions === 0 ? (
                        <span className="text-[11px] font-medium text-slate-500 italic bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          Sin sesiones cerradas
                        </span>
                      ) : (
                        <span
                          className={`text-sm font-bold font-mono tabular-nums ${
                            isLowPractica ? 'text-[#C8102E]' : 'text-emerald-700'
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
                              isLowPractica ? 'bg-[#C8102E]' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, cs.practica.percentage ?? 0))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 pt-0.5 font-mono tabular-nums">
                          <span>{cs.practica.presentes} presentes de {cs.practica.closedSessions} cerradas</span>
                          {cs.practica.faltas > 0 && <span className="text-red-600 font-semibold">{cs.practica.faltas} falta(s)</span>}
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">
                        Aún no hay clases prácticas concluidas
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60 font-medium font-mono tabular-nums">
                    <span className={isCourseBlocked ? 'text-[#C8102E] font-bold' : isWarning ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                      Faltas ciclo: {cycleAbsences}/3
                    </span>
                    <span className="text-slate-400 font-sans">
                      Total: {cs.totalClosed} sesión(es) concluida(s)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="ucv-card p-4 rounded-2xl flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mr-2">
          <Filter className="w-4 h-4 text-[#C8102E]" strokeWidth={1.85} />
          <span>Filtros:</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Asignatura:</span>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="h-9 text-xs px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]/20 focus:border-[#1F5FA8] cursor-pointer"
          >
            <option value="all">Todas las asignaturas ({enrollments.length})</option>
            {enrollments.map((enr) => (
              <option key={enr.section.id} value={enr.section.id}>
                {enr.section.offering.course.code} - Sec. {enr.section.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Estado:</span>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="h-9 text-xs px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]/20 focus:border-[#1F5FA8] cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="presente">Presente</option>
            <option value="tardanza">Tardanza</option>
            <option value="falta">Falta</option>
            <option value="justificado">Justificado</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Tipo:</span>
          <select
            value={selectedKindFilter}
            onChange={(e) => setSelectedKindFilter(e.target.value as 'all' | 'teoria' | 'practica')}
            className="h-9 text-xs px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]/20 focus:border-[#1F5FA8] cursor-pointer"
          >
            <option value="all">Todos los tipos</option>
            <option value="teoria">Teoría</option>
            <option value="practica">Práctica</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500 font-medium">
          {selectedCourseFilter !== 'all' && (
            <ActionButton
              variant="ghost"
              size="xs"
              onClick={() => setSelectedCourseFilter('all')}
              className="text-[#1F5FA8] hover:text-[#0B2A5B]"
            >
              Ver todas
            </ActionButton>
          )}
          <span>
            Mostrando <strong className="text-[#0B2A5B] font-mono tabular-nums">{filteredRecords.length}</strong> registro(s)
          </span>
        </div>
      </div>

      <div className="ucv-card rounded-2xl overflow-hidden">
        <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-[11px] uppercase tracking-[0.06em] font-bold text-[#0B2A5B] flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#1F5FA8]" strokeWidth={1.85} />
            Detalle Sesión por Sesión
          </h3>
          <span className="text-xs font-semibold text-[#C8102E] bg-red-50 border border-red-200/85 px-2.5 py-0.5 rounded-md font-mono tabular-nums">
            {filteredRecords.length} registro(s) encontrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-[11px] font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-[0.06em]">
                <th className="py-3 px-4">Asignatura</th>
                <th className="py-3 px-4 text-center">Tipo</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Horario</th>
                <th className="py-3 px-4">Tema de Clase</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Método</th>
                <th className="py-3 px-4">Hora Registro</th>
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
                    <tr key={rec.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-[#0B2A5B]">
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
                              ? 'bg-red-50 text-[#C8102E] border-red-200'
                              : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                          }`}
                        >
                          {sessionKind === 'practica' ? (
                            <FlaskConical className="w-3 h-3 text-[#C8102E]" />
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
                        <span className="inline-block text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {getMethodLabel(rec.method)}
                        </span>
                        {rec.bt_verified_at && (
                          <span className="block text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded mt-1">
                            Verificado por Bluetooth
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                        {rec.registered_at ? formatLimaTime(rec.registered_at) : '—'}
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
