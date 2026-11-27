import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Ban,
  Archive,
  RefreshCw,
  AlertCircle,
  Loader2,
  X,
  CheckCircle2,
  BookOpen,
  FlaskConical,
  Edit3,
  RotateCcw
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { ClassSession, SessionKind, SessionStatus } from '../../types';
import { getTodayLima, formatDisplayDate } from '../../lib/dateUtils';
import { DeleteConfirmModal } from '../DeleteConfirmModal';
import { IconActionButton, ActionButton, SectionIconBadge } from '../ui';

interface CourseSessionsSectionProps {
  sectionId: string;
}

const STATUS_BADGE_STYLES: Record<SessionStatus, string> = {
  programada: 'bg-blue-50 text-[#1F5FA8] border-blue-200',
  abierta: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cerrada: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelada: 'bg-red-50 text-[#C8102E] border-red-200',
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  programada: 'Programada',
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
};

function getDaysDifferenceInclusive(fromDate: string, toDate: string): number {
  const start = new Date(`${fromDate}T00:00:00Z`).getTime();
  const end = new Date(`${toDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return -1;
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

export const CourseSessionsSection: React.FC<CourseSessionsSectionProps> = ({ sectionId }) => {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [generateMode, setGenerateMode] = useState<'single' | 'range'>('single');
  const [genSingleDate, setGenSingleDate] = useState<string>(getTodayLima());
  const [genRangeFrom, setGenRangeFrom] = useState<string>(getTodayLima());
  const [genRangeTo, setGenRangeTo] = useState<string>(getTodayLima());
  const [genTopic, setGenTopic] = useState<string>('');
  const [genLoading, setGenLoading] = useState<boolean>(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null);
  const [manualDate, setManualDate] = useState<string>(getTodayLima());
  const [manualKind, setManualKind] = useState<SessionKind>('teoria');
  const [manualStartsAt, setManualStartsAt] = useState<string>('08:00');
  const [manualEndsAt, setManualEndsAt] = useState<string>('10:00');
  const [manualTopic, setManualTopic] = useState<string>('');
  const [manualStatus, setManualStatus] = useState<SessionStatus>('programada');
  const [manualLoading, setManualLoading] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [cancellingSession, setCancellingSession] = useState<ClassSession | null>(null);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);

  const [archivingSession, setArchivingSession] = useState<ClassSession | null>(null);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!sectionId || !isSupabaseConfigured()) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const baseQuery = supabase
        .from('class_sessions')
        .select('id, section_id, session_date, starts_at, ends_at, topic, status, kind, archived_at')
        .eq('section_id', sectionId);

      const filteredQuery = showArchived
        ? baseQuery.not('archived_at', 'is', null)
        : baseQuery.is('archived_at', null);

      const { data, error: sbErr } = await filteredQuery
        .order('session_date', { ascending: false })
        .order('starts_at', { ascending: true });

      if (sbErr) throw sbErr;
      setSessions(data || []);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'class_sessions'));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [sectionId, showArchived]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleOpenGenerateModal = () => {
    const today = getTodayLima();
    setGenerateMode('single');
    setGenSingleDate(today);
    setGenRangeFrom(today);
    setGenRangeTo(today);
    setGenTopic('');
    setGenError(null);
    setIsGenerateModalOpen(true);
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);
    setSuccess(null);

    const pFrom = generateMode === 'single' ? genSingleDate : genRangeFrom;
    const pTo = generateMode === 'single' ? null : genRangeTo;

    if (!pFrom) {
      setGenError('Debes indicar la fecha.');
      return;
    }

    if (generateMode === 'range') {
      if (!pTo) {
        setGenError('Debes indicar la fecha de fin.');
        return;
      }
      if (pTo < pFrom) {
        setGenError('La fecha final debe ser igual o posterior a la fecha inicial.');
        return;
      }
      const totalDays = getDaysDifferenceInclusive(pFrom, pTo);
      if (totalDays > 200) {
        setGenError('El rango máximo permitido es de 200 días.');
        return;
      }
    }

    setGenLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data: res, error: rpcErr } = await supabase.rpc('admin_create_class_days', {
        p_section: sectionId,
        p_from: pFrom,
        p_to: pTo,
        p_topic: genTopic.trim() || null,
      });

      if (rpcErr) throw rpcErr;

      let parsedRes = res;
      if (typeof parsedRes === 'string') {
        try {
          parsedRes = JSON.parse(parsedRes);
        } catch {

        }
      }

      const code = typeof parsedRes === 'string' ? parsedRes : parsedRes?.code;

      if (code === 'success') {
        const createdCount = Number(parsedRes?.created ?? 0);
        const existingCount = Number(parsedRes?.existing ?? 0);
        setSuccess(`Se crearon ${createdCount} sesiones (${existingCount} ya existían)`);
        setIsGenerateModalOpen(false);
        await fetchSessions();
      } else if (code === 'no_schedule') {
        setGenError('No hay franjas de horario configuradas para las fechas seleccionadas. Configúralas en la pestaña "2. Horario".');
      } else if (code === 'invalid_dates') {
        setGenError('Las fechas ingresadas no son válidas.');
      } else if (code === 'range_too_long') {
        setGenError('El rango de fechas supera el máximo permitido de 200 días.');
      } else if (code === 'invalid_section') {
        setGenError('La sección seleccionada no es válida o no existe.');
      } else if (code === 'outside_period') {
        setGenError('Las fechas seleccionadas se encuentran fuera del periodo académico vigente.');
      } else if (code === 'unauthorized') {
        setGenError('No tienes permisos de administrador para generar sesiones.');
      } else {
        setGenError(typeof parsedRes === 'string' ? parsedRes : parsedRes?.message || 'No se pudieron generar las sesiones.');
      }
    } catch (err: unknown) {
      setGenError(translateSupabaseError(err, 'class_sessions'));
    } finally {
      setGenLoading(false);
    }
  };

  const handleOpenManualCreate = () => {
    setEditingSession(null);
    setManualDate(getTodayLima());
    setManualKind('teoria');
    setManualStartsAt('08:00');
    setManualEndsAt('10:00');
    setManualTopic('');
    setManualStatus('programada');
    setManualError(null);
    setIsManualModalOpen(true);
  };

  const handleOpenEditSession = (sess: ClassSession) => {
    if (sess.status === 'cerrada') return;
    setEditingSession(sess);
    setManualDate(sess.session_date);
    setManualKind(sess.kind === 'practica' ? 'practica' : 'teoria');
    setManualStartsAt((sess.starts_at || '08:00').slice(0, 5));
    setManualEndsAt((sess.ends_at || '10:00').slice(0, 5));
    setManualTopic(sess.topic || '');
    setManualStatus(sess.status);
    setManualError(null);
    setIsManualModalOpen(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setSuccess(null);

    if (editingSession && editingSession.status === 'cerrada') {
      setManualError('No se puede editar una sesión con estado cerrada.');
      return;
    }

    const startTrim = manualStartsAt.slice(0, 5);
    const endTrim = manualEndsAt.slice(0, 5);

    if (!manualDate || !startTrim || !endTrim) {
      setManualError('Debes completar la fecha, hora de inicio y hora de fin.');
      return;
    }

    if (endTrim <= startTrim) {
      setManualError('La hora de fin debe ser estrictamente mayor que la hora de inicio.');
      return;
    }

    setManualLoading(true);

    try {
      const supabase = getSupabaseClient();

      const { data: existingRows, error: checkErr } = await supabase
        .from('class_sessions')
        .select('id, starts_at, ends_at')
        .eq('section_id', sectionId)
        .eq('session_date', manualDate)
        .is('archived_at', null);

      if (checkErr) throw checkErr;

      const hasDuplicate = (existingRows || []).some(
        (row) =>
          row.id !== editingSession?.id &&
          (row.starts_at || '').slice(0, 5) === startTrim &&
          (row.ends_at || '').slice(0, 5) === endTrim
      );

      if (hasDuplicate) {
        setManualError('Ya existe una sesión activa en esa fecha con el mismo horario de inicio y fin.');
        setManualLoading(false);
        return;
      }

      const payload = {
        section_id: sectionId,
        session_date: manualDate,
        starts_at: startTrim,
        ends_at: endTrim,
        kind: manualKind,
        topic: manualTopic.trim() || 'Sesión de clase',
        status: manualStatus,
      };

      if (editingSession) {
        const { error: updErr } = await supabase
          .from('class_sessions')
          .update(payload)
          .eq('id', editingSession.id)
          .neq('status', 'cerrada');

        if (updErr) throw updErr;
        setSuccess('Sesión actualizada correctamente.');
      } else {
        const { error: insErr } = await supabase
          .from('class_sessions')
          .insert(payload);

        if (insErr) throw insErr;
        setSuccess('Sesión manual creada correctamente.');
      }

      setIsManualModalOpen(false);
      await fetchSessions();
    } catch (err: unknown) {
      setManualError(translateSupabaseError(err, 'class_sessions'));
    } finally {
      setManualLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancellingSession || cancellingSession.status === 'cerrada') return;
    setCancelLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updErr } = await supabase
        .from('class_sessions')
        .update({ status: 'cancelada' })
        .eq('id', cancellingSession.id)
        .neq('status', 'cerrada');

      if (updErr) {
        setError(translateSupabaseError(updErr, 'class_sessions'));
      } else {
        setSuccess('Sesión marcada como cancelada.');
        await fetchSessions();
      }
      setCancellingSession(null);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'class_sessions'));
    } finally {
      setCancelLoading(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archivingSession || archivingSession.status === 'abierta') return;
    setArchiveLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();
      const { error: arcErr } = await supabase
        .from('class_sessions')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', archivingSession.id);

      if (arcErr) throw arcErr;

      setArchivingSession(null);
      setSuccess('Sesión archivada correctamente.');
      await fetchSessions();
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'class_sessions'));
      setArchivingSession(null);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestoreSession = async (sess: ClassSession) => {
    setRestoringId(sess.id);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();
      const { error: restErr } = await supabase
        .from('class_sessions')
        .update({ archived_at: null })
        .eq('id', sess.id);

      if (restErr) throw restErr;

      setSuccess('Sesión restaurada correctamente.');
      await fetchSessions();
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'class_sessions'));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-5 ucv-animate-in">

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ucv-slide-down">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.9} />
            <span>{success}</span>
          </div>
          <IconActionButton
            icon={X}
            label="Cerrar aviso"
            variant="confirm"
            size="xs"
            onClick={() => setSuccess(null)}
          />
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ucv-slide-down">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C8102E] shrink-0" strokeWidth={1.9} />
            <span>{error}</span>
          </div>
          <IconActionButton
            icon={X}
            label="Cerrar error"
            variant="delete"
            size="xs"
            onClick={() => setError(null)}
          />
        </div>
      )}

      <div className="ucv-card rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <SectionIconBadge icon={Calendar} variant="red" size="sm" />
            <div>
              <h2 className="text-[11px] font-bold text-[#0B2A5B] uppercase tracking-[0.06em]">
                {showArchived
                  ? `Sesiones Archivadas (${sessions.length})`
                  : `Sesiones de Clase (${sessions.length})`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Genera sesiones desde el horario semanal o registra sesiones individuales. Las sesiones cerradas no se pueden modificar, pero sí archivar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <ActionButton
              icon={RefreshCw}
              variant="secondary"
              size="sm"
              spinningIcon={loading}
              disabled={loading}
              onClick={fetchSessions}
            >
              Actualizar
            </ActionButton>

            <ActionButton
              icon={Archive}
              variant={showArchived ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setShowArchived((prev) => !prev);
                setError(null);
                setSuccess(null);
              }}
            >
              {showArchived ? 'Ver activas' : 'Ver archivadas'}
            </ActionButton>

            <ActionButton
              icon={Plus}
              variant="primary"
              size="sm"
              onClick={handleOpenGenerateModal}
            >
              Crear día de clase
            </ActionButton>

            <ActionButton
              icon={Edit3}
              variant="view"
              size="sm"
              onClick={handleOpenManualCreate}
            >
              Sesión manual
            </ActionButton>
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#1F5FA8] mb-2" strokeWidth={1.9} />
            <span className="text-xs font-medium">Cargando sesiones de clase...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <SectionIconBadge icon={Calendar} variant="neutral" size="lg" className="mx-auto mb-2.5" />
            <p className="text-xs font-bold text-slate-700">
              {showArchived ? 'Sin sesiones archivadas' : 'Sin sesiones registradas'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
              {showArchived
                ? 'No hay sesiones archivadas para esta sección.'
                : 'Usa "Crear día de clase" para generar automáticamente a partir del horario o añade una "Sesión manual".'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/90 text-slate-500 font-semibold uppercase tracking-[0.06em] text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4">Horario</th>
                  <th className="py-3.5 px-4">Tema</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((sess) => {
                  const isPractica = sess.kind === 'practica';
                  const isClosed = sess.status === 'cerrada';
                  const isOpen = sess.status === 'abierta';
                  const isCancelled = sess.status === 'cancelada';

                  return (
                    <tr key={sess.id} className="hover:bg-slate-50/85 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border uppercase ${
                            isPractica
                              ? 'bg-red-50/90 text-[#B80E29] border-red-200/85'
                              : 'bg-blue-50/90 text-[#154A8A] border-blue-200/85'
                          }`}
                        >
                          {isPractica ? (
                            <FlaskConical className="w-2.5 h-2.5" strokeWidth={1.85} />
                          ) : (
                            <BookOpen className="w-2.5 h-2.5" strokeWidth={1.85} />
                          )}
                          <span>{isPractica ? 'Práctica' : 'Teoría'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#0B2A5B] font-mono whitespace-nowrap">
                        {formatDisplayDate(sess.session_date)}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#154A8A] whitespace-nowrap">
                        {sess.starts_at?.slice(0, 5)} - {sess.ends_at?.slice(0, 5)}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium max-w-xs truncate" title={sess.topic}>
                        {sess.topic || 'Sesión de clase'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase border ${
                            STATUS_BADGE_STYLES[sess.status] || STATUS_BADGE_STYLES.programada
                          }`}
                        >
                          {STATUS_LABELS[sess.status] || sess.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {showArchived ? (
                          <div className="inline-flex items-center justify-end">
                            <IconActionButton
                              icon={RotateCcw}
                              label="Restaurar sesión"
                              variant="confirm"
                              size="sm"
                              spinning={restoringId === sess.id}
                              disabled={restoringId === sess.id}
                              onClick={() => handleRestoreSession(sess)}
                            />
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {!isClosed && (
                              <IconActionButton
                                icon={Edit2}
                                label="Editar sesión"
                                variant="edit"
                                size="sm"
                                onClick={() => handleOpenEditSession(sess)}
                              />
                            )}
                            {!isClosed && !isCancelled && (
                              <IconActionButton
                                icon={Ban}
                                label="Cancelar sesión"
                                variant="delete"
                                size="sm"
                                onClick={() => setCancellingSession(sess)}
                              />
                            )}
                            {isOpen ? (
                              <span className="text-slate-400 text-[11px] italic px-1">
                                Cierra la asistencia para archivar
                              </span>
                            ) : (
                              <IconActionButton
                                icon={Archive}
                                label="Archivar sesión"
                                variant="warning"
                                size="sm"
                                onClick={() => setArchivingSession(sess)}
                              />
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="ucv-card ucv-scale-in rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="ucv-header-split text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" strokeWidth={1.9} />
                </div>
                <h3 className="text-sm font-extrabold">Crear Día de Clase</h3>
              </div>
              <IconActionButton
                icon={X}
                label="Cerrar modal"
                variant="ghost-light"
                size="sm"
                disabled={genLoading}
                onClick={() => setIsGenerateModalOpen(false)}
              />
            </div>

            <form onSubmit={handleGenerateSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setGenerateMode('single');
                    setGenError(null);
                  }}
                  className={`py-2 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                    generateMode === 'single'
                      ? 'bg-white text-[#0B2A5B] shadow-xs'
                      : 'text-slate-600 hover:text-[#0B2A5B]'
                  }`}
                >
                  Un solo día
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenerateMode('range');
                    setGenError(null);
                  }}
                  className={`py-2 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                    generateMode === 'range'
                      ? 'bg-white text-[#C8102E] shadow-xs'
                      : 'text-slate-600 hover:text-[#0B2A5B]'
                  }`}
                >
                  Varios días
                </button>
              </div>

              {genError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                  <span>{genError}</span>
                </div>
              )}

              {generateMode === 'single' ? (
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fecha del día *
                  </label>
                  <input
                    type="date"
                    required
                    value={genSingleDate}
                    onChange={(e) => setGenSingleDate(e.target.value)}
                    disabled={genLoading}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Generará las sesiones correspondientes según el horario configurado para ese día.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Desde *
                      </label>
                      <input
                        type="date"
                        required
                        value={genRangeFrom}
                        onChange={(e) => setGenRangeFrom(e.target.value)}
                        disabled={genLoading}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Hasta *
                      </label>
                      <input
                        type="date"
                        required
                        value={genRangeTo}
                        onChange={(e) => setGenRangeTo(e.target.value)}
                        disabled={genLoading}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Rango máximo permitido: 200 días calendario.
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider">
                    Tema general
                  </label>
                  <span className="text-[11px] text-slate-400">Opcional</span>
                </div>
                <input
                  type="text"
                  placeholder="Ej. Sesión regular de clases"
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  disabled={genLoading}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsGenerateModalOpen(false)}
                  disabled={genLoading}
                  className="flex-1"
                >
                  Cancelar
                </ActionButton>
                <ActionButton
                  type="submit"
                  icon={Plus}
                  variant="primary"
                  size="sm"
                  loading={genLoading}
                  className="flex-1"
                >
                  {generateMode === 'single' ? 'Crear día' : 'Generar rango'}
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="ucv-card ucv-scale-in rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="ucv-header-split text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <Edit3 className="w-4 h-4 text-white" strokeWidth={1.9} />
                </div>
                <h3 className="text-sm font-extrabold">
                  {editingSession ? 'Editar Sesión de Clase' : 'Nueva Sesión Manual'}
                </h3>
              </div>
              <IconActionButton
                icon={X}
                label="Cerrar modal"
                variant="ghost-light"
                size="sm"
                disabled={manualLoading}
                onClick={() => setIsManualModalOpen(false)}
              />
            </div>

            <form onSubmit={handleManualSubmit} className="p-5 space-y-4 text-xs">
              {manualError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                  <span>{manualError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    disabled={manualLoading}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tipo *
                  </label>
                  <select
                    value={manualKind}
                    onChange={(e) => setManualKind(e.target.value as SessionKind)}
                    disabled={manualLoading}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                  >
                    <option value="teoria">Teoría</option>
                    <option value="practica">Práctica</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Hora de inicio *
                  </label>
                  <input
                    type="time"
                    required
                    value={manualStartsAt}
                    onChange={(e) => setManualStartsAt(e.target.value)}
                    disabled={manualLoading}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Hora de fin *
                  </label>
                  <input
                    type="time"
                    required
                    value={manualEndsAt}
                    onChange={(e) => setManualEndsAt(e.target.value)}
                    disabled={manualLoading}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tema *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Recuperación de clase"
                  value={manualTopic}
                  onChange={(e) => setManualTopic(e.target.value)}
                  disabled={manualLoading}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Estado *
                </label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value as SessionStatus)}
                  disabled={manualLoading}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                >
                  <option value="programada">Programada</option>
                  <option value="abierta">Abierta</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="cerrada">Cerrada</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsManualModalOpen(false)}
                  disabled={manualLoading}
                  className="flex-1"
                >
                  Cancelar
                </ActionButton>
                <ActionButton
                  type="submit"
                  icon={CheckCircle2}
                  variant="primary"
                  size="sm"
                  loading={manualLoading}
                  className="flex-1"
                >
                  {editingSession ? 'Guardar cambios' : 'Crear sesión'}
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={Boolean(cancellingSession)}
        title="Cancelar Sesión de Clase"
        message={
          cancellingSession
            ? `La sesión del ${formatDisplayDate(cancellingSession.session_date)} (${cancellingSession.starts_at?.slice(0, 5)} - ${cancellingSession.ends_at?.slice(0, 5)}) pasará a estado "Cancelada".`
            : undefined
        }
        loading={cancelLoading}
        confirmLabel="Sí, cancelar sesión"
        onConfirm={handleCancelConfirm}
        onCancel={() => setCancellingSession(null)}
      />

      <DeleteConfirmModal
        isOpen={!!archivingSession}
        title="¿Archivar esta sesión?"
        message="La sesión y sus asistencias se conservan en la base de datos, pero dejará de aparecer en el listado, en el historial del alumno y en el cálculo del porcentaje de asistencia."
        loading={archiveLoading}
        confirmLabel="Archivar"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchivingSession(null)}
      />
    </div>
  );
};
