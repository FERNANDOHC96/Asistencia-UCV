import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Calendar,
  Layers,
  MapPin,
  RefreshCw,
  AlertCircle,
  Filter,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTeacherSections, TeacherSection } from '../../services/teacherService';
import { getSupabaseClient } from '../../lib/supabase';
import { Schedule } from '../../types';
import { translateSupabaseError } from '../../lib/supabaseErrors';

interface ScheduleWithDetails extends Schedule {
  section?: TeacherSection;
}

const WEEKDAYS = [
  { id: 1, name: 'Lunes', short: 'LUN' },
  { id: 2, name: 'Martes', short: 'MAR' },
  { id: 3, name: 'Miércoles', short: 'MIÉ' },
  { id: 4, name: 'Jueves', short: 'JUE' },
  { id: 5, name: 'Viernes', short: 'VIE' },
  { id: 6, name: 'Sábado', short: 'SÁB' },
  { id: 7, name: 'Domingo', short: 'DOM' },
];

export const TeacherSchedulesScreen: React.FC = () => {
  const { user } = useAuth();
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Obtener secciones asignadas al profesor
      const teacherSecs = await getTeacherSections(user.id);
      setSections(teacherSecs);

      if (teacherSecs.length === 0) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      const sectionIds = teacherSecs.map((s) => s.id);
      const sectionMap: Record<string, TeacherSection> = {};
      teacherSecs.forEach((s) => {
        sectionMap[s.id] = s;
      });

      // 2. Consultar horarios correspondientes a esas secciones
      const supabase = getSupabaseClient();
      const { data: schedData, error: schedErr } = await supabase
        .from('schedules')
        .select('id, section_id, weekday, starts_at, ends_at, room, kind')
        .in('section_id', sectionIds)
        .is('archived_at', null)
        .order('weekday', { ascending: true })
        .order('starts_at', { ascending: true });

      if (schedErr) throw schedErr;

      const detailedSchedules: ScheduleWithDetails[] = (schedData || []).map((sch) => ({
        ...sch,
        section: sectionMap[sch.section_id],
      }));

      setSchedules(detailedSchedules);
    } catch (err: any) {
      setError(translateSupabaseError(err, 'schedules'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrado de horarios
  const filteredSchedules = schedules.filter((s) => {
    if (selectedSectionFilter !== 'all' && s.section_id !== selectedSectionFilter) {
      return false;
    }
    if (selectedDayFilter !== 'all' && s.weekday !== selectedDayFilter) {
      return false;
    }
    return true;
  });

  // Agrupación por día de la semana
  const schedulesByDay: Record<number, ScheduleWithDetails[]> = {
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [],
  };

  filteredSchedules.forEach((sch) => {
    if (schedulesByDay[sch.weekday]) {
      schedulesByDay[sch.weekday].push(sch);
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0B2A5B]">Mis Horarios de Clase</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-50 text-[#1F5FA8] border border-blue-200">
              Solo Lectura
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualización semanal de turnos, aulas y asignaturas correspondientes a sus secciones asignadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle View Mode */}
          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1 rounded-md transition-colors ${
                viewMode === 'grouped' ? 'bg-white text-[#1F5FA8] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Día
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white text-[#1F5FA8] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lista Completa
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            title="Recargar horarios"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-800">Error al consultar horarios</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mr-2">
          <Filter className="w-4 h-4 text-[#1F5FA8]" />
          <span>Filtros:</span>
        </div>

        {/* Section filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Asignatura:</span>
          <select
            value={selectedSectionFilter}
            onChange={(e) => setSelectedSectionFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
          >
            <option value="all">Todas las secciones ({sections.length})</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.offering.course.code} - Sec. {sec.name} ({sec.offering.course.name})
              </option>
            ))}
          </select>
        </div>

        {/* Day filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Día:</span>
          <select
            value={selectedDayFilter}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedDayFilter(val === 'all' ? 'all' : parseInt(val, 10));
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
          >
            <option value="all">Todos los días</option>
            {WEEKDAYS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-xs text-slate-500 font-medium">
          Mostrando <strong className="text-slate-800">{filteredSchedules.length}</strong> turno(s)
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-2xs">
          <RefreshCw className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">Cargando horarios asignados...</p>
          <p className="text-[11px] text-slate-400 mt-1">Consultando registros en Supabase</p>
        </div>
      ) : sections.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-[#1F5FA8] flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No tiene asignaturas asignadas</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            El administrador aún no le ha asignado secciones en ningún periodo lectivo. Una vez asignado, sus horarios se mostrarán aquí automáticamente.
          </p>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No se encontraron turnos con el filtro seleccionado</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No hay horarios registrados para los criterios indicados o el administrador todavía no ha programado turnos para sus secciones.
          </p>
          {(selectedSectionFilter !== 'all' || selectedDayFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedSectionFilter('all');
                setSelectedDayFilter('all');
              }}
              className="mt-4 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-[#1F5FA8] hover:bg-blue-100 transition-colors"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      ) : viewMode === 'grouped' ? (
        /* Vista agrupada por día de la semana */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WEEKDAYS.map((day) => {
            const daySchedules = schedulesByDay[day.id] || [];
            if (selectedDayFilter !== 'all' && selectedDayFilter !== day.id) return null;
            if (daySchedules.length === 0 && selectedDayFilter === 'all') return null;

            return (
              <div
                key={day.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col"
              >
                {/* Header del día */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#1F5FA8]" />
                    <span className="font-bold text-xs text-slate-800">{day.name}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1F5FA8] border border-blue-200">
                    {daySchedules.length} turno(s)
                  </span>
                </div>

                {/* Lista de turnos del día */}
                <div className="p-3 divide-y divide-slate-100 space-y-3">
                  {daySchedules.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2 text-center">Sin turnos este día</p>
                  ) : (
                    daySchedules.map((sch) => (
                      <div key={sch.id} className="pt-2 first:pt-0">
                        {/* Time & Room */}
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-[#1F5FA8] bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-[#1F5FA8]" />
                            {sch.starts_at?.slice(0, 5)} - {sch.ends_at?.slice(0, 5)}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              sch.kind === 'practica'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                            }`}
                          >
                            {sch.kind === 'practica' ? 'Práctica' : 'Teoría'}
                          </span>
                        </div>

                        {/* Course & Section */}
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-[#0B2A5B] truncate">
                              {sch.section?.offering.course.name || 'Curso'}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-700 shrink-0">
                              Sec. {sch.section?.name}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-medium">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-red-500" />
                              {sch.room || 'Sin aula'}
                            </span>
                            <span>{sch.section?.offering.period.name}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista de tabla lista completa */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                  <th className="py-3 px-4">Día</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Horario</th>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Asignatura</th>
                  <th className="py-3 px-4 text-center">Sección</th>
                  <th className="py-3 px-4">Aula</th>
                  <th className="py-3 px-4">Periodo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredSchedules.map((sch) => {
                  const dayName = WEEKDAYS.find((w) => w.id === sch.weekday)?.name || `Día ${sch.weekday}`;
                  const isPractica = sch.kind === 'practica';
                  return (
                    <tr key={sch.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {dayName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            isPractica
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-[#1F5FA8] border-blue-200'
                          }`}
                        >
                          {isPractica ? 'Práctica' : 'Teoría'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#1F5FA8]">
                        {sch.starts_at?.slice(0, 5)} - {sch.ends_at?.slice(0, 5)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 font-medium">
                        {sch.section?.offering.course.code || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {sch.section?.offering.course.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800">
                          {sch.section?.name || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-500" />
                          {sch.room || 'Sin aula'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {sch.section?.offering.period.name || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Institutional footer note */}
      <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex items-start gap-3 text-xs text-slate-600">
        <CheckCircle2 className="w-4 h-4 text-[#1F5FA8] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-[#0B2A5B]">Información para la programación de sesiones:</span>{' '}
          Los horarios mostrados son fijados por la administración académica. Recuerde programar sus sesiones de clase en el módulo correspondiente respetando estos turnos horarios.
        </div>
      </div>
    </div>
  );
};
