import React from 'react';
import { LogOut, User as UserIcon, AlertCircle } from 'lucide-react';
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

  const roleBadges: Record<UserRole, { bg: string; text: string }> = {
    administrador: { bg: 'bg-red-50 text-red-700 border-red-200', text: 'ADMINISTRADOR' },
    profesor: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'DOCENTE' },
    alumno: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'ESTUDIANTE' },
  };

  return (
    <header className="sticky top-0 z-40 w-full shadow-xs">

      <div className="h-1 bg-[#C8102E] w-full" />

      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">

          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-white p-0.5 shadow-2xs flex items-center justify-center shrink-0">
              <img
                src="/logo-ucvgo.png"
                alt="Logo de UCVGO"
                className="h-10 w-auto object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-[#0B2A5B]">UCVGO</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Plataforma de asistencia académica con QR
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-5">

            {!configured && (
              <div
                title="Sin conexión con el servicio"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 text-red-700 bg-red-50 border border-red-200 rounded-md font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span className="hidden sm:inline">Sin conexión con el servicio</span>
              </div>
            )}

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

      <nav className="bg-[#1F5FA8] text-white px-4 sm:px-6">
        <div
          className={`max-w-7xl mx-auto flex items-center space-x-1 sm:space-x-2 py-1 ${
            profile?.role === 'administrador'
              ? 'overflow-visible md:overflow-visible'
              : 'overflow-x-auto md:overflow-visible'
          }`}
        >

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

          {profile?.role === 'administrador' && (
            <>

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

              <button
                onClick={() => onSelectTab('cursos')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'cursos'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Cursos
              </button>
            </>
          )}

          {profile?.role === 'profesor' && (
            <>

              <button
                onClick={() => onSelectTab('mis_cursos')}
                className={`px-3.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                  currentTab === 'mis_cursos' || currentTab === 'mis_asignaturas'
                    ? 'bg-[#0B2A5B] text-white shadow-inner font-bold border-b-2 border-[#C8102E]'
                    : 'text-blue-100 hover:bg-[#174B88] hover:text-white'
                }`}
              >
                Mis cursos
              </button>
            </>
          )}

          {profile?.role === 'alumno' && (
            <>

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
