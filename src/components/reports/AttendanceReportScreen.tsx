import React, { useState, useEffect, useCallback } from 'react';
import {
  FileBarChart2,
  Calendar,
  Download,
  AlertCircle,
  Users,
  CheckCircle2,
  BookOpen,
  FlaskConical,
  Loader2,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getTeacherSections } from '../../services/teacherService';
import {
  getAdminReportSections,
  getAttendanceReport,
  AttendanceReportResult,
  ReportCellStatus,
  ReportSectionOption
} from '../../services/reportService';
import { getTodayLima, formatDisplayDate } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';

function formatShortDayMonth(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

function getCellBadge(status: ReportCellStatus): { label: string; className: string; title: string } {
  switch (status) {
    case 'presente':
      return {
        label: 'P',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        title: 'Presente',
      };
    case 'tardanza':
      return {
        label: 'T',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        title: 'Tardanza',
      };
    case 'falta':
      return {
        label: 'F',
        className: 'bg-red-50 text-[#C8102E] border-red-200',
        title: 'Falta',
      };
    case 'justificado':
      return {
        label: 'J',
        className: 'bg-blue-50 text-[#1F5FA8] border-blue-200',
        title: 'Justificado',
      };
    case 'sin_sesion':
    default:
      return {
        label: '–',
        className: 'bg-slate-50 text-slate-400 border-slate-200',
        title: 'Sin sesión',
      };
  }
}

function getCellLetter(status: ReportCellStatus): string {
  switch (status) {
    case 'presente':
      return 'P';
    case 'tardanza':
      return 'T';
    case 'falta':
      return 'F';
    case 'justificado':
      return 'J';
    default:
      return '–';
  }
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sanitizeFilePart(value: string): string {
  return (value || 'seccion')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

export const AttendanceReportScreen: React.FC = () => {
  const { user, profile } = useAuth();
  const todayLima = getTodayLima();
  const monthStartLima = `${todayLima.slice(0, 8)}01`;

  const [sections, setSections] = useState<ReportSectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(monthStartLima);
  const [toDate, setToDate] = useState<string>(todayLima);

  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>({
    from: monthStartLima,
    to: todayLima,
  });

  const [loadingSections, setLoadingSections] = useState<boolean>(true);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AttendanceReportResult | null>(null);

  const loadSections = useCallback(async () => {
    if (!user || !profile || !isSupabaseConfigured()) {
      setLoadingSections(false);
      return;
    }

    setLoadingSections(true);
    setError(null);

    try {
      let options: ReportSectionOption[] = [];
      if (profile.role === 'profesor') {
        const teacherSecs = await getTeacherSections(user.id);
        options = teacherSecs.map((s) => ({
          id: s.id,
          name: s.name,
          courseCode: s.offering.course.code,
          courseName: s.offering.course.name,
          periodName: s.offering.period.name,
        }));
      } else {
        options = await getAdminReportSections();
      }

      setSections(options);
      if (options.length > 0) {
        setSelectedSectionId((prev) =>
          prev && options.some((o) => o.id === prev) ? prev : options[0].id
        );
      } else {
        setSelectedSectionId('');
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'sections'));
      setSections([]);
    } finally {
      setLoadingSections(false);
    }
  }, [user, profile]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const runReport = useCallback(
    async (sectionId: string, from: string, to: string) => {
      if (!sectionId) return;
      if (!from || !to) {
        setError('Debes seleccionar el rango de fechas (Desde y Hasta).');
        return;
      }
      if (to < from) {
        setError('La fecha "Hasta" debe ser igual o posterior a la fecha "Desde".');
        return;
      }

      setLoadingReport(true);
      setError(null);

      try {
        const result = await getAttendanceReport({ sectionId, from, to });
        setReport(result);
        setAppliedRange({ from, to });
      } catch (err: unknown) {
        setError(translateSupabaseError(err, 'attendance_records'));
        setReport(null);
      } finally {
        setLoadingReport(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!loadingSections && selectedSectionId && !report && !error) {
      runReport(selectedSectionId, fromDate, toDate);
    }
  }, [loadingSections, selectedSectionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runReport(selectedSectionId, fromDate, toDate);
  };

  const handleDownloadCsv = () => {
    if (!report) return;

    const headerCols = [
      'Código',
      'Apellido y nombres',
      ...report.sessions.map((s) => `${formatShortDayMonth(s.date)} ${s.startsAt}`),
      '%',
      'Faltas',
      'Tardanzas',
    ];

    const rows: string[] = [headerCols.map(escapeCsvCell).join(';')];

    report.students.forEach((st) => {
      const rowCols: Array<string | number> = [
        st.code,
        st.name,
        ...report.sessions.map((sess) => getCellLetter(st.cells[sess.sessionId] || 'sin_sesion')),
        `${st.porcentaje.toFixed(1)}%`,
        st.faltas,
        st.tardanzas,
      ];
      rows.push(rowCols.map(escapeCsvCell).join(';'));
    });

    const totalsCols: Array<string | number> = [
      'TOTALES',
      `${report.students.length} alumnos`,
      ...report.sessions.map((sess) => {
        const pct =
          sess.evaluadas > 0
            ? Math.round(((sess.presentes + sess.tardanzas + sess.justificados) / sess.evaluadas) * 1000) / 10
            : 0;
        return `${pct.toFixed(1)}%`;
      }),
      `${report.totals.averagePercentage.toFixed(1)}%`,
      report.totals.faltas,
      report.totals.tardanzas,
    ];
    rows.push(totalsCols.map(escapeCsvCell).join(';'));

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const secSlug = sanitizeFilePart(report.sectionLabel);
    link.href = url;
    link.download = `asistencia_${secSlug}_${appliedRange.from}_${appliedRange.to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resolvedTeacherName =
    report && report.teacherLabel !== 'Sin docente asignado'
      ? report.teacherLabel
      : profile?.role === 'profesor'
      ? `${profile.last_names || ''} ${profile.first_names || ''}`.trim()
      : report?.teacherLabel || '-';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in print-report-root">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-mono font-bold text-[#0B2A5B] uppercase tracking-wider mb-2">
            <span>Módulo Académico</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0B2A5B]/10 to-[#C8102E]/10 border border-slate-200 text-[#0B2A5B] flex items-center justify-center">
              <FileBarChart2 className="w-5 h-5 text-[#C8102E]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B2A5B] tracking-tight">
              Reportes de Asistencia
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Consulta consolidada por sección y rango de fechas sobre sesiones cerradas, con exportación en CSV
          </p>
        </div>

        {report && report.sessions.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="px-4 py-2 rounded-xl bg-[#C8102E] hover:bg-[#A50D25] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar CSV</span>
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="no-print ucv-card rounded-2xl border-l-4 border-l-[#1F5FA8] p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end text-xs">
          <div className="lg:col-span-5">
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Sección *
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={loadingSections || sections.length === 0}
              className="w-full px-3 py-2.5 font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none cursor-pointer disabled:opacity-60"
            >
              {sections.length === 0 ? (
                <option value="">
                  {loadingSections ? 'Cargando secciones...' : 'No hay secciones disponibles'}
                </option>
              ) : (
                sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.courseCode ? `${sec.courseCode} — ` : ''}
                    {sec.courseName} · Sec. {sec.name} ({sec.periodName})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Desde *
            </label>
            <input
              type="date"
              required
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 font-mono font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Hasta *
            </label>
            <input
              type="date"
              required
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 font-mono font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] transition-all outline-none"
            />
          </div>

          <div className="lg:col-span-3 flex gap-2">
            <button
              type="submit"
              disabled={loadingSections || loadingReport || !selectedSectionId}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0B2A5B] via-[#1F5FA8] to-[#C8102E] hover:brightness-110 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {loadingReport ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{loadingReport ? 'Generando...' : 'Generar reporte'}</span>
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="no-print p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {loadingSections || loadingReport ? (
        <div className="ucv-card rounded-2xl p-14 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-[#1F5FA8] mb-3" />
          <span className="text-xs font-semibold">
            {loadingSections ? 'Cargando secciones...' : 'Generando reporte de asistencia...'}
          </span>
        </div>
      ) : !selectedSectionId ? (
        <div className="ucv-card rounded-2xl p-12 text-center text-xs text-slate-500 font-medium">
          No tienes secciones disponibles para generar reportes.
        </div>
      ) : report && report.sessions.length === 0 ? (
        <div className="ucv-card rounded-2xl p-12 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0B2A5B]">
            No hay sesiones cerradas en ese rango de fechas
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Verifica el rango del {formatDisplayDate(appliedRange.from)} al {formatDisplayDate(appliedRange.to)} o cierra las sesiones correspondientes antes de generar el reporte.
          </p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          <div className="ucv-card rounded-2xl overflow-hidden print-avoid-break">
            <div className="h-1.5 ucv-topbar-split w-full no-print" />
            <div className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#0B2A5B] tracking-tight">
                    UCVGO — Reporte de Asistencia
                  </h2>
                  <p className="text-xs sm:text-sm font-bold text-[#C8102E] mt-1">
                    {report.courseLabel} · Sección {report.sectionLabel}
                  </p>
                </div>
                <div className="text-xs text-slate-600 sm:text-right font-medium">
                  <div>Generado el {formatDisplayDate(todayLima)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Periodo</span>
                  <span className="font-bold text-[#0B2A5B]">{report.periodLabel}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Rango de fechas</span>
                  <span className="font-bold font-mono text-[#0B2A5B]">
                    {formatDisplayDate(appliedRange.from)} al {formatDisplayDate(appliedRange.to)}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Docente</span>
                  <span className="font-bold text-[#0B2A5B]">{resolvedTeacherName}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#1F5FA8] uppercase block">
                      Sesiones evaluadas
                    </span>
                    <strong className="text-xl font-black text-[#0B2A5B] font-mono">
                      {report.totals.sessionsCount}
                    </strong>
                  </div>
                  <Calendar className="w-6 h-6 text-[#1F5FA8] no-print" />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Alumnos
                    </span>
                    <strong className="text-xl font-black text-[#0B2A5B] font-mono">
                      {report.totals.studentsCount}
                    </strong>
                  </div>
                  <Users className="w-6 h-6 text-[#0B2A5B] no-print" />
                </div>

                <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#C8102E] uppercase block">
                      % promedio del curso
                    </span>
                    <strong className="text-xl font-black text-[#C8102E] font-mono">
                      {report.totals.averagePercentage.toFixed(1)}%
                    </strong>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-[#C8102E] no-print" />
                </div>
              </div>
            </div>
          </div>

          <div className="ucv-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold text-[#0B2A5B] uppercase tracking-wider">
                Matriz de Asistencia por Alumno
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                  P = Presente
                </span>
                <span className="px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                  T = Tardanza
                </span>
                <span className="px-2 py-0.5 rounded border bg-red-50 text-[#C8102E] border-red-200">
                  F = Falta
                </span>
                <span className="px-2 py-0.5 rounded border bg-blue-50 text-[#1F5FA8] border-blue-200">
                  J = Justificado
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 print-table">
                <thead className="bg-slate-50 text-[#0B2A5B] font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 whitespace-nowrap">Código</th>
                    <th className="py-3 px-3 min-w-[200px]">Apellido y nombres</th>
                    {report.sessions.map((sess) => (
                      <th key={sess.sessionId} className="py-2.5 px-2 text-center whitespace-nowrap">
                        <div>{formatShortDayMonth(sess.date)}</div>
                        <div className="text-[9px] font-mono font-medium text-slate-500">
                          {sess.startsAt}
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center whitespace-nowrap">%</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Faltas</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Tardanzas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.students.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + report.sessions.length}
                        className="py-8 px-4 text-center text-xs text-slate-500 font-medium"
                      >
                        No hay alumnos matriculados activos en esta sección.
                      </td>
                    </tr>
                  ) : (
                    report.students.map((st) => (
                      <tr key={st.studentId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0B2A5B] whitespace-nowrap">
                          {st.code}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {st.name}
                        </td>
                        {report.sessions.map((sess) => {
                          const cellStatus = st.cells[sess.sessionId] || 'sin_sesion';
                          const badge = getCellBadge(cellStatus);
                          return (
                            <td key={sess.sessionId} className="py-2 px-1.5 text-center">
                              <span
                                title={badge.title}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded border font-mono text-[11px] font-extrabold ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-center font-mono font-extrabold text-[#0B2A5B] whitespace-nowrap">
                          {st.porcentaje.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-[#C8102E]">
                          {st.faltas}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-700">
                          {st.tardanzas}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {report.students.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs text-[#0B2A5B]">
                    <tr>
                      <td className="py-2.5 px-3 font-extrabold uppercase text-[10px]">Totales</td>
                      <td className="py-2.5 px-3 text-slate-600 font-semibold">
                        {report.totals.studentsCount} alumnos evaluados
                      </td>
                      {report.sessions.map((sess) => {
                        const sessPct =
                          sess.evaluadas > 0
                            ? Math.round(
                                ((sess.presentes + sess.tardanzas + sess.justificados) /
                                  sess.evaluadas) *
                                  1000
                              ) / 10
                            : 0;
                        return (
                          <td
                            key={sess.sessionId}
                            className="py-2.5 px-1.5 text-center font-mono text-[10px] text-slate-700"
                          >
                            {sessPct.toFixed(0)}%
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-center font-mono font-black text-[#0B2A5B]">
                        {report.totals.averagePercentage.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-[#C8102E]">
                        {report.totals.faltas}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-amber-700">
                        {report.totals.tardanzas}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="ucv-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-xs font-extrabold text-[#0B2A5B] uppercase tracking-wider">
                Detalle por día
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 print-table">
                <thead className="bg-slate-50 text-[#0B2A5B] font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 whitespace-nowrap">Fecha</th>
                    <th className="py-3 px-3 whitespace-nowrap">Horario</th>
                    <th className="py-3 px-3">Tema</th>
                    <th className="py-3 px-3 whitespace-nowrap">Tipo</th>
                    <th className="py-3 px-2 text-center">P</th>
                    <th className="py-3 px-2 text-center">T</th>
                    <th className="py-3 px-2 text-center">F</th>
                    <th className="py-3 px-2 text-center">J</th>
                    <th className="py-3 px-3 text-center">%</th>
                    <th className="py-3 px-3">Ausentes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.sessions.map((sess) => {
                    const isPractica = sess.kind === 'practica';
                    const pct =
                      sess.evaluadas > 0
                        ? Math.round(
                            ((sess.presentes + sess.tardanzas + sess.justificados) / sess.evaluadas) *
                              1000
                          ) / 10
                        : 0;
                    return (
                      <tr key={sess.sessionId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0B2A5B] whitespace-nowrap">
                          {formatDisplayDate(sess.date)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#1F5FA8] whitespace-nowrap">
                          {sess.startsAt} - {sess.endsAt}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {sess.topic}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                              isPractica
                                ? 'bg-red-50 text-[#C8102E] border-red-200'
                                : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                            }`}
                          >
                            {isPractica ? (
                              <FlaskConical className="w-2.5 h-2.5 no-print" />
                            ) : (
                              <BookOpen className="w-2.5 h-2.5 no-print" />
                            )}
                            <span>{isPractica ? 'Práctica' : 'Teoría'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-700">
                          {sess.presentes}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-700">
                          {sess.tardanzas}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-[#C8102E]">
                          {sess.faltas}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-[#1F5FA8]">
                          {sess.justificados}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-extrabold text-[#0B2A5B] whitespace-nowrap">
                          {pct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          {sess.ausentes.length > 0 ? sess.ausentes.join(', ') : 'Ninguno'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
