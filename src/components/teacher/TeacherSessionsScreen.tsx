import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, Edit2, XCircle, Archive, RefreshCw, AlertCircle, Loader2, X, Calendar, BookOpen, AlertTriangle, FlaskConical, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getTeacherSections, TeacherSection } from '../../services/teacherService';
import { ClassSession, LearningUnit, AcademicWeek, SessionStatus, SessionKind } from '../../types';
import { getTodayLima, formatDisplayDate, formatTime } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

export const TeacherSessionsScreen: React.FC = () => {
  const { user } = useAuth();
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [weeks, setWeeks] = useState<AcademicWeek[]>([]);

  const [loadingSections, setLoadingSections] = useState<boolean>(true);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null);

  // Modal create/edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null);
  const [formData, setFormData] = useState({
    session_date: getTodayLima(),
    starts_at: '08:00',
    ends_at: '10:00',
    topic: '',
    unit_id: '',
    week_id: '',
    kind: 'teoria' as SessionKind,
    status: 'programada' as 'programada' | 'cancelada',
  });
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Archive modal
  const [archivingSession, setArchivingSession] = useState<ClassSession | null>(null);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);

  // Cancel Confirmation modal
  const [cancelingSession, setCancelingSession] = useState<ClassSession | null>(null);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);

  // Fetch teacher sections
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

  // Fetch sessions, units and weeks for current section
  const fetchSessionsData = useCallback(async () => {
    if (!selectedSectionId || !currentSection || !isSupabaseConfigured()) {
      setSessions([]);
      return;
    }

    setLoadingSessions(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // 1. Sesiones de la sección
      const { data: sData, error: sErr } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('section_id', selectedSectionId)
        .is('archived_at', null)
        .order('session_date', { ascending: false })
        .order('starts_at', { ascending: true });

      if (sErr) throw sErr;
      setSessions(sData || []);

      // 2. Unidades de la oferta para vincular opcionalmente
      const { data: uData } = await supabase
        .from('learning_units')
        .select('*')
        .eq('offering_id', currentSection.offering_id)
        .is('archived_at', null)
        .order('number', { ascending: true });
      setUnits(uData || []);

      // 3. Semanas de la oferta para vincular opcionalmente
      const { data: wData } = await supabase
        .from('academic_weeks')
        .select('*')
        .eq('offering_id', currentSection.offering_id)
        .is('archived_at', null)
        .order('number', { ascending: true });
      setWeeks(wData || []);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'class_sessions'));
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedSectionId, currentSection]);

  useEffect(() => {
    if (selectedSectionId) {
      fetchSessionsData();
    }
  }, [selectedSectionId, fetchSessionsData]);

  const handleOpenCreate = () => {
    setEditingSession(null);
    setFormData({
      session_date: getTodayLima(),
      starts_at: '08:00',
      ends_at: '10:00',
      topic: '',
      unit_id: units[0]?.id || '',
      week_id: weeks[0]?.id || '',
      kind: 'teoria',
      status: 'programada',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: ClassSession) => {
    if (s.status === 'cerrada') return; // Bloqueo: no permitir editar cerradas

    setEditingSession(s);
    setFormData({
      session_date: s.session_date,
      starts_at: s.starts_at ? s.starts_at.slice(0, 5) : '08:00',
      ends_at: s.ends_at ? s.ends_at.slice(0, 5) : '10:00',
      topic: s.topic || '',
      unit_id: s.unit_id || '',
      week_id: s.week_id || '',
      kind: s.kind || 'teoria',
      // Solo 'programada' o 'cancelada' permitidas al profesor
      status: s.status === 'cancelada' ? 'cancelada' : 'programada',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectionId) return;

    setFormError(null);

    if (!formData.session_date) {
      setFormError('La fecha de la sesión es obligatoria.');
      return;
    }

    if (!formData.starts_at || !formData.ends_at) {
      setFormError('Debe ingresar la hora de inicio y de fin.');
      return;
    }

    // Validación obligatoria: hora fin mayor que hora inicio
    if (formData.ends_at <= formData.starts_at) {
      setFormError('La hora de fin debe ser estrictamente mayor que la hora de inicio (ends_at > starts_at).');
      return;
    }

    setFormLoading(true);

    try {
      const supabase = getSupabaseClient();
      const payload = {
        section_id: selectedSectionId,
        session_date: formData.session_date,
        starts_at: formData.starts_at,
        ends_at: formData.ends_at,
        topic: formData.topic.trim(),
        unit_id: formData.unit_id ? formData.unit_id : null,
        week_id: formData.week_id ? formData.week_id : null,
        kind: formData.kind,
        // Solo 'programada' o 'cancelada'
        status: formData.status,
      };

      if (editingSession) {
        const { error: updErr } = await supabase
          .from('class_sessions')
          .update(payload)
          .eq('id', editingSession.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('class_sessions')
          .insert(payload);
        if (insErr) throw insErr;
      }

      setIsModalOpen(false);
      fetchSessionsData();
    } catch (err: unknown) {
      setFormError(translateSupabaseError(err, 'class_sessions'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelingSession) return;
    setCancelLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error: updErr } = await supabase
        .from('class_sessions')
        .update({ status: 'cancelada' })
        .eq('id', cancelingSession.id);

      if (updErr) throw updErr;

      fetchSessionsData();
      setCancelingSession(null);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'class_sessions'));
    } finally {
      setCancelLoading(false);
    }
  };

  const handleArchiveSession = async () => {
    if (!archivingSession) return;
    setArchiveLoading(true);
    setArchiveSuccess(null);
    try {
      const supabase = getSupabaseClient();
      const { error: arcErr } = await supabase
        .from('class_sessions')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', archivingSession.id);

      if (arcErr) throw arcErr;

      setArchiveSuccess('Archivado');
      setTimeout(() => setArchiveSuccess(null), 4000);
      fetchSessionsData();
      setArchivingSession(null);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'class_sessions'));
    } finally {
      setArchiveLoading(false);
    }
  };

  const statusBadges: Record<SessionStatus, { label: string; class: string }> = {
    programada: { label: 'Programada', class: 'bg-blue-50 text-[#1F5FA8] border-blue-200' },
    abierta: { label: 'Abierta', class: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    cerrada: { label: 'Cerrada', class: 'bg-slate-100 text-slate-700 border-slate-200' },
    cancelada: { label: 'Cancelada', class: 'bg-red-50 text-red-700 border-red-200' },
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
              Sesiones de Clase
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Planificación y control de sesiones lectivas por sección
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchSections();
              fetchSessionsData();
            }}
            disabled={loadingSections || loadingSessions}
            className="p-2 text-slate-600 hover:text-[#1F5FA8] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Recargar sesiones"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSessions ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            disabled={!selectedSectionId}
            className="px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva sesión</span>
          </button>
        </div>
      </div>

      {/* Section Selector Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex-1 max-w-xl">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
            Seleccionar Sección
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
          <div className="text-xs text-slate-600 font-medium">
            Mostrando <strong className="text-slate-900">{sessions.length}</strong> sesiones registradas
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

      {/* Sessions Table Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {loadingSessions ? (
          <div className="py-16 text-center text-xs text-slate-500">
            <Loader2 className="w-6 h-6 text-[#1F5FA8] animate-spin mx-auto mb-2" />
            Cargando sesiones de clase...
          </div>
        ) : !selectedSectionId ? (
          <div className="py-16 px-4 text-center text-xs text-slate-400">
            Selecciona una sección para ver sus sesiones de clase.
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No hay sesiones de clase registradas</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Programa las clases presenciales para registrar la asistencia manual de tus alumnos.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs font-bold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Programar primera sesión</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Fecha</th>
                  <th className="px-5 py-3.5">Tipo</th>
                  <th className="px-5 py-3.5">Horario</th>
                  <th className="px-5 py-3.5">Tema de la Clase</th>
                  <th className="px-5 py-3.5">Unidad / Semana</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sessions.map((s) => {
                  const linkedUnit = units.find((u) => u.id === s.unit_id);
                  const linkedWeek = weeks.find((w) => w.id === s.week_id);
                  const badge = statusBadges[s.status] || { label: s.status, class: 'bg-slate-100 text-slate-700' };
                  const isClosed = s.status === 'cerrada';
                  const isPractica = s.kind === 'practica';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Fecha */}
                      <td className="px-5 py-3.5 font-mono font-bold text-[#0B2A5B] whitespace-nowrap">
                        {formatDisplayDate(s.session_date)}
                      </td>

                      {/* Tipo con icono y texto (no solo color) */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-0.5 rounded-full ${
                            isPractica
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                          }`}
                        >
                          {isPractica ? (
                            <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                          ) : (
                            <BookOpen className="w-3.5 h-3.5 text-[#1F5FA8]" />
                          )}
                          <span>{isPractica ? 'Práctica' : 'Teoría'}</span>
                        </span>
                      </td>

                      {/* Horario */}
                      <td className="px-5 py-3.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                        {formatTime(s.starts_at)} - {formatTime(s.ends_at)}
                      </td>

                      {/* Tema */}
                      <td className="px-5 py-3.5 font-medium text-slate-900 max-w-xs">
                        {s.topic || 'Sin tema especificado'}
                      </td>

                      {/* Unidad / Semana */}
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {linkedUnit && (
                          <span className="bg-blue-50 text-[#1F5FA8] px-2 py-0.5 rounded font-mono text-[11px] mr-1 font-semibold">
                            U{linkedUnit.number}
                          </span>
                        )}
                        {linkedWeek && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">
                            Semana {linkedWeek.number}
                          </span>
                        )}
                        {!linkedUnit && !linkedWeek && <span className="text-slate-400 italic">-</span>}
                      </td>

                      {/* Estado visible */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold border px-2.5 py-0.5 rounded-full ${badge.class}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                        {isClosed ? (
                          <span className="text-slate-400 text-[11px] italic px-2">
                            Sesión cerrada (no editable)
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 text-slate-500 hover:text-[#1F5FA8] hover:bg-slate-100 rounded-md transition-colors"
                              title="Editar sesión"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setArchivingSession(s)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Archivar sesión"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                            {s.status !== 'cancelada' && (
                              <button
                                onClick={() => setCancelingSession(s)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Cancelar sesión"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </>
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

      {/* Modal Form (Create / Edit Session) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-[#0B2A5B] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingSession ? 'Editar Sesión de Clase' : 'Programar Nueva Sesión'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
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

              {/* Fecha y Tipo de la sesión */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Fecha de la Sesión *
                  </label>
                  <input
                    type="date"
                    value={formData.session_date}
                    onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                    required
                    disabled={formLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Tipo de Sesión *
                  </label>
                  <select
                    value={formData.kind}
                    onChange={(e) => setFormData({ ...formData, kind: e.target.value as SessionKind })}
                    required
                    disabled={formLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900 font-medium"
                  >
                    <option value="teoria">Teoría</option>
                    <option value="practica">Práctica</option>
                  </select>
                </div>
              </div>

              {/* Horas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Hora de Inicio *
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
                    Hora de Fin *
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

              {/* Tema */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Tema de la Clase *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Implementación de Autenticación con JWT"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  required
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                />
              </div>

              {/* Unidad y Semana Opcionales */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Unidad (Opcional)
                  </label>
                  <select
                    value={formData.unit_id}
                    onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                    disabled={formLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  >
                    <option value="">(Sin unidad)</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unidad {u.number}: {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Semana (Opcional)
                  </label>
                  <select
                    value={formData.week_id}
                    onChange={(e) => setFormData({ ...formData, week_id: e.target.value })}
                    disabled={formLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  >
                    <option value="">(Sin semana)</option>
                    {weeks.map((w) => (
                      <option key={w.id} value={w.id}>
                        Semana {w.number}: {w.topic || 'Tema'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Estado (solo programada o cancelada) */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Estado de la Sesión
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                >
                  <option value="programada">Programada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  <span>{editingSession ? 'Guardar cambios' : 'Programar sesión'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Session Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(cancelingSession)}
        title="Cancelar Sesión de Clase"
        message={`¿Estás seguro de que deseas marcar como cancelada la sesión del ${
          cancelingSession ? formatDisplayDate(cancelingSession.session_date) : ''
        } (${cancelingSession ? formatTime(cancelingSession.starts_at) : ''})?`}
        confirmLabel="Cancelar sesión"
        loading={cancelLoading}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelingSession(null)}
      />

      {/* Archive Session Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(archivingSession)}
        title="Archivar Sesión de Clase"
        message="Se ocultará de la web. Los datos se conservan en la base de datos."
        confirmLabel="Archivar"
        loading={archiveLoading}
        onConfirm={handleArchiveSession}
        onCancel={() => setArchivingSession(null)}
      />
    </div>
  );
};
