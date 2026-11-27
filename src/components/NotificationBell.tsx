import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  AlertTriangle,
  Info,
  Loader2,
  BookOpen,
  ArrowRight,
  RefreshCw,
  MailOpen,
  Mail,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { formatLimaDateTime } from '../lib/dateUtils';
import { AppNotification } from '../types';
import { IconActionButton, ActionButton } from './ui';

interface NotificationBellProps {
  onNavigate?: (tab: string, targetRefId?: string) => void;
  surface?: 'light' | 'dark';
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onNavigate,
  surface = 'light',
}) => {
  const { profile } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    hasError,
    refreshNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    dismissNotification,
    openTeacherAlertFromNotification,
    openNotificationDetail,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [bellFilter, setBellFilter] = useState<'all' | 'unread'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setConfirmDeleteId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setConfirmDeleteId(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!profile) {
    return null;
  }

  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);
  const visibleNotifications =
    bellFilter === 'unread' ? notifications.filter((n) => !n.read_at) : notifications;

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    setConfirmDeleteId(null);
    if (nextOpen) {
      refreshNotifications(true);
    }
  };

  const handleItemClick = (notification: AppNotification) => {
    if (notification.kind === 'riesgo_asistencia_profesor' && profile.role === 'profesor') {
      openTeacherAlertFromNotification(notification);
      setIsOpen(false);
      return;
    }

    openNotificationDetail(notification);
    setIsOpen(false);
  };

  const handleViewMyAttendance = (event: React.MouseEvent, notification: AppNotification) => {
    event.stopPropagation();
    markAsRead(notification);
    const targetRef = notification.courseRef?.sectionId || notification.ref_id || undefined;
    onNavigate?.('mi_asistencia', targetRef);
    setIsOpen(false);
  };

  const handleToggleReadItem = (event: React.MouseEvent, notification: AppNotification) => {
    event.stopPropagation();
    if (notification.read_at) {
      markAsUnread(notification);
    } else {
      markAsRead(notification);
    }
  };

  const handleConfirmDeleteItem = async (
    event: React.MouseEvent,
    notification: AppNotification
  ) => {
    event.stopPropagation();
    setDeletingId(notification.id);
    try {
      await dismissNotification(notification);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {surface === 'dark' ? (
        <button
          type="button"
          onClick={handleToggle}
          aria-label={`Notificaciones (${unreadCount} sin leer)`}
          aria-expanded={isOpen}
          aria-haspopup={true}
          title={unreadCount > 0 ? `${unreadCount} sin leer` : 'Notificaciones'}
          className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            isOpen
              ? 'bg-white text-[#0B2A5B] border-white shadow-sm'
              : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
          }`}
        >
          <Bell className="w-[17px] h-[17px]" strokeWidth={1.85} aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#C8102E] text-white text-[9px] font-bold leading-none flex items-center justify-center shadow-xs border-2 border-[#0B2A5B]">
              {badgeText}
            </span>
          )}
        </button>
      ) : (
        <IconActionButton
          icon={Bell}
          label={`Notificaciones (${unreadCount} sin leer)`}
          tooltip={unreadCount > 0 ? `${unreadCount} sin leer` : 'Notificaciones'}
          variant={unreadCount > 0 ? 'alert' : 'neutral'}
          size="sm"
          tooltipSide="bottom"
          active={isOpen}
          ariaExpanded={isOpen}
          ariaHaspopup={true}
          onClick={handleToggle}
          badge={
            unreadCount > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C8102E] text-white text-[10px] font-bold leading-none flex items-center justify-center shadow-xs border-2 border-white">
                {badgeText}
              </span>
            ) : undefined
          }
        />
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="Panel de notificaciones"
          className="absolute right-0 mt-2.5 w-80 sm:w-96 z-50 ucv-card rounded-2xl overflow-hidden shadow-[0_16px_40px_-12px_rgba(11,42,91,0.2)] border border-slate-200 bg-white ucv-scale-in"
        >
          <div className="h-1 ucv-topbar-split w-full" />

          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#0B2A5B]/[0.07] border border-[#0B2A5B]/15 text-[#0B2A5B] flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5" strokeWidth={1.9} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#0B2A5B]">
                  Notificaciones
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <ActionButton
                    icon={CheckCheck}
                    variant="view"
                    size="xs"
                    onClick={markAllAsRead}
                  >
                    Marcar leídas
                  </ActionButton>
                )}
                <IconActionButton
                  icon={RefreshCw}
                  label="Actualizar notificaciones"
                  variant="refresh"
                  size="xs"
                  tooltipSide="bottom"
                  spinning={loading || refreshing}
                  disabled={loading || refreshing}
                  onClick={() => refreshNotifications(false)}
                />
              </div>
            </div>

            {notifications.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBellFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                    bellFilter === 'all'
                      ? 'bg-[#0B2A5B] text-white border-[#0B2A5B]'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-[#0B2A5B]'
                  }`}
                >
                  Todas ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBellFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                    bellFilter === 'unread'
                      ? 'bg-[#C8102E] text-white border-[#C8102E]'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-[#0B2A5B]'
                  }`}
                >
                  Sin leer ({unreadCount})
                </button>
              </div>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-5 h-5 text-[#1F5FA8] animate-spin" strokeWidth={1.9} />
                <span className="text-xs font-medium">Cargando notificaciones...</span>
              </div>
            ) : hasError ? (
              <div className="py-8 px-4 text-center space-y-2.5">
                <p className="text-xs font-medium text-[#C8102E]">
                  No se pudieron cargar las notificaciones.
                </p>
                <ActionButton
                  icon={RefreshCw}
                  variant="view"
                  size="xs"
                  onClick={() => refreshNotifications(false)}
                >
                  Reintentar
                </ActionButton>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs font-medium text-slate-500">
                {bellFilter === 'unread' && notifications.length > 0
                  ? 'No tienes notificaciones sin leer.'
                  : 'Sin notificaciones por ahora.'}
              </div>
            ) : (
              visibleNotifications.map((item) => {
                const isUnread = !item.read_at;
                const isStudentRisk = item.kind === 'riesgo_asistencia';
                const isTeacherRisk = item.kind === 'riesgo_asistencia_profesor';
                const isRisk = isStudentRisk || isTeacherRisk;
                const showAttendanceLink = isStudentRisk && profile.role === 'alumno';
                const teacherRisk = item.teacherRisk;
                const isConfirmingDelete = confirmDeleteId === item.id;
                const isDeletingThis = deletingId === item.id;

                const courseLabel = item.courseRef?.courseName
                  ? `${item.courseRef.courseCode ? `${item.courseRef.courseCode} • ` : ''}${item.courseRef.courseName}${
                      item.courseRef.sectionName ? ` (Sec. ${item.courseRef.sectionName})` : ''
                    }`
                  : item.courseRef?.sectionName
                  ? `Sección ${item.courseRef.sectionName}`
                  : null;

                const teacherMetricsSummary = isTeacherRisk
                  ? teacherRisk?.isResolved
                    ? 'Regularizada · 0 faltas actuales'
                    : [
                        teacherRisk?.riskLevel ? `Riesgo ${teacherRisk.riskLevel}` : null,
                        teacherRisk?.absencesCount ? `${teacherRisk.absencesCount} faltas` : null,
                        teacherRisk?.absencePercentage || null,
                        teacherRisk?.consecutiveAbsences
                          ? `${teacherRisk.consecutiveAbsences} consec.`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                  : '';

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleItemClick(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleItemClick(item);
                      }
                    }}
                    className={`w-full text-left px-4 py-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                      isRisk
                        ? isUnread
                          ? 'bg-red-50/55 hover:bg-red-50/85'
                          : 'bg-white hover:bg-red-50/30'
                        : isUnread
                        ? 'bg-[#1F5FA8]/[0.06] hover:bg-[#1F5FA8]/[0.1]'
                        : 'bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                        isRisk
                          ? 'bg-red-50 border-red-200/85 text-[#C8102E]'
                          : 'bg-blue-50 border-blue-200/85 text-[#1F5FA8]'
                      }`}
                    >
                      {isRisk ? (
                        <AlertTriangle className="w-4 h-4" strokeWidth={1.85} />
                      ) : (
                        <Info className="w-4 h-4" strokeWidth={1.85} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          {isRisk && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-50 text-[#B80E29] border border-red-200/85">
                              {isTeacherRisk ? 'Alerta docente' : 'Riesgo de asistencia'}
                            </span>
                          )}
                          <p className="text-xs font-semibold leading-snug text-[#0B2A5B]">
                            {item.title}
                          </p>
                        </div>
                        {isUnread && (
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                              isRisk ? 'bg-[#C8102E]' : 'bg-[#1F5FA8]'
                            }`}
                          />
                        )}
                      </div>

                      {courseLabel && (
                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/90 border border-slate-200 text-[10px] font-bold text-[#0B2A5B] max-w-full">
                          <BookOpen className="w-3 h-3 text-[#1F5FA8] shrink-0" strokeWidth={2} />
                          <span className="truncate">{courseLabel}</span>
                        </div>
                      )}

                      {teacherMetricsSummary && (
                        <p className="text-[11px] font-bold text-[#C8102E] mt-1">
                          {teacherMetricsSummary}
                        </p>
                      )}

                      <p className="text-xs text-slate-600 mt-1 leading-snug break-words line-clamp-3">
                        {teacherRisk?.formattedBody || item.body}
                      </p>

                      {isConfirmingDelete ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2.5 p-2 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2"
                        >
                          <span className="text-[10px] font-bold text-red-900">
                            ¿Descartar aviso?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={isDeletingThis}
                              className="px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200 text-[10px] font-bold cursor-pointer hover:bg-slate-50"
                            >
                              No
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleConfirmDeleteItem(e, item)}
                              disabled={isDeletingThis}
                              className="px-2.5 py-1 rounded-lg bg-[#C8102E] hover:bg-[#A50D25] text-white text-[10px] font-bold cursor-pointer disabled:opacity-60"
                            >
                              {isDeletingThis ? '...' : 'Sí'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-[10px] font-medium text-slate-400">
                            {formatLimaDateTime(item.created_at)}
                          </p>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5"
                          >
                            <IconActionButton
                              icon={isUnread ? MailOpen : Mail}
                              label={isUnread ? 'Marcar como leída' : 'Marcar como no leída'}
                              variant={isUnread ? 'view' : 'neutral'}
                              size="xs"
                              onClick={(e) => handleToggleReadItem(e, item)}
                            />
                            <IconActionButton
                              icon={Trash2}
                              label="Descartar notificación"
                              variant="delete"
                              size="xs"
                              onClick={() => setConfirmDeleteId(item.id)}
                            />
                            {showAttendanceLink ? (
                              <ActionButton
                                iconRight={ArrowRight}
                                variant="delete"
                                size="xs"
                                onClick={(event) => handleViewMyAttendance(event, item)}
                              >
                                Ver asistencia
                              </ActionButton>
                            ) : (
                              <ActionButton
                                iconRight={ArrowRight}
                                variant="view"
                                size="xs"
                                onClick={() => handleItemClick(item)}
                              >
                                Ver completa
                              </ActionButton>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
