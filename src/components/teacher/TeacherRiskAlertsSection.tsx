import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  CheckCheck,
  BookOpen,
  Layers,
  Calendar,
  Users,
  Lightbulb,
  Eye,
  ShieldCheck,
  AlertCircle,
  Trash2,
  MailOpen,
  Mail,
  Ban,
  Clock,
  Loader2,
  Bell,
  X,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { formatLimaDateTime } from '../../lib/dateUtils';
import { LiveSectionRiskAlert } from '../../types';
import { ActionButton, IconActionButton } from '../ui';

type RiskFilterOption = 'all' | 'alto' | 'medio' | 'bajo' | 'unread';

function getRiskBadgeStyle(riskLevel: string | null | undefined): string {
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

function matchesRiskFilter(alert: LiveSectionRiskAlert, filter: RiskFilterOption): boolean {
  if (filter === 'all') return true;
  if (filter === 'unread') return !alert.readAt;
  const level = (alert.details.riskLevel || '').toLowerCase();
  if (filter === 'alto') return level.includes('alto') || level.includes('crít') || level.includes('crit');
  if (filter === 'medio') return level.includes('medio') || level.includes('moderad');
  if (filter === 'bajo') return level.includes('bajo');
  return true;
}

export const TeacherRiskAlertsSection: React.FC = () => {
  const {
    notifications,
    liveRiskAlerts,
    liveRiskUnreadCount,
    liveRiskLoading,
    liveRiskRefreshing,
    liveRiskError,
    lastRiskUpdatedAt,
    refreshTeacherRiskAlerts,
    markLiveAlertRead,
    markLiveAlertUnread,
    markAllLiveAlertsRead,
    dismissLiveRiskAlert,
    openTeacherAlert,
    openNotificationDetail,
  } = useNotifications();

  const [filter, setFilter] = useState<RiskFilterOption>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [confirmDismissId, setConfirmDismissId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    refreshTeacherRiskAlerts(true);
  }, [refreshTeacherRiskAlerts]);

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const alert of liveRiskAlerts) {
      if (alert.courseId && !map.has(alert.courseId)) {
        const label = `${alert.courseCode ? `${alert.courseCode} • ` : ''}${alert.courseName}`;
        map.set(alert.courseId, label);
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [liveRiskAlerts]);

  const sectionOptions = useMemo(() => {
    const map = new Map<string, { label: string; courseId: string }>();
    for (const alert of liveRiskAlerts) {
      if (selectedCourseId !== 'all' && alert.courseId !== selectedCourseId) {
        continue;
      }
      if (alert.sectionId && !map.has(alert.sectionId)) {
        const label = `${alert.courseCode ? `${alert.courseCode} · ` : ''}Sec. ${alert.sectionName}`;
        map.set(alert.sectionId, { label, courseId: alert.courseId });
      }
    }
    return Array.from(map.entries()).map(([id, info]) => ({ id, label: info.label }));
  }, [liveRiskAlerts, selectedCourseId]);

  useEffect(() => {
    if (
      selectedSectionId !== 'all' &&
      !sectionOptions.some((s) => s.id === selectedSectionId)
    ) {
      setSelectedSectionId('all');
    }
  }, [sectionOptions, selectedSectionId]);

  const filteredAlerts = useMemo(() => {
    return liveRiskAlerts.filter((alert) => {
      if (selectedCourseId !== 'all' && alert.courseId !== selectedCourseId) {
        return false;
      }
      if (selectedSectionId !== 'all' && alert.sectionId !== selectedSectionId) {
        return false;
      }
      return matchesRiskFilter(alert, filter);
    });
  }, [liveRiskAlerts, selectedCourseId, selectedSectionId, filter]);

  const unreadTeacherNotifs = useMemo(
    () =>
      notifications.filter(
        (n) => n.kind === 'riesgo_asistencia_profesor' && !n.read_at
      ),
    [notifications]
  );

  const handleManualRefresh = async () => {
    setActionNotice(null);
    await refreshTeacherRiskAlerts(false);
    setActionNotice({
      type: 'info',
      text: 'Indicadores recalculados en tiempo real desde los registros actuales de asistencia.',
    });
  };

  const handleConfirmDismiss = async (event: React.MouseEvent, alert: LiveSectionRiskAlert) => {
    event.stopPropagation();
    setDismissingId(alert.id);
    setActionNotice(null);
    try {
      await dismissLiveRiskAlert(alert);
      setConfirmDismissId(null);
      setActionNotice({
        type: 'info',
        text: 'Alerta descartada de forma segura sin eliminar registros de asistencia. Solo volverá a aparecer si surge un nuevo evento de riesgo.',
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar la alerta. Verifica tus permisos.';
      setActionNotice({ type: 'error', text: msg });
    } finally {
      setDismissingId(null);
    }
  };

  const handleToggleRead = (event: React.MouseEvent, alert: LiveSectionRiskAlert) => {
    event.stopPropagation();
    if (alert.readAt) {
      markLiveAlertUnread(alert);
    } else {
      markLiveAlertRead(alert);
    }
  };

  const handleOpenNotification = (event: React.MouseEvent, alert: LiveSectionRiskAlert) => {
    event.stopPropagation();
    if (alert.notification) {
      openNotificationDetail(alert.notification);
    }
  };

  const filterButtons: { id: RiskFilterOption; label: string }[] = [
    { id: 'all', label: `Todas (${liveRiskAlerts.length})` },
    { id: 'unread', label: `Sin leer (${liveRiskUnreadCount})` },
    { id: 'alto', label: 'Riesgo Alto' },
    { id: 'medio', label: 'Riesgo Medio' },
    { id: 'bajo', label: 'Riesgo Bajo' },
  ];

  return (
    <section style={{ animationDelay: '230ms' }} className="space-y-4 ucv-card-reveal">
      <div className="rounded-2xl bg-gradient-to-r from-[#FFF1F2] via-[#FFF6F7] to-[#FFF2F4] border border-red-200/80 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_6px_18px_-12px_rgba(200,16,46,0.22)]">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-100/90 border border-red-200/80 text-[#C8102E] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" strokeWidth={1.9} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-[15px] font-bold text-[#0B2A5B] tracking-[-0.015em]">
                Alertas de Riesgo de Inasistencia
              </h2>
              {liveRiskUnreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-[#C8102E] text-white text-[10px] font-semibold">
                  {liveRiskUnreadCount} nueva(s)
                </span>
              )}
            </div>
            {lastRiskUpdatedAt && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-slate-500">
                  <Clock className="w-3 h-3" strokeWidth={1.85} />
                  Actualizado: {formatLimaDateTime(lastRiskUpdatedAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {liveRiskUnreadCount > 0 && (
            <ActionButton
              icon={CheckCheck}
              variant="view"
              size="sm"
              onClick={markAllLiveAlertsRead}
              className="rounded-xl bg-white/95 border-blue-200/90"
            >
              Marcar como leídas
            </ActionButton>
          )}
          <ActionButton
            icon={RefreshCw}
            variant="secondary"
            size="sm"
            spinningIcon={liveRiskLoading || liveRiskRefreshing}
            disabled={liveRiskLoading || liveRiskRefreshing}
            onClick={handleManualRefresh}
            className="rounded-xl bg-white border-slate-200/90 shadow-2xs"
          >
            {liveRiskRefreshing ? 'Actualizando...' : 'Actualizar alertas'}
          </ActionButton>
        </div>
      </div>

      {liveRiskRefreshing && !liveRiskLoading && (
        <div className="px-3.5 py-2 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-[#0B2A5B] flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1F5FA8]" />
          <span className="font-semibold">
            Recalculando alertas e indicadores con los registros actuales de asistencia...
          </span>
        </div>
      )}

      {liveRiskAlerts.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {filterButtons.map((btn) => {
              const active = filter === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setFilter(btn.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0B2A5B] text-white border-[#0B2A5B] shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-[#0B2A5B]'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {courseOptions.length > 0 && (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                aria-label="Filtrar alertas por curso"
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]/20 focus:border-[#1F5FA8] cursor-pointer"
              >
                <option value="all">Todos los cursos ({courseOptions.length})</option>
                {courseOptions.map((crs) => (
                  <option key={crs.id} value={crs.id}>
                    {crs.label}
                  </option>
                ))}
              </select>
            )}

            {sectionOptions.length > 0 && (
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                aria-label="Filtrar alertas por sección"
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]/20 focus:border-[#1F5FA8] cursor-pointer"
              >
                <option value="all">Todas las secciones ({sectionOptions.length})</option>
                {sectionOptions.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {actionNotice && (
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            actionNotice.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-blue-50/80 border-blue-200/80 text-[#0B2A5B]'
          }`}
        >
          <span className="font-medium">{actionNotice.text}</span>
          <IconActionButton
            icon={X}
            label="Ocultar aviso"
            tooltip="Ocultar"
            variant="neutral"
            size="xs"
            onClick={() => setActionNotice(null)}
          />
        </div>
      )}

      {liveRiskError ? (
        <div className="p-4 rounded-xl bg-red-50/90 border border-red-200 text-red-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0" />
            <span className="font-semibold">{liveRiskError}</span>
          </div>
          <ActionButton
            icon={RefreshCw}
            variant="delete"
            size="xs"
            onClick={handleManualRefresh}
          >
            Reintentar
          </ActionButton>
        </div>
      ) : liveRiskLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1].map((idx) => (
            <div key={idx} className="ucv-card-pro rounded-2xl p-5 space-y-3 animate-pulse">
              <div className="h-4 w-1/3 bg-slate-200 rounded" />
              <div className="h-4 w-3/4 bg-slate-200 rounded" />
              <div className="h-14 w-full bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : liveRiskAlerts.length === 0 ? (
        <div className="rounded-2xl bg-gradient-to-r from-[#ECFDF3] via-[#F2FEF7] to-[#E9FCEF] border border-emerald-200/85 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-600 shadow-[0_6px_18px_-12px_rgba(16,185,129,0.2)]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100/90 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" strokeWidth={1.9} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0B2A5B]">No existen alumnos en riesgo</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            {unreadTeacherNotifs.length > 0 && (
              <ActionButton
                icon={Bell}
                variant="view"
                size="sm"
                onClick={() => openNotificationDetail(unreadTeacherNotifs[0])}
                className="rounded-xl bg-white"
              >
                Ver notificación pendiente ({unreadTeacherNotifs.length})
              </ActionButton>
            )}
            <div
              className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs"
              aria-hidden="true"
            >
              <CheckCheck className="w-3.5 h-3.5" strokeWidth={2.3} />
            </div>
          </div>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="ucv-card-pro rounded-2xl p-5 text-xs text-slate-600 flex items-center justify-between gap-3">
          <span>No hay alertas que coincidan con los filtros seleccionados.</span>
          <ActionButton
            variant="secondary"
            size="xs"
            onClick={() => {
              setFilter('all');
              setSelectedCourseId('all');
              setSelectedSectionId('all');
            }}
          >
            Limpiar filtros
          </ActionButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredAlerts.map((alert) => {
            const isUnread = !alert.readAt;
            const details = alert.details;
            const courseDisplay = `${alert.courseCode ? `${alert.courseCode} • ` : ''}${alert.courseName}`;
            const sectionDisplay = `Sec. ${alert.sectionName}`;
            const isConfirming = confirmDismissId === alert.id;
            const isDismissing = dismissingId === alert.id;
            const previewStudents = details.students.slice(0, 3);
            const remainingStudents = Math.max(0, details.students.length - previewStudents.length);

            return (
              <div
                key={alert.id}
                onClick={() => openTeacherAlert(alert)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openTeacherAlert(alert);
                  }
                }}
                className={`ucv-card-pro rounded-2xl overflow-hidden cursor-pointer transition-all flex flex-col justify-between text-left border-t-2 border-t-[#C8102E] ${
                  isUnread
                    ? 'bg-red-50/35 hover:bg-red-50/60 border-red-200/90'
                    : 'bg-white hover:bg-slate-50/80 border-slate-200/90'
                }`}
              >
                <div className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isUnread ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#C8102E] text-white text-[10px] font-semibold uppercase tracking-[0.04em]">
                          Sin leer
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold uppercase tracking-[0.04em]">
                          Leída
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-[0.04em] ${getRiskBadgeStyle(
                          details.riskLevel
                        )}`}
                      >
                        Riesgo: {details.riskLevel || 'Bajo'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-slate-500 flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3" strokeWidth={1.85} />
                      {formatLimaDateTime(alert.createdAt)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#0B2A5B] leading-snug tracking-[-0.01em]">
                      {alert.title}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#0B2A5B] bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/80">
                        <BookOpen className="w-3 h-3 text-[#1F5FA8]" strokeWidth={1.85} />
                        {courseDisplay}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200/80">
                        <Layers className="w-3 h-3 text-[#C8102E]" strokeWidth={1.85} />
                        {sectionDisplay}
                      </span>
                      {alert.periodName && (
                        <span className="text-[10px] font-medium text-slate-500">
                          {alert.periodName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-white/95 border border-slate-200/80">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-400">
                        Total faltas
                      </span>
                      <span className="text-xs font-bold font-mono tabular-nums text-[#C8102E]">
                        {details.absencesCount || '0'}
                      </span>
                      <span className="block text-[9px] text-slate-400 mt-0.5">
                        {details.evaluatedSessionsCount ?? 0} ses. eval.
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/95 border border-slate-200/80">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-400">
                        Mayor % faltas
                      </span>
                      <span className="text-xs font-bold font-mono tabular-nums text-[#0B2A5B]">
                        {details.absencePercentage || '0%'}
                      </span>
                      <span className="block text-[9px] text-slate-400 mt-0.5">
                        Sobre evaluadas
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/95 border border-slate-200/80">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-400">
                        Consecutivas
                      </span>
                      <span className="text-xs font-bold font-mono tabular-nums text-amber-700">
                        {details.consecutiveAbsences || '0'}
                      </span>
                      <span className="block text-[9px] text-slate-400 mt-0.5">
                        Racha reciente
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2 text-slate-700">
                      <Users className="w-3.5 h-3.5 text-[#C8102E] shrink-0 mt-0.5" strokeWidth={1.85} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="font-semibold text-[#0B2A5B] block">
                          Alumnos identificados ({details.students.length}):
                        </span>
                        <div className="space-y-1">
                          {previewStudents.map((st, idx) => (
                            <div
                              key={`${st.studentId || st.code || st.name}-${idx}`}
                              className="flex items-center justify-between gap-2 text-[11px] bg-white/90 border border-slate-200/75 rounded-lg px-2.5 py-1.5"
                            >
                              <span className="font-medium text-slate-800 truncate">
                                {st.code ? `${st.code} · ` : ''}
                                {st.name}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {st.isBlocked && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#C8102E] text-white text-[9px] font-semibold uppercase tracking-[0.04em]">
                                    <Ban className="w-2.5 h-2.5" strokeWidth={1.85} />
                                    INHABILITADO
                                  </span>
                                )}
                                <span className="font-mono tabular-nums font-semibold text-[#C8102E]">
                                  {st.absencesNum ?? 0}f · {st.absencePercentage || '0%'}
                                </span>
                              </div>
                            </div>
                          ))}
                          {remainingStudents > 0 && (
                            <span className="text-[10px] font-medium text-slate-500 block">
                              +{remainingStudents} estudiante(s) más en la vista completa
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {details.recommendation && (
                      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/75 text-slate-700">
                        <Lightbulb className="w-3.5 h-3.5 text-[#1F5FA8] shrink-0 mt-0.5" strokeWidth={1.85} />
                        <p className="text-[11px] leading-snug line-clamp-2">
                          <strong className="text-[#0B2A5B]">Recomendación: </strong>
                          {details.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  onClick={(e) => e.stopPropagation()}
                  className="px-4 py-3 border-t border-slate-100 bg-white/85 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  {isConfirming ? (
                    <div className="w-full flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-700">
                        ¿Eliminar alerta? No borra asistencias ni historial académico.
                      </span>
                      <div className="flex items-center gap-1.5">
                        <ActionButton
                          variant="secondary"
                          size="xs"
                          disabled={isDismissing}
                          onClick={() => setConfirmDismissId(null)}
                        >
                          Cancelar
                        </ActionButton>
                        <ActionButton
                          icon={Trash2}
                          variant="brand"
                          size="xs"
                          loading={isDismissing}
                          onClick={(e) => handleConfirmDismiss(e, alert)}
                        >
                          {isDismissing ? 'Eliminando...' : 'Confirmar'}
                        </ActionButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <IconActionButton
                          icon={isUnread ? MailOpen : Mail}
                          label={isUnread ? 'Marcar como leída' : 'Marcar como no leída'}
                          variant={isUnread ? 'view' : 'neutral'}
                          size="xs"
                          onClick={(e) => handleToggleRead(e, alert)}
                        />

                        {alert.notification && (
                          <IconActionButton
                            icon={Bell}
                            label="Ver notificación"
                            variant="view"
                            size="xs"
                            onClick={(e) => handleOpenNotification(e, alert)}
                          />
                        )}

                        <IconActionButton
                          icon={Trash2}
                          label="Eliminar alerta"
                          variant="delete"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDismissId(alert.id);
                          }}
                        />
                      </div>

                      <ActionButton
                        icon={Eye}
                        variant="delete"
                        size="xs"
                        onClick={() => openTeacherAlert(alert)}
                      >
                        Ver alerta completa
                      </ActionButton>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
