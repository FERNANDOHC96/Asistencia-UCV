import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, Plus, Edit2, Archive, RefreshCw, AlertCircle, Loader2, X, Calendar, MapPin, CheckCircle2 } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { Section, Schedule } from '../../types';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

interface SectionOption extends Section {
  offering?: {
    id: string;
    course_id: string;
    period_id: string;
    course?: { id: string; code: string; name: string };
    period?: { id: string; name: string };
  };
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

export const SchedulesScreen: React.FC = () => {
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form modal (create/edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({
    weekday: 1,
    starts_at: '08:00',
    ends_at: '10:00',
    room: '',
    kind: 'teoria' as 'teoria' | 'practica',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Archive modal
  const [archivingSchedule, setArchivingSchedule] = useState<Schedule | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null);

  // Fetch sections with course and period
  const fetchSections = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('No se pudo conectar con el servicio. Contacta al administrador.');
      setLoadingSections(false);
      return;
    }

    setLoadingSections(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: sErr } = await supabase
        .from('sections')
        .select(`
          id,
          offering_id,
          name,
          capacity,
          archived_at,
          offering:course_offerings (
            id,
            course_id,
            period_id,
            course:courses (id, code, name, archived_at),
            period:periods (id, name, archived_at)
          )
        `)
        .is('archived_at', null)
        .order('name', { ascending: true });

      if (sErr) throw sErr;
      const list: SectionOption[] = (data || [])
        .filter((sec: any) => {
          const off = Array.isArray(sec.offering) ? sec.offering[0] : sec.offering;
          const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;
          const per = off && Array.isArray(off.period) ? off.period[0] : off?.period;
          if (!crs || crs.archived_at) return false;
          if (!per || per.archived_at) return false;
          return true;
        })
        .map((sec: any) => {
          const off = Array.isArray(sec.offering) ? sec.offering[0] : sec.offering;
          const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;
          const per = off && Array.isArray(off.period) ? off.period[0] : off?.period;
          return {
            ...sec,
            offering: off
              ? {
                  ...off,
                  course: crs,
                  period: per,
                }
              : undefined,
          };
        });
      setSections(list);
      if (list.length > 0 && !selectedSectionId) {
        setSelectedSectionId(list[0].id);
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'sections'));
    } finally {
      setLoadingSections(false);
    }
  }, [selectedSectionId]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  // Fetch schedules for the selected section
  const fetchSchedules = useCallback(async () => {
    if (!selectedSectionId || !isSupabaseConfigured()) {
      setSchedules([]);
      return;
    }

    setLoadingSchedules(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: scErr } = await supabase
        .from('schedules')
        .select('id, section_id, weekday, starts_at, ends_at, room, kind')
        .eq('section_id', selectedSectionId)
        .is('archived_at', null)
        .order('weekday', { ascending: true })
        .order('starts_at', { ascending: true });

      if (scErr) throw scErr;
      setSchedules(data || []);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'schedules'));
      setSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  }, [selectedSectionId]);

  useEffect(() => {
    if (selectedSectionId) {
      fetchSchedules();
    }
  }, [selectedSectionId, fetchSchedules]);

  const currentSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId) || null;
  }, [sections, selectedSectionId]);

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setFormData({
      weekday: 1,
      starts_at: '08:00',
      ends_at: '10:00',
      room: '',
      kind: 'teoria',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (sc: Schedule) => {
    setEditingSchedule(sc);
    // starts_at and ends_at can be "08:00:00" from postgres time format; slice to HH:mm for HTML time input
    const cleanStart = sc.starts_at ? sc.starts_at.slice(0, 5) : '08:00';
    const cleanEnd = sc.ends_at ? sc.ends_at.slice(0, 5) : '10:00';

    setFormData({
      weekday: sc.weekday,
      starts_at: cleanStart,
      ends_at: cleanEnd,
      room: sc.room || '',
      kind: sc.kind || 'teoria',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedSectionId) {
      setFormError('Debe seleccionar una sección.');
      return;
    }

    const { weekday, starts_at, ends_at, room, kind } = formData;

    if (!starts_at || !ends_at) {
      setFormError('Debe ingresar la hora de inicio y de fin.');
      return;
    }

    // Validación obligatoria: hora fin mayor que hora inicio
    if (ends_at <= starts_at) {
      setFormError('La hora de fin debe ser estrictamente mayor que la hora de inicio (ends_at > starts_at).');
      return;
    }

    setFormLoading(true);

    try {
      const supabase = getSupabaseClient();
      const payload = {
        section_id: selectedSectionId,
        weekday: Number(weekday),
        starts_at,
        ends_at,
        room: room.trim() ? room.trim() : null,
        kind,
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
      } else {
        const { error: insErr } = await supabase
          .from('schedules')
          .insert(payload);

        if (insErr) {
          setFormError(translateSupabaseError(insErr, 'schedules'));
          return;
        }
      }

      setIsFormOpen(false);
      fetchSchedules();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar franja horaria.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!archivingSchedule) return;
    setArchiveLoading(true);
    setArchiveSuccess(null);

    try {
      const supabase = getSupabaseClient();
      const { error: arcErr } = await supabase
        .from('schedules')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', archivingSchedule.id);

      if (arcErr) {
        setError(translateSupabaseError(arcErr, 'schedules'));
      } else {
        setArchiveSuccess('Archivado');
        setTimeout(() => setArchiveSuccess(null), 4000);
        fetchSchedules();
      }
      setArchivingSchedule(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al archivar franja.');
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1F5FA8] flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
              Horarios de Clases
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Franjas horarias semanales y asignación de aulas por sección
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchSections();
              fetchSchedules();
            }}
            disabled={loadingSections || loadingSchedules}
            className="p-2 text-slate-600 hover:text-[#1F5FA8] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Recargar horarios"
            aria-label="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSchedules ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            disabled={!selectedSectionId}
            className="px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar franja horaria</span>
          </button>
        </div>
      </div>

      {/* Section Selector Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex-1 max-w-xl">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Seleccionar Sección Académica
          </label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            disabled={sections.length === 0}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-xs sm:text-sm bg-white text-slate-900"
          >
            {sections.length === 0 ? (
              <option value="">No hay secciones disponibles</option>
            ) : (
              sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.offering?.period?.name} — {s.offering?.course?.code} ({s.offering?.course?.name}) — Sección {s.name}
                </option>
              ))
            )}
          </select>
        </div>

        {currentSection && (
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs text-slate-700 flex items-center gap-4">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Asignatura</span>
              <strong className="text-slate-900">{currentSection.offering?.course?.name}</strong>
            </div>
            <div className="border-l border-blue-200 pl-4">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Sección</span>
              <strong className="text-[#1F5FA8] font-mono text-sm">{currentSection.name}</strong>
            </div>
            <div className="border-l border-blue-200 pl-4">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Periodo</span>
              <strong className="text-slate-800 font-mono">{currentSection.offering?.period?.name}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Archive Success Banner */}
      {archiveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{archiveSuccess}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Schedules Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {loadingSchedules ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Cargando horario de la sección...</p>
          </div>
        ) : !selectedSectionId ? (
          <div className="py-16 px-4 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">Selecciona una sección</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Debes crear al menos una sección en el sistema para poder asignarle franjas de horario.
            </p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">Sin franjas horarias asignadas</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Esta sección aún no tiene horarios registrados en Supabase.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs font-bold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar primera franja horaria</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Día de la Semana</th>
                  <th scope="col" className="px-6 py-3.5">Tipo</th>
                  <th scope="col" className="px-6 py-3.5">Hora de Inicio</th>
                  <th scope="col" className="px-6 py-3.5">Hora de Fin</th>
                  <th scope="col" className="px-6 py-3.5">Duración</th>
                  <th scope="col" className="px-6 py-3.5">Aula / Pabellón</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {schedules.map((sc) => {
                  const startClean = sc.starts_at ? sc.starts_at.slice(0, 5) : '-';
                  const endClean = sc.ends_at ? sc.ends_at.slice(0, 5) : '-';
                  const isPractica = sc.kind === 'practica';

                  return (
                    <tr key={sc.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Día */}
                      <td className="px-6 py-3.5 font-bold text-slate-900">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full text-[11px]">
                          <Calendar className="w-3 h-3 text-[#1F5FA8]" />
                          {WEEKDAYS[sc.weekday] || `Día ${sc.weekday}`}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${
                            isPractica
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                          }`}
                        >
                          {isPractica ? 'Práctica' : 'Teoría'}
                        </span>
                      </td>

                      {/* Inicio */}
                      <td className="px-6 py-3.5 font-mono font-semibold text-slate-800">
                        {startClean}
                      </td>

                      {/* Fin */}
                      <td className="px-6 py-3.5 font-mono font-semibold text-slate-800">
                        {endClean}
                      </td>

                      {/* Franja */}
                      <td className="px-6 py-3.5 text-slate-500 font-mono text-[11px]">
                        {startClean} - {endClean}
                      </td>

                      {/* Aula */}
                      <td className="px-6 py-3.5">
                        {sc.room ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <MapPin className="w-3 h-3 text-red-600" />
                            {sc.room}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sin asignar</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleOpenEdit(sc)}
                          className="p-1.5 text-slate-500 hover:text-[#1F5FA8] hover:bg-slate-100 rounded-md transition-colors"
                          title="Editar franja horaria"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setArchivingSchedule(sc)}
                          className="px-2 py-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Archivar"
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

      {/* Form Modal (Create / Edit Schedule) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-[#0B2A5B] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingSchedule ? 'Editar Franja Horaria' : 'Nueva Franja Horaria'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                disabled={formLoading}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{formError}</div>
                </div>
              )}

              {/* Día de la semana */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Día de la semana *
                </label>
                <select
                  value={formData.weekday}
                  onChange={(e) => setFormData({ ...formData, weekday: parseInt(e.target.value) || 1 })}
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                >
                  <option value={1}>Lunes</option>
                  <option value={2}>Martes</option>
                  <option value={3}>Miércoles</option>
                  <option value={4}>Jueves</option>
                  <option value={5}>Viernes</option>
                  <option value={6}>Sábado</option>
                  <option value={7}>Domingo</option>
                </select>
              </div>

              {/* Tipo de horario (Teoría / Práctica) */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Tipo de Horario *
                </label>
                <select
                  value={formData.kind}
                  onChange={(e) => setFormData({ ...formData, kind: e.target.value as 'teoria' | 'practica' })}
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                >
                  <option value="teoria">Teoría</option>
                  <option value="practica">Práctica</option>
                </select>
              </div>

              {/* Horas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Hora de inicio *
                  </label>
                  <input
                    type="time"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    required
                    disabled={formLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Hora de fin *
                  </label>
                  <input
                    type="time"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                    required
                    disabled={formLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] font-mono text-slate-900"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                ⚠️ La hora de fin debe ser estrictamente posterior a la hora de inicio.
              </p>

              {/* Aula */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-slate-700 uppercase tracking-wide">
                    Aula / Laboratorio / Pabellón
                  </label>
                  <span className="text-slate-400 text-[11px]">Opcional</span>
                </div>
                <input
                  type="text"
                  placeholder="Ej: Pabellón B - Aula 302 o Lab-4"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={formLoading}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1F5FA8] hover:bg-[#174B88] rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingSchedule ? 'Guardar cambios' : 'Crear franja'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(archivingSchedule)}
        title="Archivar Franja Horaria"
        message="Se ocultará de la web. Los datos se conservan en la base de datos."
        loading={archiveLoading}
        confirmLabel="Archivar"
        onConfirm={handleArchive}
        onCancel={() => setArchivingSchedule(null)}
      />
    </div>
  );
};
