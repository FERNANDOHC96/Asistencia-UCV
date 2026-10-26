import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Edit2, Archive, RefreshCw, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { Period, PeriodStatus } from '../../types';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

export const PeriodsScreen: React.FC = () => {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    starts_on: '',
    ends_on: '',
    status: 'planificado' as PeriodStatus,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Archive modal state
  const [archivingPeriod, setArchivingPeriod] = useState<Period | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchPeriods = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('No se pudo conectar con el servicio. Contacta al administrador.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: sbError } = await supabase
        .from('periods')
        .select('id, name, starts_on, ends_on, status')
        .is('archived_at', null)
        .order('starts_on', { ascending: false });

      if (sbError) {
        setError(translateSupabaseError(sbError, 'periods'));
        setPeriods([]);
      } else {
        setPeriods(data || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al conectar con Supabase.');
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const handleOpenCreate = () => {
    setEditingPeriod(null);
    setFormData({
      name: '',
      starts_on: new Date().toISOString().split('T')[0],
      ends_on: '',
      status: 'planificado',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: Period) => {
    setEditingPeriod(p);
    setFormData({
      name: p.name,
      starts_on: p.starts_on,
      ends_on: p.ends_on,
      status: p.status,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    if (!name) {
      setFormError('El nombre del periodo es obligatorio.');
      return;
    }

    if (!formData.starts_on || !formData.ends_on) {
      setFormError('Debe ingresar las fechas de inicio y fin.');
      return;
    }

    if (formData.ends_on < formData.starts_on) {
      setFormError('La fecha de fin debe ser posterior o igual a la de inicio (ends_on >= starts_on).');
      return;
    }

    setFormLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (editingPeriod) {
        // Update
        const { error: updError } = await supabase
          .from('periods')
          .update({
            name,
            starts_on: formData.starts_on,
            ends_on: formData.ends_on,
            status: formData.status,
          })
          .eq('id', editingPeriod.id);

        if (updError) {
          setFormError(translateSupabaseError(updError, 'periods'));
          return;
        }
      } else {
        // Create
        const { error: insError } = await supabase
          .from('periods')
          .insert({
            name,
            starts_on: formData.starts_on,
            ends_on: formData.ends_on,
            status: formData.status,
          });

        if (insError) {
          setFormError(translateSupabaseError(insError, 'periods'));
          return;
        }
      }

      setIsFormOpen(false);
      fetchPeriods();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error inesperado al guardar.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!archivingPeriod) return;
    setArchiveLoading(true);
    setArchiveSuccess(null);
    try {
      const supabase = getSupabaseClient();
      const { error: arcError } = await supabase
        .from('periods')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', archivingPeriod.id);

      if (arcError) {
        setError(translateSupabaseError(arcError, 'periods'));
      } else {
        setArchiveSuccess('Archivado');
        setTimeout(() => setArchiveSuccess(null), 4000);
        fetchPeriods();
      }
      setArchivingPeriod(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al archivar periodo.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const statusBadges: Record<PeriodStatus, { label: string; class: string }> = {
    planificado: { label: 'Planificado', class: 'bg-amber-50 text-amber-800 border-amber-200' },
    activo: { label: 'Activo', class: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    finalizado: { label: 'Finalizado', class: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1F5FA8] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
              Periodos Académicos
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestión de semestres y periodos lectivos universitarios
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPeriods}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-[#1F5FA8] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Recargar periodos"
            aria-label="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo periodo</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Archive Success Banner */}
      {archiveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{archiveSuccess}</span>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Cargando periodos académicos...</p>
          </div>
        ) : periods.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No hay periodos registrados</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Aún no existen periodos académicos en Supabase. Registra uno nuevo para estructurar cursos y secciones.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs font-bold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear primer periodo</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Nombre del Periodo</th>
                  <th scope="col" className="px-6 py-3.5">Fecha de Inicio</th>
                  <th scope="col" className="px-6 py-3.5">Fecha de Fin</th>
                  <th scope="col" className="px-6 py-3.5">Estado</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {periods.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-slate-900 font-mono">
                      {item.name}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {item.starts_on}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {item.ends_on}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold border px-2.5 py-0.5 rounded-full ${
                          statusBadges[item.status]?.class || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {statusBadges[item.status]?.label || item.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 text-slate-500 hover:text-[#1F5FA8] hover:bg-slate-100 rounded-md transition-colors"
                        title="Editar periodo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setArchivingPeriod(item)}
                        className="px-2 py-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="Archivar"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">Archivar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal (Create / Edit) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-[#0B2A5B] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingPeriod ? 'Editar Periodo Académico' : 'Nuevo Periodo Académico'}
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

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Nombre del periodo *
                </label>
                <input
                  type="text"
                  placeholder="Ej: 2026-I o 202602"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] font-mono text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Fecha de inicio *
                  </label>
                  <input
                    type="date"
                    value={formData.starts_on}
                    onChange={(e) => setFormData({ ...formData, starts_on: e.target.value })}
                    required
                    disabled={formLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Fecha de fin *
                  </label>
                  <input
                    type="date"
                    value={formData.ends_on}
                    onChange={(e) => setFormData({ ...formData, ends_on: e.target.value })}
                    required
                    disabled={formLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Estado del periodo
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as PeriodStatus })}
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                >
                  <option value="planificado">Planificado</option>
                  <option value="activo">Activo</option>
                  <option value="finalizado">Finalizado</option>
                </select>
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
                  <span>{editingPeriod ? 'Guardar cambios' : 'Crear periodo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(archivingPeriod)}
        title="Archivar Periodo Académico"
        message="Se ocultará de la web. Los datos se conservan en la base de datos."
        loading={archiveLoading}
        confirmLabel="Archivar"
        onConfirm={handleArchive}
        onCancel={() => setArchivingPeriod(null)}
      />
    </div>
  );
};
