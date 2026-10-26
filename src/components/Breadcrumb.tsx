import React from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbProps {
  currentTab: string;
  onNavigate?: (tab: string) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ currentTab, onNavigate }) => {
  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'alumnos':
        return { section: null, label: 'Alumnos' };
      case 'profesores':
        return { section: null, label: 'Profesores' };
      case 'periodos':
        return { section: 'Académico', label: 'Periodos' };
      case 'cursos':
        return { section: 'Académico', label: 'Cursos' };
      case 'secciones':
        return { section: 'Académico', label: 'Secciones' };
      case 'matriculas':
        return { section: 'Académico', label: 'Matrículas' };
      case 'horarios':
        return { section: 'Académico', label: 'Horarios' };
      case 'mis_asignaturas':
        return { section: 'Docente', label: 'Mis Asignaturas' };
      case 'unidades_semanas':
        return { section: 'Docente', label: 'Unidades y Semanas' };
      case 'sesiones':
        return { section: 'Docente', label: 'Sesiones de Clase' };
      case 'asistencia':
        return { section: 'Docente', label: 'Asistencia Manual' };
      case 'asistencia_qr':
        return { section: 'Docente', label: 'Asistencia QR' };
      case 'mi_asistencia':
        return { section: 'Estudiante', label: 'Mi Historial de Asistencia' };
      case 'inicio':
      default:
        return { section: null, label: 'Inicio' };
    }
  };

  const currentInfo = getTabLabel(currentTab);

  return (
    <div className="bg-white border-b border-slate-200 py-2.5 px-4 sm:px-6 shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center text-xs font-semibold text-slate-700">
        {/* Red accent indicator bar */}
        <span className="w-1.5 h-4 bg-[#C8102E] rounded-full inline-block mr-2.5 shrink-0" />

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onNavigate && onNavigate('inicio')}
            className={`hover:text-[#1F5FA8] transition-colors cursor-pointer ${
              currentTab === 'inicio' ? 'text-slate-900 font-bold' : 'text-slate-500'
            }`}
          >
            Inicio
          </button>

          {currentInfo.section && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">{currentInfo.section}</span>
            </>
          )}

          {currentTab !== 'inicio' && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-900 font-bold">{currentInfo.label}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
