import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, AlertCircle, ChevronDown, Calendar, BookOpen, Layers, UserCheck, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from '../types';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { profile, logout } = useAuth();
  const configured = isSupabaseConfigured();
  const [academicDropdownOpen, setAcademicDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const roleBadges: Record<UserRole, { bg: string; text: string }> = {
    administrador: { bg: 'bg-red-50 text-red-700 border-red-200', text: 'ADMINISTRADOR' },
    profesor: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'DOCENTE' },
    alumno: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'ESTUDIANTE' },
  };

  const academicTabs = [
    { id: 'periodos', label: 'Periodos', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'cursos', label: 'Cursos', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'secciones', label: 'Secciones', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'matriculas', label: 'Matrículas', icon: <UserCheck className="w-3.5 h-3.5" /> },
    { id: 'horarios', label: 'Horarios', icon: <Clock className="w-3.5 h-3.5" /> },
  ];

  const isAcademicActive = academicTabs.some((t) => t.id === currentTab);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAcademicDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAcademicDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full shadow-xs">
      {/* Top red institutional accent line */}
      <div className="h-1 bg-[#C8102E] w-full" />

      {/* Top compact bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Project Info */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#0B2A5B] flex items-center justify-center text-white shadow-xs">
              <span className="font-black text-lg tracking-wider">QR</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-[#0B2A5B]">AsisQR UCV</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Plataforma de asistencia académica con QR
              </p>
            </div>
          </div>

          {/* Right utilities & User profile */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Aviso solo si la conexión falla */}
            {!configured && (
              <div
                title="Sin conexión con el servicio"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 text-red-700 bg-red-50 border border-red-200 rounded-md font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span className="hidden sm:inline">Sin conexión con el servicio</span>
              </div>
            )}

            {/* User identification */}
            {profile && (
              <div className="flex items-center pl-3 border-l border-slate-200 space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 tracking-tight leading-none uppercase">
                    {profile.first_names} {profile.last_names}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-1">
                    <span className="text-[11px] font-mono text-slate-500">
                      Cód: {profile.code}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                        roleBadges[profile.role]?.bg || 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {roleBadges[profile.role]?.text || profile.role}
                    </span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-[#EEF2F7] border border-blue-200 flex items-center justify-center text-[#1F5FA8] shrink-0 font-bold text-xs shadow-2xs">
                  {profile.first_names ? profile.first_names.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                </div>

                <button
                  onClick={() => logout()}
                  title="Cerrar sesión"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main horizontal blue navigation bar */}
      <nav className="bg-[#1F5FA8] text-white px-4 sm:px-6">
        <div
          className={`max-w-7xl mx-auto flex items-center space-x-1 sm:space-x-2 py-1 ${
            profile?.role === 'administrador'
              ? 'overflow-visible md:overflow-visible'
              : 'overflow-x-auto md:overflow-visible'
          }`}
        >
          {/* Inicio */}
          <button
            onClick={() => onSelectTab('inicio')}
            className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
              currentTab === 'inicio'
                ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
            }`}
          >
            Inicio
          </button>

          {/* Navegación del Administrador */}
          {profile?.role === 'administrador' && (
            <>
              {/* Alumnos */}
              <button
                onClick={() => onSelectTab('alumnos')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'alumnos'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Alumnos
              </button>

              {/* Profesores */}
              <button
                onClick={() => onSelectTab('profesores')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'profesores'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Profesores
              </button>

              {/* Menú Desplegable Académico */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  aria-expanded={academicDropdownOpen}
                  aria-haspopup="true"
                  onClick={() => setAcademicDropdownOpen(!academicDropdownOpen)}
                  className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    isAcademicActive
                      ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                      : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                  }`}
                >
                  <span>Académico</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${academicDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {academicDropdownOpen && (
                  <div className="absolute right-0 sm:right-auto sm:left-0 mt-1.5 w-48 sm:w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100">
                      Estructura Académica
                    </div>
                    {academicTabs.map((item) => {
                      const active = currentTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onSelectTab(item.id);
                            setAcademicDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                            active
                              ? 'bg-blue-50 text-[#1F5FA8] font-bold'
                              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <span className={active ? 'text-[#1F5FA8]' : 'text-slate-400'}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Navegación del Docente */}
          {profile?.role === 'profesor' && (
            <>
              {/* Mis asignaturas */}
              <button
                onClick={() => onSelectTab('mis_asignaturas')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'mis_asignaturas'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Mis asignaturas
              </button>

              {/* Unidades y semanas */}
              <button
                onClick={() => onSelectTab('unidades_semanas')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'unidades_semanas'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Unidades y semanas
              </button>

              {/* Sesiones de clase */}
              <button
                onClick={() => onSelectTab('sesiones')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'sesiones'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Sesiones de clase
              </button>

              {/* Asistencia Manual */}
              <button
                onClick={() => onSelectTab('asistencia')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'asistencia'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Asistencia Manual
              </button>

              {/* Asistencia QR (NUEVO) */}
              <button
                onClick={() => onSelectTab('asistencia_qr')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  currentTab === 'asistencia_qr'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                <span>Asistencia QR</span>
              </button>

              {/* Horarios */}
              <button
                onClick={() => onSelectTab('horarios')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'horarios'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Horarios
              </button>
            </>
          )}

          {/* Navegación del Alumno */}
          {profile?.role === 'alumno' && (
            <>
              {/* Mis asignaturas */}
              <button
                onClick={() => onSelectTab('mis_asignaturas')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'mis_asignaturas'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Mis asignaturas
              </button>

              {/* Mi asistencia */}
              <button
                onClick={() => onSelectTab('mi_asistencia')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'mi_asistencia'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Mi asistencia
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};
