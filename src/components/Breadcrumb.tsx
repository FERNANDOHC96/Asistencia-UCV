import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

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
      case 'cursos':
        return { section: null, label: 'Cursos' };
      case 'inhabilitados':
        return { section: null, label: 'Alumnos inhabilitados' };
      case 'reportes':
        return { section: null, label: 'Reportes' };
      case 'mis_cursos':
      case 'mis_asignaturas':
        return { section: null, label: 'Mis Cursos' };
      case 'mi_asistencia':
        return { section: null, label: 'Mi Asistencia' };
      case 'inicio':
      default:
        return { section: null, label: 'Inicio' };
    }
  };

  const currentInfo = getTabLabel(currentTab);

  return (
    <div className="bg-white/90 backdrop-blur-xs border-b border-slate-200/85 py-2.5 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center text-xs font-medium text-slate-600">
        <span className="w-1 h-4 bg-[#0B2A5B] rounded-full inline-block mr-2.5 shrink-0" />

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('inicio')}
            className={`inline-flex items-center gap-1.5 hover:text-[#0B2A5B] transition-colors cursor-pointer rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5FA8]/35 ${
              currentTab === 'inicio' ? 'text-[#0B2A5B] font-semibold' : 'text-slate-500'
            }`}
          >
            <Home className="w-3.5 h-3.5 shrink-0" strokeWidth={1.85} aria-hidden="true" />
            <span>Inicio</span>
          </button>

          {currentInfo.section && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.85} aria-hidden="true" />
              <span className="text-slate-500">{currentInfo.section}</span>
            </>
          )}

          {currentTab !== 'inicio' && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.85} aria-hidden="true" />
              <span className="text-[#0B2A5B] font-semibold">{currentInfo.label}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
