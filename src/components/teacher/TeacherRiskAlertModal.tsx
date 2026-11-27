import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  X,
  BookOpen,
  Layers,
  Calendar,
  Users,
  ShieldAlert,
  TrendingDown,
  Repeat,
  Lightbulb,
  FileText,
  ArrowRight,
  ArrowLeft,
  Trash2,
  MailOpen,
  Mail,
  Ban,
  CheckCircle2,
  Bell,
  ChevronDown,
  ChevronUp,
  History,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { formatDisplayDate, formatLimaDateTime } from '../../lib/dateUtils';
import { AttendanceStatus } from '../../types';
import { ActionButton, IconActionButton, SectionIconBadge } from '../ui';

interface TeacherRiskAlertModalProps {
  onNavigate?: (tab: string) => void;
}

function getRiskBadgeClasses(riskLevel: string | null | undefined): string {
  const lower = (riskLevel || '').toLowerCase();
  if (lower.includes('crít') || lower.includes('crit') || lower.includes('muy alto') || lower.includes('alto')) {
    return 'bg-red-100 text-[#C8102E] border-red-200';
  }
  if (lower.includes('medio') || lower.includes('moderado')) {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  if (lower.includes('bajo')) {
    return 'bg-blue-100 text-[#1F5FA8] border-blue-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function getStatusBadgeInfo(status: AttendanceStatus): { label: string; classes: string } {
  switch (status) {
    case 'presente':
      return { label: 'Presente', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'tardanza':
      return { label: 'Tardanza', classes: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'justificado':
      return { label: 'Justificado', classes: 'bg-blue-50 text-[#1F5FA8] border-blue-200' };
    case 'falta':
    default:
      return { label: 'Falta', classes: 'bg-red-50 text-[#C8102E] border-red-200' };
  }
}

export const TeacherRiskAlertModal: React.FC<TeacherRiskAlertModalProps> = ({ onNavigate }) => {
  const {
    selectedTeacherAlert,
    closeTeacherAlert,
    markLiveAlertRead,
    markLiveAlertUnread,
    dismissLiveRiskAlert,
    openNotificationDetail,
  } = useNotifications();

  const [confirmDismiss, setConfirmDismiss] = useState<boolean>(false);
  const [dismissing, setDismissing] = useState<boolean>(false);
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [expandedHistoryMap, setExpandedHistoryMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setConfirmDismiss(false);
    setDismissing(false);
    setDismissError(null);
    if (selectedTeacherAlert?.details.students.length === 1) {
      const onlyKey =
        selectedTeacherAlert.details.students[0].studentId ||
        selectedTeacherAlert.details.students[0].code ||
        selectedTeacherAlert.details.students[0].name;
      setExpandedHistoryMap({ [onlyKey]: true });
    } else {
      setExpandedHistoryMap({});
    }
  }, [selectedTeacherAlert?.id]);

  useEffect(() => {
    if (!selectedTeacherAlert) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTeacherAlert();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTeacherAlert, closeTeacherAlert]);

  if (!selectedTeacherAlert) return null;

  const details = selectedTeacherAlert.details;
  const riskLabel = details.isResolved ? 'Sin riesgo' : details.riskLevel || 'Bajo';
  const totalAbsencesCount = details.absencesCount || '0';
  const maxAbsencesNum = details.maxAbsencesNum ?? 0;
  const absencePercentage = details.absencePercentage || '0%';
  const consecutiveAbsences = details.consecutiveAbsences || '0';
  const evaluatedSessionsCount = details.evaluatedSessionsCount ?? 0;
  const students = details.students || [];
  const recommendation = details.recommendation || null;
  const fullContent = details.formattedBody;
  const originalNotification = selectedTeacherAlert.notification;
  const isUnread = !selectedTeacherAlert.readAt;

  const handleGoToCourses = () => {
    closeTeacherAlert();
    onNavigate?.('mis_cursos');
  };

  const handleToggleRead = () => {
    if (isUnread) {
      markLiveAlertRead(selectedTeacherAlert);
    } else {
      markLiveAlertUnread(selectedTeacherAlert);
    }
  };

  const handleOpenNotification = () => {
    if (!originalNotification) return;
    closeTeacherAlert();
    openNotificationDetail(originalNotification);
  };

  const handleConfirmDismiss = async () => {
    setDismissing(true);
    setDismissError(null);
    try {
      await dismissLiveRiskAlert(selectedTeacherAlert);
      setConfirmDismiss(false);
    } catch (err: unknown) {
      setDismissError(
        err instanceof Error ? err.message : 'No se pudo eliminar la alerta.'
      );
    } finally {
      setDismissing(false);
    }
  };

  const toggleStudentHistory = (key: string) => {
    setExpandedHistoryMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detalle completo de alerta de riesgo de asistencia"
      onClick={closeTeacherAlert}
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-3xl ucv-card rounded-2xl overflow-hidden bg-white shadow-2xl border border-slate-200 my-auto"
      >
        <div className="h-1.5 w-full ucv-topbar-split" />

        <div className="px-5 py-4 sm:px-6 border-b border-slate-100 flex items-start justify-between gap-3 bg-red-50/35">
          <div className="flex items-start gap-3 min-w-0">
            <SectionIconBadge
              icon={details.isResolved ? CheckCircle2 : AlertTriangle}
              variant={details.isResolved ? 'emerald' : 'red'}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-md bg-red-50 text-[#C8102E] border border-red-200/85">
                  Alerta Docente
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-md border ${
                    details.isResolved
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/85'
                      : getRiskBadgeClasses(details.riskLevel)
                  }`}
                >
                  Nivel de riesgo: {riskLabel}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-md border ${
                    isUnread
                      ? 'bg-[#C8102E] text-white border-[#C8102E]'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {isUnread ? 'Sin leer' : 'Leída'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#0B2A5B] mt-1 leading-snug tracking-[-0.015em]">
                {selectedTeacherAlert.title}
              </h2>
            </div>
          </div>

          <IconActionButton
            icon={X}
            label="Cerrar alerta"
            variant="neutral"
            size="sm"
            tooltipSide="bottom"
            onClick={closeTeacherAlert}
          />
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50/85 border border-slate-200/80">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-[#1F5FA8]" strokeWidth={1.85} />
                Código del curso
              </span>
              <p className="font-mono font-bold text-[#0B2A5B] mt-1">
                {selectedTeacherAlert.courseCode || '—'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/85 border border-slate-200/80">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-[#1F5FA8]" strokeWidth={1.85} />
                Nombre del curso
              </span>
              <p className="font-bold text-[#0B2A5B] mt-1 leading-snug">
                {selectedTeacherAlert.courseName}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/85 border border-slate-200/80">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#C8102E]" strokeWidth={1.85} />
                Sección
              </span>
              <p className="font-bold text-[#0B2A5B] mt-1">
                Sección {selectedTeacherAlert.sectionName}
                {selectedTeacherAlert.periodName ? ` (${selectedTeacherAlert.periodName})` : ''}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/85 border border-slate-200/80">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" strokeWidth={1.85} />
                Fecha de generación
              </span>
              <p className="font-semibold text-slate-700 font-mono tabular-nums mt-1">
                {formatLimaDateTime(selectedTeacherAlert.createdAt)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-red-50/65 border border-red-200/80">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-red-700 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" strokeWidth={1.85} />
                Nivel de riesgo
              </span>
              <p className="text-sm font-bold text-[#C8102E] mt-1">{riskLabel}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {students.length} alumno(s) identificado(s)
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/85 border border-slate-200/80">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-[#C8102E]" strokeWidth={1.85} />
                Total de faltas
              </span>
              <p className="text-sm font-bold text-[#0B2A5B] font-mono tabular-nums mt-1">
                {totalAbsencesCount}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {students.length > 1 ? `Máx. ${maxAbsencesNum}/alumno · ` : ''}
                {evaluatedSessionsCount} ses. eval.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/85 border border-slate-200/80">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-[#1F5FA8]" strokeWidth={1.85} />
                % de faltas
              </span>
              <p className="text-sm font-bold text-[#0B2A5B] font-mono tabular-nums mt-1">
                {absencePercentage}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Máximo en sección</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/85 border border-slate-200/80">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 flex items-center gap-1">
                <Repeat className="w-3 h-3 text-amber-600" strokeWidth={1.85} />
                Faltas consecutivas
              </span>
              <p className="text-sm font-bold text-[#0B2A5B] font-mono tabular-nums mt-1">
                {consecutiveAbsences}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Racha actual máxima</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#0B2A5B] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#C8102E]" strokeWidth={1.85} />
              <span>Alumnos identificados ({students.length})</span>
            </h3>

            {students.length > 0 ? (
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden">
                {students.map((st, idx) => {
                  const stKey = st.studentId || st.code || st.name || String(idx);
                  const isHistoryExpanded = Boolean(expandedHistoryMap[stKey]);
                  const absenceDates = st.absenceDates || [];
                  const historyList = st.attendanceHistory || [];

                  return (
                    <div key={`${stKey}-${idx}`} className="p-4 space-y-3 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {st.code && (
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[#0B2A5B]">
                                Cód. {st.code}
                              </span>
                            )}
                            <span className="font-extrabold text-slate-900 text-sm">
                              {st.name}
                            </span>
                            {st.isBlocked && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-extrabold uppercase">
                                <Ban className="w-3 h-3" />
                                INHABILITADO
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                            {st.careerName && <span>{st.careerName}</span>}
                            {typeof st.evaluatedSessionsNum === 'number' && (
                              <span>
                                Asistencias:{' '}
                                <strong className="text-slate-700">{st.attendedNum ?? 0}</strong>/
                                {st.evaluatedSessionsNum} ses. eval.
                                {(st.tardanzasNum ?? 0) > 0 ? ` · ${st.tardanzasNum} tard.` : ''}
                                {(st.justificadosNum ?? 0) > 0 ? ` · ${st.justificadosNum} justif.` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] shrink-0">
                          {st.riskLevel && (
                            <span
                              className={`font-bold px-2 py-0.5 rounded border ${getRiskBadgeClasses(
                                st.riskLevel
                              )}`}
                            >
                              Riesgo {st.riskLevel}
                            </span>
                          )}
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-red-50 text-[#C8102E] border border-red-200">
                            {st.absencesNum ?? 0} falta(s)
                          </span>
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#1F5FA8] border border-blue-200">
                            {st.absencePercentage || '0%'}
                          </span>
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            {st.consecutiveAbsencesNum ?? 0} consec.
                            {st.maxConsecutiveAbsencesNum &&
                            st.maxConsecutiveAbsencesNum > (st.consecutiveAbsencesNum ?? 0)
                              ? ` (máx. ${st.maxConsecutiveAbsencesNum})`
                              : ''}
                          </span>
                        </div>
                      </div>

                      {absenceDates.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 bg-red-50/50 border border-red-100 rounded-lg px-2.5 py-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#C8102E] mr-1">
                            Fechas de faltas:
                          </span>
                          {absenceDates.map((d, dIdx) => (
                            <span
                              key={`${d}-${dIdx}`}
                              className="px-2 py-0.5 rounded bg-white border border-red-200 text-[11px] font-mono font-semibold text-slate-800"
                            >
                              {formatDisplayDate(d)}
                            </span>
                          ))}
                        </div>
                      )}

                      {historyList.length > 0 && (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => toggleStudentHistory(stKey)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200/70 text-[11px] font-bold text-[#1F5FA8] hover:text-[#0B2A5B] cursor-pointer transition-colors"
                          >
                            <History className="w-3.5 h-3.5" strokeWidth={1.9} />
                            <span>
                              {isHistoryExpanded
                                ? `Ocultar historial de asistencia (${historyList.length} sesiones)`
                                : `Ver historial de asistencia relevante (${historyList.length} sesiones)`}
                            </span>
                            {isHistoryExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.9} />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.9} />
                            )}
                          </button>

                          {isHistoryExpanded && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50/70 divide-y divide-slate-200/70 max-h-52 overflow-y-auto">
                              {historyList.map((entry) => {
                                const badge = getStatusBadgeInfo(entry.status);
                                return (
                                  <div
                                    key={entry.sessionId}
                                    className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-[#0B2A5B]">
                                          {formatDisplayDate(entry.date)}
                                          {entry.startsAt ? ` · ${entry.startsAt}` : ''}
                                        </span>
                                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600">
                                          {entry.kind === 'practica' ? 'Práctica' : 'Teoría'}
                                        </span>
                                      </div>
                                      <p className="text-slate-600 truncate mt-0.5">{entry.topic}</p>
                                    </div>
                                    <span
                                      className={`px-2 py-0.5 rounded border text-[10px] font-extrabold uppercase shrink-0 ${badge.classes}`}
                                    >
                                      {badge.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-600 bg-emerald-50/70 rounded-xl border border-emerald-200 p-3">
                Los registros actuales de asistencia no presentan alumnos en riesgo para esta sección.
              </p>
            )}
          </div>

          {recommendation && (
            <div className="p-4 rounded-xl bg-blue-50/65 border border-blue-200/85 space-y-1">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#0B2A5B] flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-[#1F5FA8]" strokeWidth={1.85} />
                <span>Recomendaciones para prevenir la pérdida del curso</span>
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">{recommendation}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.85} />
              <span>Resumen actualizado de la sección</span>
            </h3>
            <div className="p-3.5 rounded-xl bg-slate-50/85 border border-slate-200/80 text-xs text-slate-700 whitespace-pre-line leading-relaxed break-words">
              {fullContent}
            </div>
          </div>

          {dismissError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-900">
              {dismissError}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 sm:px-6 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              icon={isUnread ? MailOpen : Mail}
              variant={isUnread ? 'view' : 'secondary'}
              size="sm"
              onClick={handleToggleRead}
            >
              {isUnread ? 'Marcar como leída' : 'Marcar no leída'}
            </ActionButton>

            {originalNotification && (
              <ActionButton
                icon={Bell}
                variant="view"
                size="sm"
                onClick={handleOpenNotification}
              >
                Ver notificación
              </ActionButton>
            )}

            {confirmDismiss ? (
              <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-50 border border-red-200">
                <span className="text-[11px] font-semibold text-red-900">
                  ¿Eliminar alerta? No borra asistencias.
                </span>
                <ActionButton
                  variant="secondary"
                  size="xs"
                  disabled={dismissing}
                  onClick={() => setConfirmDismiss(false)}
                >
                  Cancelar
                </ActionButton>
                <ActionButton
                  icon={Trash2}
                  variant="brand"
                  size="xs"
                  loading={dismissing}
                  onClick={handleConfirmDismiss}
                >
                  {dismissing ? 'Eliminando...' : 'Confirmar'}
                </ActionButton>
              </div>
            ) : (
              <ActionButton
                icon={Trash2}
                variant="delete"
                size="sm"
                onClick={() => setConfirmDismiss(true)}
              >
                Eliminar alerta
              </ActionButton>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigate && (
              <ActionButton
                iconRight={ArrowRight}
                variant="view"
                size="sm"
                onClick={handleGoToCourses}
              >
                Ir a Mis Cursos
              </ActionButton>
            )}
            <ActionButton
              icon={ArrowLeft}
              variant="primary"
              size="sm"
              onClick={closeTeacherAlert}
            >
              Volver al listado de alertas
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
};
