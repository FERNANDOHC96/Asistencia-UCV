import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Users, Calendar, Layers, Clock, ArrowLeft, RefreshCw, AlertCircle, Loader2, MapPin, CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getTeacherSections, getSectionActiveStudents, TeacherSection } from '../../services/teacherService';
import { LearningUnit, AcademicWeek, ClassSession, Schedule, Profile } from '../../types';
import { formatDisplayDate, formatTime } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';

const WEEKDAYS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export const TeacherCoursesScreen: React.FC = () => {
  const { user } = useAuth();
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<TeacherSection | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'alumnos' | 'unidades' | 'semanas' | 'sesiones' | 'horario'>('info');

  const [loading, setLoading] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Detail data for the selected section
  const [students, setStudents] = useState<Profile[]>([]);
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [weeks, setWeeks] = useState<AcademicWeek[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const fetchSections = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getTeacherSections(user.id);
      setSections(data);
      if (selectedSection) {
        const refreshed = data.find((s) => s.id === selectedSection.id);
        if (refreshed) setSelectedSection(refreshed);
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [user, selectedSection]);

  useEffect(() => {
    fetchSections();
  }, [user]);

  // Fetch detail data when section is opened
  const fetchSectionDetail = useCallback(async (section: TeacherSection) => {
    setDetailLoading(true);
    try {
      const supabase = getSupabaseClient();

      // 1. Alumnos activos
      const activeStudents = await getSectionActiveStudents(section.id);
      setStudents(activeStudents);

      // 2. Unidades de aprendizaje (por offering_id, no archivadas)
      const { data: uData } = await supabase
        .from('learning_units')
        .select('*')
        .eq('offering_id', section.offering_id)
        .is('archived_at', null)
        .order('number', { ascending: true });
      setUnits(uData || []);

      // 3. Semanas académicas (por offering_id, no archivadas)
      const { data: wData } = await supabase
        .from('academic_weeks')
        .select('*')
        .eq('offering_id', section.offering_id)
        .is('archived_at', null)
        .order('number', { ascending: true });
      setWeeks(wData || []);

      // 4. Sesiones de clase (por section_id, no archivadas)
      const { data: sData } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('section_id', section.id)
        .is('archived_at', null)
        .order('session_date', { ascending: true })
        .order('starts_at', { ascending: true });
      setSessions(sData || []);

      // 5. Horarios (por section_id, no archivados)
      const { data: scData } = await supabase
        .from('schedules')
        .select('*')
        .eq('section_id', section.id)
        .is('archived_at', null)
        .order('weekday', { ascending: true })
        .order('starts_at', { ascending: true });
      setSchedules(scData || []);
    } catch (err: unknown) {
      console.error('Error fetching section detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSelectSection = (section: TeacherSection) => {
    setSelectedSection(section);
    setActiveTab('info');
    fetchSectionDetail(section);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      {!selectedSection ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1F5FA8] flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
                Mis Asignaturas
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Carga lectiva asignada con acceso a sílabos, estudiantes y horarios
            </p>
          </div>

          <button
            onClick={fetchSections}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-[#1F5FA8] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Recargar asignaturas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedSection(null)}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-[#1F5FA8] hover:bg-slate-50 transition-colors cursor-pointer"
              title="Volver a la lista de asignaturas"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-blue-50 text-[#1F5FA8] border border-blue-200 px-2 py-0.5 rounded">
                  Sección {selectedSection.name}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedSection.offering.period.name}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-[#0B2A5B] mt-0.5">
                {selectedSection.offering.course.name} ({selectedSection.offering.course.code})
              </h1>
            </div>
          </div>

          <button
            onClick={() => fetchSectionDetail(selectedSection)}
            disabled={detailLoading}
            className="p-2 text-slate-600 hover:text-[#1F5FA8] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Recargar detalles de la sección"
          >
            <RefreshCw className={`w-4 h-4 ${detailLoading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* View 1: List of Assigned Sections */}
      {!selectedSection ? (
        loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Cargando asignaturas...</p>
          </div>
        ) : sections.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No tienes asignaturas a cargo</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Todavía no tienes cursos asignados. Pide al administrador que te asigne una sección.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sections.map((sec) => (
              <div
                key={sec.id}
                onClick={() => handleSelectSection(sec)}
                className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold bg-blue-50 text-[#1F5FA8] border border-blue-200 px-2.5 py-0.5 rounded-md">
                      Sección {sec.name}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-slate-500">
                      {sec.offering.period.name}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#1F5FA8] transition-colors leading-snug">
                    {sec.offering.course.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    Cód: {sec.offering.course.code} • {sec.offering.course.credits} créditos
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <strong>{sec.activeEnrollmentsCount}</strong> alumnos matriculados
                  </span>
                  <span className="text-[#1F5FA8] font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                    <span>Detalles</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* View 2: Section Detail with 6 Tabs */
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-1.5 flex items-center gap-1 overflow-x-auto text-xs">
            {[
              { id: 'info', label: 'Información general', icon: <FileText className="w-3.5 h-3.5" /> },
              { id: 'alumnos', label: `Alumnos (${students.length})`, icon: <Users className="w-3.5 h-3.5" /> },
              { id: 'unidades', label: `Unidades (${units.length})`, icon: <Layers className="w-3.5 h-3.5" /> },
              { id: 'semanas', label: `Semanas (${weeks.length})`, icon: <Calendar className="w-3.5 h-3.5" /> },
              { id: 'sesiones', label: `Sesiones (${sessions.length})`, icon: <Clock className="w-3.5 h-3.5" /> },
              { id: 'horario', label: `Horario (${schedules.length})`, icon: <MapPin className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#1F5FA8] text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 min-h-[300px]">
            {detailLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 text-[#1F5FA8] animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Cargando información de la sección...</p>
              </div>
            ) : (
              <>
                {/* 1. Información General */}
                {activeTab === 'info' && (
                  <div className="space-y-6">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                      Datos de la Asignatura y Sección
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 block mb-0.5 font-medium">Asignatura</span>
                        <strong className="text-sm text-slate-900 block">{selectedSection.offering.course.name}</strong>
                        <span className="font-mono text-slate-500">{selectedSection.offering.course.code}</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 block mb-0.5 font-medium">Periodo Lectivo</span>
                        <strong className="text-sm text-slate-900 block font-mono">{selectedSection.offering.period.name}</strong>
                        <span className="text-emerald-700 capitalize font-semibold">{selectedSection.offering.period.status}</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 block mb-0.5 font-medium">Sección y Aforo</span>
                        <strong className="text-sm text-[#1F5FA8] block font-mono">Sección {selectedSection.name}</strong>
                        <span className="text-slate-600">
                          {selectedSection.capacity ? `Capacidad: ${selectedSection.capacity} alumnos` : 'Capacidad ilimitada'}
                        </span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 block mb-0.5 font-medium">Créditos Universitarios</span>
                        <strong className="text-sm text-slate-900 block font-mono">{selectedSection.offering.course.credits}</strong>
                        <span className="text-slate-500">Valor académico</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 block mb-0.5 font-medium">Matrículas Activas</span>
                        <strong className="text-sm text-slate-900 block font-mono">{students.length} estudiantes</strong>
                        <span className="text-emerald-700 font-semibold">Alumnos con matrícula activa</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 block mb-0.5 font-medium">Sesiones Registradas</span>
                        <strong className="text-sm text-slate-900 block font-mono">{sessions.length} clases</strong>
                        <span className="text-slate-500">{schedules.length} franja(s) de horario</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Alumnos */}
                {activeTab === 'alumnos' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                        Alumnos Matriculados Activos ({students.length})
                      </h3>
                      <span className="text-xs text-slate-500 font-medium">
                        Solo estudiantes con matrícula activa
                      </span>
                    </div>

                    {students.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No hay alumnos matriculados activos en esta sección.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                            <tr>
                              <th className="px-4 py-3">N°</th>
                              <th className="px-4 py-3">Código</th>
                              <th className="px-4 py-3">Nombres y Apellidos</th>
                              <th className="px-4 py-3">Estado Matrícula</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {students.map((stu, idx) => (
                              <tr key={stu.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="px-4 py-2.5 font-mono font-bold text-[#0B2A5B]">{stu.code}</td>
                                <td className="px-4 py-2.5 font-semibold text-slate-900">
                                  {stu.first_names} {stu.last_names}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Activa
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Unidades */}
                {activeTab === 'unidades' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                      Unidades de Aprendizaje del Curso
                    </h3>
                    {units.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No hay unidades creadas para este curso. Puedes gestionarlas en la pestaña "Unidades y semanas".
                      </div>
                    ) : (
                      <div className="space-y-3 text-xs">
                        {units.map((u) => (
                          <div key={u.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold bg-[#1F5FA8] text-white px-2 py-0.5 rounded text-[11px]">
                                  Unidad {u.number}
                                </span>
                                <h4 className="font-bold text-slate-900 text-sm">{u.name}</h4>
                              </div>
                              <p className="text-slate-600 mt-1 leading-relaxed">{u.description || 'Sin descripción'}</p>
                              <div className="text-slate-400 font-mono text-[11px] mt-2">
                                {formatDisplayDate(u.starts_on)} al {formatDisplayDate(u.ends_on)}
                              </div>
                            </div>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-white text-slate-700">
                              {u.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Semanas */}
                {activeTab === 'semanas' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                      Semanas Académicas Planificadas
                    </h3>
                    {weeks.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No hay semanas registradas para esta oferta. Puedes gestionarlas en "Unidades y semanas".
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {weeks.map((w) => (
                          <div key={w.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#1F5FA8] font-mono">Semana {w.number}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {formatDisplayDate(w.starts_on)} - {formatDisplayDate(w.ends_on)}
                              </span>
                            </div>
                            <h5 className="font-bold text-slate-900">{w.topic || 'Sin tema especificado'}</h5>
                            <p className="text-slate-600 line-clamp-2">{w.content || 'Sin contenido registrado'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Sesiones */}
                {activeTab === 'sesiones' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                      Sesiones de Clase Registradas
                    </h3>
                    {sessions.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No hay sesiones de clase registradas para esta sección.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                            <tr>
                              <th className="px-4 py-3">Fecha</th>
                              <th className="px-4 py-3">Tipo</th>
                              <th className="px-4 py-3">Horario</th>
                              <th className="px-4 py-3">Tema</th>
                              <th className="px-4 py-3">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {sessions.map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                                  {formatDisplayDate(s.session_date)}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                      s.kind === 'practica'
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                                    }`}
                                  >
                                    {s.kind === 'practica' ? 'Práctica' : 'Teoría'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 font-mono text-slate-600">
                                  {formatTime(s.starts_at)} - {formatTime(s.ends_at)}
                                </td>
                                <td className="px-4 py-2.5 font-medium text-slate-800">
                                  {s.topic || 'Sin tema'}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border capitalize bg-slate-100 text-slate-700">
                                    {s.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Horario */}
                {activeTab === 'horario' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                      Horario Semanal de la Sección
                    </h3>
                    {schedules.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        Esta sección no tiene franjas horarias registradas.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {schedules.map((sc) => (
                          <div key={sc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#1F5FA8] text-sm block">
                                {WEEKDAYS[sc.weekday] || `Día ${sc.weekday}`}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                  sc.kind === 'practica'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                                }`}
                              >
                                {sc.kind === 'practica' ? 'Práctica' : 'Teoría'}
                              </span>
                            </div>
                            <div className="font-mono text-slate-800 text-xs font-semibold">
                              {formatTime(sc.starts_at)} - {formatTime(sc.ends_at)}
                            </div>
                            <div className="text-slate-500 flex items-center gap-1 pt-1">
                              <MapPin className="w-3 h-3 text-red-600" />
                              <span>{sc.room || 'Aula por asignar'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
