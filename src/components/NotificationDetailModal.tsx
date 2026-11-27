import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Info,
  X,
  BookOpen,
  Calendar,
  ArrowRight,
  MailOpen,
  Mail,
  Trash2,
  Users,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { formatLimaDateTime } from '../lib/dateUtils';
import { IconActionButton, ActionButton, SectionIconBadge } from './ui';

interface NotificationDetailModalProps {
  onNavigate?: (tab: string, targetRefId?: string) => void;
}

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  onNavigate,
}) => {
  const { profile } = useAuth();
  const {
    selectedNotification,
    closeNotificationDetail,
    markAsRead,
    markAsUnread,
    dismissNotification,
    openTeacherAlertFromNotification,
  } = useNotifications();

  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    setConfirmDelete(false);
    setDeleting(false);
  }, [selectedNotification?.id]);

  useEffect(() => {
    if (!selectedNotification) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNotificationDetail();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNotification, closeNotificationDetail]);

  if (!selectedNotification) return null;

  const isUnread = !selectedNotification.read_at;
  const isStudentRisk = selectedNotification.kind === 'riesgo_asistencia';
  const isTeacherRisk = selectedNotification.kind === 'riesgo_asistencia_profesor';
  const isRisk = isStudentRisk || isTeacherRisk;
  const teacherRisk = selectedNotification.teacherRisk;

  const courseLabel = selectedNotification.courseRef?.courseName
    ? `${selectedNotification.courseRef.courseCode ? `${selectedNotification.courseRef.courseCode} • ` : ''}${selectedNotification.courseRef.courseName}${
        selectedNotification.courseRef.sectionName
          ? ` (Sec. ${selectedNotification.courseRef.sectionName})`
          : ''
      }`
    : selectedNotification.courseRef?.sectionName
    ? `Sección ${selectedNotification.courseRef.sectionName}`
    : null;

  const handleToggleRead = () => {
    if (isUnread) {
      markAsRead(selectedNotification);
    } else {
      markAsUnread(selectedNotification);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await dismissNotification(selectedNotification);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleGoToAttendance = () => {
    const targetRef =
      selectedNotification.courseRef?.sectionId || selectedNotification.ref_id || undefined;
    closeNotificationDetail();
    onNavigate?.('mi_asistencia', targetRef);
  };

  const handleOpenFullTeacherAlert = () => {
    const target = selectedNotification;
    closeNotificationDetail();
    openTeacherAlertFromNotification(target);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detalle completo de notificación"
      onClick={closeNotificationDetail}
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl ucv-card ucv-scale-in rounded-2xl overflow-hidden bg-white shadow-2xl border border-slate-200 my-auto"
      >
        <div className="h-1.5 w-full ucv-topbar-split" />

        <div
          className={`px-5 py-4 sm:px-6 border-b border-slate-100 flex items-start justify-between gap-3 ${
            isRisk ? 'bg-red-50/40' : 'bg-slate-50/75'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <SectionIconBadge
              icon={isRisk ? AlertTriangle : Info}
              variant={isRisk ? 'red' : 'blue'}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-md border ${
                    isRisk
                      ? 'bg-red-50 text-[#B80E29] border-red-200/85'
                      : 'bg-blue-50 text-[#154A8A] border-blue-200/85'
                  }`}
                >
                  {isTeacherRisk
                    ? 'Alerta docente'
                    : isStudentRisk
                    ? 'Riesgo de asistencia'
                    : 'Notificación'}
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
              <h2 className="text-base font-bold text-[#0B2A5B] mt-1.5 leading-snug break-words tracking-[-0.015em]">
                {selectedNotification.title}
              </h2>
            </div>
          </div>

          <IconActionButton
            icon={X}
            label="Cerrar notificación"
            variant="neutral"
            size="sm"
            onClick={closeNotificationDetail}
          />
        </div>

        <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {courseLabel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 font-bold text-[#0B2A5B]">
                <BookOpen className="w-3.5 h-3.5 text-[#1F5FA8]" strokeWidth={1.9} />
                {courseLabel}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.9} />
              {formatLimaDateTime(selectedNotification.created_at)}
            </span>
          </div>

          {isTeacherRisk && teacherRisk?.isLiveCalculated && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                teacherRisk.isResolved
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-red-50/60 border-red-200 text-slate-800'
              }`}
            >
              {teacherRisk.isResolved ? (
                <p className="font-semibold">
                  Estado actual en vivo: Las asistencias de esta sección han sido regularizadas y actualmente no hay alumnos en riesgo (0 faltas activas).
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 font-extrabold text-[#0B2A5B]">
                    <Users className="w-4 h-4 text-[#C8102E]" strokeWidth={1.9} />
                    <span>Alumnos afectados actualmente ({teacherRisk.students.length}):</span>
                  </div>
                  <div className="space-y-1">
                    {teacherRisk.students.map((st, idx) => (
                      <div
                        key={`${st.studentId || st.code || st.name}-${idx}`}
                        className="flex items-center justify-between gap-2 bg-white/90 px-2.5 py-1.5 rounded-lg border border-red-200/70 text-[11px]"
                      >
                        <span className="font-bold text-slate-900">
                          {st.code ? `${st.code} · ` : ''}
                          {st.name}
                        </span>
                        <span className="font-mono font-bold text-[#C8102E]">
                          {st.absencesNum ?? 0} falta(s) · {st.absencePercentage || '0%'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed break-words">
            {teacherRisk?.formattedBody || selectedNotification.body}
          </div>
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

            {confirmDelete ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-50 border border-red-200">
                <span className="text-[11px] font-semibold text-red-900">¿Eliminar?</span>
                <ActionButton
                  variant="secondary"
                  size="xs"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancelar
                </ActionButton>
                <ActionButton
                  variant="brand"
                  size="xs"
                  loading={deleting}
                  onClick={handleConfirmDelete}
                >
                  {deleting ? 'Eliminando...' : 'Confirmar'}
                </ActionButton>
              </div>
            ) : (
              <ActionButton
                icon={Trash2}
                variant="delete"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                Eliminar alerta
              </ActionButton>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isTeacherRisk && profile?.role === 'profesor' && !teacherRisk?.isResolved && (
              <ActionButton
                icon={Eye}
                variant="view"
                size="sm"
                onClick={handleOpenFullTeacherAlert}
              >
                Ver alerta completa
              </ActionButton>
            )}
            {isStudentRisk && profile?.role === 'alumno' && onNavigate && (
              <ActionButton
                iconRight={ArrowRight}
                variant="delete"
                size="sm"
                onClick={handleGoToAttendance}
              >
                Ver mi asistencia
              </ActionButton>
            )}
            <ActionButton
              variant="primary"
              size="sm"
              onClick={closeNotificationDetail}
            >
              Cerrar
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
};
