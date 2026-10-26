import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Calendar, Plus, Edit2, Archive, RefreshCw, AlertCircle, Loader2, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getTeacherSections, TeacherSection } from '../../services/teacherService';
import { LearningUnit, AcademicWeek, UnitStatus } from '../../types';
import { formatDisplayDate } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

export const TeacherUnitsWeeksScreen: React.FC = () => {
  const { user } = useAuth();
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'units' | 'weeks'>('units');

  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [weeks, setWeeks] = useState<AcademicWeek[]>([]);

  const [loadingSections, setLoadingSections] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null);

  // Unit Modal
  const [isUnitModalOpen, setIsUnitModalOpen] = useState<boolean>(false);
  const [editingUnit, setEditingUnit] = useState<LearningUnit | null>(null);
  const [unitForm, setUnitForm] = useState({
    number: 1,
    name: '',
    description: '',
    starts_on: '',
    ends_on: '',
    status: 'planificada' as UnitStatus,
  });
  const [unitFormLoading, setUnitFormLoading] = useState<boolean>(false);
  const [unitFormError, setUnitFormError] = useState<string | null>(null);

  // Week Modal
  const [isWeekModalOpen, setIsWeekModalOpen] = useState<boolean>(false);
  const [editingWeek, setEditingWeek] = useState<AcademicWeek | null>(null);
  const [weekForm, setWeekForm] = useState({
    number: 1,
    unit_id: '',
    starts_on: '',
    ends_on: '',
    topic: '',
    content: '',
    activities: '',
  });
  const [weekFormLoading, setWeekFormLoading] = useState<boolean>(false);
  const [weekFormError, setWeekFormError] = useState<string | null>(null);

  // Delete Modals
  const [deletingUnit, setDeletingUnit] = useState<LearningUnit | null>(null);
  const [deleteUnitLoading, setDeleteUnitLoading] = useState<boolean>(false);

  const [deletingWeek, setDeletingWeek] = useState<AcademicWeek | null>(null);
  const [deleteWeekLoading, setDeleteWeekLoading] = useState<boolean>(false);

  // Fetch teacher's sections
  const fetchSections = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoadingSections(false);
      return;
    }

    setLoadingSections(true);
    setError(null);

    try {
      const data = await getTeacherSections(user.id);
      setSections(data);
      if (data.length > 0 && !selectedSectionId) {
        setSelectedSectionId(data[0].id);
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
    } finally {
      setLoadingSections(false);
    }
  }, [user, selectedSectionId]);

  useEffect(() => {
    fetchSections();
  }, [user]);

  const currentSection = sections.find((s) => s.id === selectedSectionId) || null;
  const currentOfferingId = currentSection?.offering_id || null;

  // Fetch Units & Weeks for current offering_id
  const fetchUnitsAndWeeks = useCallback(async () => {
    if (!currentOfferingId || !isSupabaseConfigured()) {
      setUnits([]);
      setWeeks([]);
      return;
    }

    setLoadingData(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // 1. Unidades
      const { data: uData, error: uErr } = await supabase
        .from('learning_units')
        .select('*')
        .eq('offering_id', currentOfferingId)
        .is('archived_at', null)
        .order('number', { ascending: true });
      if (uErr) throw uErr;
      setUnits(uData || []);

      // 2. Semanas
      const { data: wData, error: wErr } = await supabase
        .from('academic_weeks')
        .select('*')
        .eq('offering_id', currentOfferingId)
        .is('archived_at', null)
        .order('number', { ascending: true });
      if (wErr) throw wErr;
      setWeeks(wData || []);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, activeTab === 'units' ? 'learning_units' : 'academic_weeks'));
    } finally {
      setLoadingData(false);
    }
  }, [currentOfferingId, activeTab]);

  useEffect(() => {
    if (currentOfferingId) {
      fetchUnitsAndWeeks();
    }
  }, [currentOfferingId, fetchUnitsAndWeeks]);

  // UNIT CRUD
  const handleOpenCreateUnit = () => {
    const nextNumber = units.length > 0 ? Math.max(...units.map((u) => u.number)) + 1 : 1;
    setEditingUnit(null);
    setUnitForm({
      number: nextNumber,
      name: '',
      description: '',
      starts_on: '',
      ends_on: '',
      status: 'planificada',
    });
    setUnitFormError(null);
    setIsUnitModalOpen(true);
  };

  const handleOpenEditUnit = (u: LearningUnit) => {
    setEditingUnit(u);
    setUnitForm({
      number: u.number,
      name: u.name,
      description: u.description || '',
      starts_on: u.starts_on,
      ends_on: u.ends_on,
      status: u.status,
    });
    setUnitFormError(null);
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOfferingId) return;

    setUnitFormError(null);

    if (unitForm.number <= 0) {
      setUnitFormError('El número de unidad debe ser mayor a 0.');
      return;
    }
    if (!unitForm.name.trim()) {
      setUnitFormError('El nombre de la unidad es obligatorio.');
      return;
    }
    if (!unitForm.starts_on || !unitForm.ends_on) {
      setUnitFormError('Las fechas de inicio y fin son obligatorias.');
      return;
    }
    if (unitForm.ends_on < unitForm.starts_on) {
      setUnitFormError('La fecha de fin no puede ser menor que la de inicio (ends_on >= starts_on).');
      return;
    }

    setUnitFormLoading(true);

    try {
      const supabase = getSupabaseClient();
      const payload = {
        offering_id: currentOfferingId,
        number: Number(unitForm.number),
        name: unitForm.name.trim(),
        description: unitForm.description.trim(),
        starts_on: unitForm.starts_on,
        ends_on: unitForm.ends_on,
        status: unitForm.status,
      };

      if (editingUnit) {
        const { error: updErr } = await supabase
          .from('learning_units')
          .update(payload)
          .eq('id', editingUnit.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('learning_units')
          .insert(payload);
        if (insErr) throw insErr;
      }

      setIsUnitModalOpen(false);
      fetchUnitsAndWeeks();
    } catch (err: unknown) {
      setUnitFormError(translateSupabaseError(err, 'learning_units'));
    } finally {
      setUnitFormLoading(false);
    }
  };

  const handleArchiveUnit = async () => {
    if (!deletingUnit) return;
    setDeleteUnitLoading(true);
    setArchiveSuccess(null);
    try {
      const supabase = getSupabaseClient();
      const { error: arcErr } = await supabase
        .from('learning_units')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', deletingUnit.id);
      if (arcErr) throw arcErr;

      setArchiveSuccess('Archivado');
      setTimeout(() => setArchiveSuccess(null), 4000);
      fetchUnitsAndWeeks();
      setDeletingUnit(null);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'learning_units'));
    } finally {
      setDeleteUnitLoading(false);
    }
  };

  // WEEK CRUD
  const handleOpenCreateWeek = () => {
    const nextNumber = weeks.length > 0 ? Math.max(...weeks.map((w) => w.number)) + 1 : 1;
    setEditingWeek(null);
    setWeekForm({
      number: nextNumber,
      unit_id: units[0]?.id || '',
      starts_on: '',
      ends_on: '',
      topic: '',
      content: '',
      activities: '',
    });
    setWeekFormError(null);
    setIsWeekModalOpen(true);
  };

  const handleOpenEditWeek = (w: AcademicWeek) => {
    setEditingWeek(w);
    setWeekForm({
      number: w.number,
      unit_id: w.unit_id || '',
      starts_on: w.starts_on,
      ends_on: w.ends_on,
      topic: w.topic || '',
      content: w.content || '',
      activities: w.activities || '',
    });
    setWeekFormError(null);
    setIsWeekModalOpen(true);
  };

  const handleSaveWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOfferingId) return;

    setWeekFormError(null);

    if (weekForm.number <= 0) {
      setWeekFormError('El número de semana debe ser mayor a 0.');
      return;
    }
    if (!weekForm.starts_on || !weekForm.ends_on) {
      setWeekFormError('Las fechas de inicio y fin son obligatorias.');
      return;
    }
    if (weekForm.ends_on < weekForm.starts_on) {
      setWeekFormError('La fecha de fin no puede ser menor que la de inicio (ends_on >= starts_on).');
      return;
    }

    setWeekFormLoading(true);

    try {
      const supabase = getSupabaseClient();
      const payload = {
        offering_id: currentOfferingId,
        unit_id: weekForm.unit_id ? weekForm.unit_id : null,
        number: Number(weekForm.number),
        starts_on: weekForm.starts_on,
        ends_on: weekForm.ends_on,
        topic: weekForm.topic.trim(),
        content: weekForm.content.trim(),
        activities: weekForm.activities.trim(),
      };

      if (editingWeek) {
        const { error: updErr } = await supabase
          .from('academic_weeks')
          .update(payload)
          .eq('id', editingWeek.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('academic_weeks')
          .insert(payload);
        if (insErr) throw insErr;
      }

      setIsWeekModalOpen(false);
      fetchUnitsAndWeeks();
    } catch (err: unknown) {
      setWeekFormError(translateSupabaseError(err, 'academic_weeks'));
    } finally {
      setWeekFormLoading(false);
    }
  };

  const handleArchiveWeek = async () => {
    if (!deletingWeek) return;
    setDeleteWeekLoading(true);
    setArchiveSuccess(null);
    try {
      const supabase = getSupabaseClient();
      const { error: arcErr } = await supabase
        .from('academic_weeks')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', deletingWeek.id);
      if (arcErr) throw arcErr;

      setArchiveSuccess('Archivado');
      setTimeout(() => setArchiveSuccess(null), 4000);
      fetchUnitsAndWeeks();
      setDeletingWeek(null);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'academic_weeks'));
    } finally {
      setDeleteWeekLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1F5FA8] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
              Unidades y Semanas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Estructuración del sílabo, contenidos temáticos y cronograma semanal
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchSections();
              fetchUnitsAndWeeks();
            }}
            disabled={loadingSections || loadingData}
            className="p-2 text-slate-600 hover:text-[#1F5FA8] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          </button>
          {activeTab === 'units' ? (
            <button
              onClick={handleOpenCreateUnit}
              disabled={!currentOfferingId}
              className="px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Unidad</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCreateWeek}
              disabled={!currentOfferingId}
              className="px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Semana</span>
            </button>
          )}
        </div>
      </div>

      {/* Section Selection Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex-1 max-w-xl">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Seleccionar Asignatura / Sección
          </label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            disabled={sections.length === 0}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-xs sm:text-sm bg-white text-slate-900"
          >
            {sections.length === 0 ? (
              <option value="">No tienes asignaturas a cargo</option>
            ) : (
              sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.offering.period.name} — {s.offering.course.code} ({s.offering.course.name}) — Sección {s.name}
                </option>
              ))
            )}
          </select>
        </div>

        {currentSection && (
          <div className="text-xs text-slate-500 font-medium">
            Oferta académica:{' '}
            <strong className="text-slate-800 font-mono">
              {currentSection.offering.course.name} ({currentSection.offering.period.name})
            </strong>
          </div>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Archive Success Notice */}
      {archiveSuccess && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">{archiveSuccess}</span>
          </div>
          <button onClick={() => setArchiveSuccess(null)} className="text-amber-700 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Switcher & Content */}
      {!currentOfferingId ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500">
          Selecciona una sección para gestionar sus unidades y semanas académicas.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Switcher Tab */}
          <div className="flex border-b border-slate-200 gap-6 text-xs sm:text-sm">
            <button
              onClick={() => setActiveTab('units')}
              className={`pb-2.5 font-bold transition-colors cursor-pointer border-b-2 ${
                activeTab === 'units'
                  ? 'border-[#C8102E] text-[#0B2A5B]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Unidades de Aprendizaje ({units.length})
            </button>
            <button
              onClick={() => setActiveTab('weeks')}
              className={`pb-2.5 font-bold transition-colors cursor-pointer border-b-2 ${
                activeTab === 'weeks'
                  ? 'border-[#C8102E] text-[#0B2A5B]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Semanas Académicas ({weeks.length} registradas)
            </button>
          </div>

          {/* TAB 1: UNIDADES */}
          {activeTab === 'units' && (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              {loadingData ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <Loader2 className="w-6 h-6 text-[#1F5FA8] animate-spin mx-auto mb-2" />
                  Cargando unidades...
                </div>
              ) : units.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-800">No hay unidades de aprendizaje</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Aún no has registrado las unidades del sílabo para este curso.
                  </p>
                  <button
                    onClick={handleOpenCreateUnit}
                    className="mt-4 px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs font-bold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear primera unidad</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="px-5 py-3.5">N°</th>
                        <th className="px-5 py-3.5">Nombre de la Unidad</th>
                        <th className="px-5 py-3.5">Descripción</th>
                        <th className="px-5 py-3.5">Vigencia (Inicio - Fin)</th>
                        <th className="px-5 py-3.5">Estado</th>
                        <th className="px-5 py-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {units.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5 font-bold font-mono text-[#0B2A5B]">
                            Unidad {u.number}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-900">
                            {u.name}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 max-w-xs line-clamp-2">
                            {u.description || '-'}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-slate-600 whitespace-nowrap">
                            {formatDisplayDate(u.starts_on)} al {formatDisplayDate(u.ends_on)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border capitalize bg-slate-100 text-slate-700">
                              {u.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenEditUnit(u)}
                              className="p-1.5 text-slate-500 hover:text-[#1F5FA8] hover:bg-slate-100 rounded-md transition-colors"
                              title="Editar unidad"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingUnit(u)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Archivar unidad"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SEMANAS */}
          {activeTab === 'weeks' && (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              {loadingData ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <Loader2 className="w-6 h-6 text-[#1F5FA8] animate-spin mx-auto mb-2" />
                  Cargando semanas...
                </div>
              ) : weeks.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-800">No hay semanas académicas</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Define la cantidad de semanas según el calendario académico universitario.
                  </p>
                  <button
                    onClick={handleOpenCreateWeek}
                    className="mt-4 px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs font-bold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear primera semana</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="px-5 py-3.5">N°</th>
                        <th className="px-5 py-3.5">Unidad Asociada</th>
                        <th className="px-5 py-3.5">Fechas</th>
                        <th className="px-5 py-3.5">Tema Principal</th>
                        <th className="px-5 py-3.5">Contenidos y Actividades</th>
                        <th className="px-5 py-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {weeks.map((w) => {
                        const linkedUnit = units.find((u) => u.id === w.unit_id);
                        return (
                          <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3.5 font-bold font-mono text-[#0B2A5B]">
                              Semana {w.number}
                            </td>
                            <td className="px-5 py-3.5">
                              {linkedUnit ? (
                                <span className="bg-blue-50 text-[#1F5FA8] px-2 py-0.5 rounded font-semibold text-[11px]">
                                  Unidad {linkedUnit.number}: {linkedUnit.name}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Sin unidad</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-600 whitespace-nowrap">
                              {formatDisplayDate(w.starts_on)} al {formatDisplayDate(w.ends_on)}
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-900">
                              {w.topic || '-'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                              {w.content || w.activities || '-'}
                            </td>
                            <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => handleOpenEditWeek(w)}
                                className="p-1.5 text-slate-500 hover:text-[#1F5FA8] hover:bg-slate-100 rounded-md transition-colors"
                                title="Editar semana"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingWeek(w)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                                title="Archivar semana"
                              >
                                <Archive className="w-4 h-4" />
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
          )}
        </div>
      )}

      {/* Unit Form Modal */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-[#0B2A5B] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingUnit ? 'Editar Unidad de Aprendizaje' : 'Nueva Unidad de Aprendizaje'}
              </h3>
              <button
                onClick={() => setIsUnitModalOpen(false)}
                disabled={unitFormLoading}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="p-6 space-y-4 text-xs">
              {unitFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{unitFormError}</div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Número *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={unitForm.number}
                    onChange={(e) => setUnitForm({ ...unitForm, number: parseInt(e.target.value) || 1 })}
                    required
                    disabled={unitFormLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] font-mono text-slate-900"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Estado
                  </label>
                  <select
                    value={unitForm.status}
                    onChange={(e) => setUnitForm({ ...unitForm, status: e.target.value as UnitStatus })}
                    disabled={unitFormLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  >
                    <option value="planificada">Planificada</option>
                    <option value="en_curso">En curso</option>
                    <option value="finalizada">Finalizada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Nombre de la Unidad *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Fundamentos del Desarrollo Web"
                  value={unitForm.name}
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                  required
                  disabled={unitFormLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  placeholder="Competencias y capacidades a desarrollar..."
                  value={unitForm.description}
                  onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                  disabled={unitFormLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Fecha de inicio *
                  </label>
                  <input
                    type="date"
                    value={unitForm.starts_on}
                    onChange={(e) => setUnitForm({ ...unitForm, starts_on: e.target.value })}
                    required
                    disabled={unitFormLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Fecha de fin *
                  </label>
                  <input
                    type="date"
                    value={unitForm.ends_on}
                    onChange={(e) => setUnitForm({ ...unitForm, ends_on: e.target.value })}
                    required
                    disabled={unitFormLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUnitModalOpen(false)}
                  disabled={unitFormLoading}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={unitFormLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1F5FA8] hover:bg-[#174B88] rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {unitFormLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingUnit ? 'Guardar cambios' : 'Crear unidad'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Week Form Modal */}
      {isWeekModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-[#0B2A5B] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingWeek ? 'Editar Semana Académica' : 'Nueva Semana Académica'}
              </h3>
              <button
                onClick={() => setIsWeekModalOpen(false)}
                disabled={weekFormLoading}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWeek} className="p-6 space-y-4 text-xs">
              {weekFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{weekFormError}</div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    N° Semana *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={weekForm.number}
                    onChange={(e) => setWeekForm({ ...weekForm, number: parseInt(e.target.value) || 1 })}
                    required
                    disabled={weekFormLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] font-mono text-slate-900"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Unidad Asociada
                  </label>
                  <select
                    value={weekForm.unit_id}
                    onChange={(e) => setWeekForm({ ...weekForm, unit_id: e.target.value })}
                    disabled={weekFormLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  >
                    <option value="">(Opcional / Sin unidad)</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unidad {u.number}: {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Tema Principal *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Arquitectura de software cliente-servidor"
                  value={weekForm.topic}
                  onChange={(e) => setWeekForm({ ...weekForm, topic: e.target.value })}
                  required
                  disabled={weekFormLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Fecha de inicio *
                  </label>
                  <input
                    type="date"
                    value={weekForm.starts_on}
                    onChange={(e) => setWeekForm({ ...weekForm, starts_on: e.target.value })}
                    required
                    disabled={weekFormLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Fecha de fin *
                  </label>
                  <input
                    type="date"
                    value={weekForm.ends_on}
                    onChange={(e) => setWeekForm({ ...weekForm, ends_on: e.target.value })}
                    required
                    disabled={weekFormLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Contenido
                </label>
                <textarea
                  rows={2}
                  placeholder="Subtemas teóricos a desarrollar..."
                  value={weekForm.content}
                  onChange={(e) => setWeekForm({ ...weekForm, content: e.target.value })}
                  disabled={weekFormLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Actividades
                </label>
                <textarea
                  rows={2}
                  placeholder="Talleres prácticos, laboratorios, lecturas..."
                  value={weekForm.activities}
                  onChange={(e) => setWeekForm({ ...weekForm, activities: e.target.value })}
                  disabled={weekFormLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsWeekModalOpen(false)}
                  disabled={weekFormLoading}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={weekFormLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1F5FA8] hover:bg-[#174B88] rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {weekFormLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingWeek ? 'Guardar cambios' : 'Crear semana'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Unit Confirmation */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingUnit)}
        title="Archivar Unidad de Aprendizaje"
        message="Se ocultará de la web. Los datos se conservan en la base de datos."
        confirmLabel="Archivar"
        loading={deleteUnitLoading}
        onConfirm={handleArchiveUnit}
        onCancel={() => setDeletingUnit(null)}
      />

      {/* Archive Week Confirmation */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingWeek)}
        title="Archivar Semana Académica"
        message="Se ocultará de la web. Los datos se conservan en la base de datos."
        confirmLabel="Archivar"
        loading={deleteWeekLoading}
        onConfirm={handleArchiveWeek}
        onCancel={() => setDeletingWeek(null)}
      />
    </div>
  );
};
