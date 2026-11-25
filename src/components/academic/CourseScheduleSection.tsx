import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Plus,
  Edit2,
  Archive,
  RefreshCw,
  AlertCircle,
  Loader2,
  X,
  Calendar,
  MapPin,
  CheckCircle2,
  Info,
  BookOpen,
  FlaskConical
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { Schedule, SessionKind } from '../../types';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

interface CourseScheduleSectionProps {
  sectionId: string;
}

const WEEKDAYS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export const CourseScheduleSection: React.FC<CourseScheduleSectionProps> = ({ sectionId }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState<{
    weekday: number;
    kind: SessionKind;
    starts_at: string;
    ends_at: string;
    room: string;
  }>({
    weekday: 1,
    kind: 'teoria',
    starts_at: '08:00',
    ends_at: '10:00',
    room: '',
  });
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [archivingSchedule, setArchivingSchedule] = useState<Schedule | null>(null);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);

  const fetchSchedules = useCallback(async () => {
    if (!sectionId || !isSupabaseConfigured()) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: scErr } = await supabase
        .from('schedules')
        .select('id, section_id, weekday, starts_at, ends_at, room, kind, archived_at')
        .eq('section_id', sectionId)
        .is('archived_at', null)
        .order('weekday', { ascending: true })
        .order('starts_at', { ascending: true });

      if (scErr) throw scErr;
      setSchedules(data || []);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'schedules'));
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setFormData({
      weekday: 1,
      kind: 'teoria',
      starts_at: '08:00',
      ends_at: '10:00',
      room: '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (sc: Schedule) => {
    setEditingSchedule(sc);
    setFormData({
      weekday: sc.weekday,
      kind: sc.kind === 'practica' ? 'practica' : 'teoria',
      starts_at: sc.starts_at ? sc.starts_at.slice(0, 5) : '08:00',
      ends_at: sc.ends_at ? sc.ends_at.slice(0, 5) : '10:00',
      room: sc.room || '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);

    if (!sectionId) {
      setFormError('No se encontró la sección seleccionada.');
      return;
    }

    const weekdayNum = Number(formData.weekday);
    const startTrim = formData.starts_at.slice(0, 5);
    const endTrim = formData.ends_at.slice(0, 5);
    const roomTrim = formData.room.trim();

    if (!startTrim || !endTrim) {
      setFormError('Debes ingresar la hora de inicio y la hora de fin.');
      return;
    }

    if (formData.kind !== 'teoria' && formData.kind !== 'practica') {
      setFormError('El tipo de horario (Teoría o Práctica) es obligatorio.');
      return;
    }

    if (endTrim <= startTrim) {
      setFormError('La hora de fin debe ser estrictamente mayor que la hora de inicio.');
      return;
    }

    const hasDuplicate = schedules.some(
      (s) =>
        s.id !== editingSchedule?.id &&
        Number(s.weekday) === weekdayNum &&
        (s.starts_at || '').slice(0, 5) === startTrim &&
        (s.ends_at || '').slice(0, 5) === endTrim
    );

    if (hasDuplicate) {
      setFormError('Ya existe una franja horaria activa para ese día y horario en esta sección.');
      return;
    }

    setFormLoading(true);

    try {
      const supabase = getSupabaseClient();
      const payload = {
        section_id: sectionId,
        weekday: weekdayNum,
        kind: formData.kind,
        starts_at: startTrim,
        ends_at: endTrim,
        room: roomTrim ? roomTrim : null,
      };

      if (editingSchedule) {
        const { error: updErr } = await supabase
          .from('schedules')
          .update(payload)
          .eq('id', editingSchedule.id);

        if (updErr) {
          setFormError(translateSupabaseError(updErr, 'schedules'));
          return;
        }
        setSuccess('Franja horaria actualizada correctamente.');
      } else {
        const { error: insErr } = await supabase
          .from('schedules')
          .insert(payload);

        if (insErr) {
          setFormError(translateSupabaseError(insErr, 'schedules'));
          return;
        }
        setSuccess('Franja horaria creada correctamente.');
      }

      setIsFormOpen(false);
      await fetchSchedules();
    } catch (err: unknown) {
      setFormError(translateSupabaseError(err, 'schedules'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archivingSchedule) return;
    setArchiveLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();
      const { error: arcErr } = await supabase
        .from('schedules')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', archivingSchedule.id);

      if (arcErr) {
        setError(translateSupabaseError(arcErr, 'schedules'));
      } else {
        setSuccess('Franja horaria archivada. Las sesiones ya generadas se conservan.');
        await fetchSchedules();
      }
      setArchivingSchedule(null);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'schedules'));
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="space-y-5 ucv-animate-in">

      <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-[#1F5FA8] shrink-0 mt-0.5" />
        <div className="text-xs text-blue-950">
          <p className="font-bold">Horario Semanal de la Sección</p>
          <p className="mt-0.5 text-blue-900/90">
            Define las franjas semanales (Teoría / Práctica) que se usarán al generar los días de clase. Al archivar una franja, las sesiones previamente generadas se conservan.
          </p>
        </div>
      </div>

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ucv-slide-down">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-700 hover:text-emerald-950 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ucv-slide-down">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C8102E] shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-950 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="ucv-card rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#1F5FA8]" />
            <h2 className="text-sm font-bold text-[#0B2A5B] uppercase tracking-wider">
              Franjas Horarias ({schedules.length})
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={fetchSchedules}
              disabled={loading}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:text-[#0B2A5B] hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C8102E]' : 'text-[#1F5FA8]'}`} />
              <span>Actualizar</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-2 bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva franja horaria</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#1F5FA8] mb-2" />
            <span className="text-xs font-medium">Cargando horario semanal...</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Calendar className="w-9 h-9 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Sin franjas horarias configuradas</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
              Registra los días y horarios de clase de esta sección para poder generar sesiones automáticamente.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar primera franja</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Día</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Horario</th>
                  <th className="py-3 px-4">Aula</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((sc) => {
                  const isPractica = sc.kind === 'practica';
                  const startClean = sc.starts_at ? sc.starts_at.slice(0, 5) : '-';
                  const endClean = sc.ends_at ? sc.ends_at.slice(0, 5) : '-';

                  return (
                    <tr key={sc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#0B2A5B]">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#1F5FA8]" />
                          <span>{WEEKDAYS[sc.weekday] || `Día ${sc.weekday}`}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                            isPractica
                              ? 'bg-red-50 text-[#C8102E] border-red-200'
                              : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                          }`}
                        >
                          {isPractica ? (
                            <FlaskConical className="w-2.5 h-2.5" />
                          ) : (
                            <BookOpen className="w-2.5 h-2.5" />
                          )}
                          <span>{isPractica ? 'Práctica' : 'Teoría'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#1F5FA8]">
                        {startClean} - {endClean}
                      </td>
                      <td className="py-3 px-4">
                        {sc.room ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                            <MapPin className="w-3 h-3 text-[#C8102E]" />
                            <span>{sc.room}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sin asignar</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => handleOpenEdit(sc)}
                          className="p-1.5 text-slate-500 hover:text-[#1F5FA8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar franja horaria"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setArchivingSchedule(sc)}
                          className="px-2.5 py-1 text-slate-500 hover:text-[#C8102E] hover:bg-red-50 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Archivar franja horaria"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span className="text-xs font-semibold">Archivar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="ucv-card ucv-scale-in rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="ucv-header-split text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white" />
                <h3 className="text-sm font-extrabold">
                  {editingSchedule ? 'Editar Franja Horaria' : 'Nueva Franja Horaria'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                disabled={formLoading}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Día de la semana *
                </label>
                <select
                  value={formData.weekday}
                  onChange={(e) => setFormData({ ...formData, weekday: Number(e.target.value) || 1 })}
                  disabled={formLoading}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                >
                  {Object.entries(WEEKDAYS).map(([num, name]) => (
                    <option key={num} value={num}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo de horario *
                </label>
                <select
                  value={formData.kind}
                  onChange={(e) => setFormData({ ...formData, kind: e.target.value as SessionKind })}
                  disabled={formLoading}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                >
                  <option value="teoria">Teoría</option>
                  <option value="practica">Práctica</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Hora de inicio *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    disabled={formLoading}
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
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                    disabled={formLoading}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider">
                    Aula / Laboratorio
                  </label>
                  <span className="text-[11px] text-slate-400">Opcional</span>
                </div>
                <input
                  type="text"
                  placeholder="Ej. Pabellón B - Aula 302"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  disabled={formLoading}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={formLoading}
                  className="flex-1 py-2 px-3 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2 px-3 bg-[#1F5FA8] hover:bg-[#0B2A5B] disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingSchedule ? 'Guardar cambios' : 'Crear franja'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={Boolean(archivingSchedule)}
        title="Archivar Franja Horaria"
        message="La franja se ocultará del horario semanal, pero las sesiones de clase ya generadas se conservan intactas."
        loading={archiveLoading}
        confirmLabel="Archivar"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchivingSchedule(null)}
      />
    </div>
  );
};
