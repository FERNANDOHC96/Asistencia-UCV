import React from 'react';
import {
  LogOut,
  User as UserIcon,
  AlertCircle,
  Home,
  Users,
  GraduationCap,
  BookOpen,
  ShieldBan,
  FileBarChart2,
  CalendarCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from '../types';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string, targetRefId?: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { profile, logout } = useAuth();
  const configured = isSupabaseConfigured();

  const roleLabels: Record<UserRole, string> = {
    administrador: 'Administrador',
    profesor: 'Docente',
    alumno: 'Estudiante',
  };

  const navTabClass = (isActive: boolean) =>
    `inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] tracking-[-0.01em] transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
      isActive
        ? 'bg-white text-[#0B2A5B] shadow-[0_2px_8px_rgba(0,0,0,0.18)] font-semibold'
        : 'text-white/85 hover:bg-white/12 hover:text-white font-medium'
    }`;

  const userInitials = `${profile?.first_names?.charAt(0) || ''}${profile?.last_names?.charAt(0) || ''}`
    .trim()
    .toUpperCase();

  const renderNavItems = () => (
    <>
      <button
        type="button"
        onClick={() => onSelectTab('inicio')}
        className={navTabClass(currentTab === 'inicio')}
      >
        <Home className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>Inicio</span>
      </button>

      {profile?.role === 'administrador' && (
        <>
          <button
            type="button"
            onClick={() => onSelectTab('alumnos')}
            className={navTabClass(currentTab === 'alumnos')}
          >
            <Users className="w-4 h-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span>Alumnos</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('profesores')}
            className={navTabClass(currentTab === 'profesores')}
          >
            <GraduationCap className="w-4 h-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span>Profesores</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('cursos')}
            className={navTabClass(currentTab === 'cursos')}
          >
            <BookOpen className="w-4 h-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span>Cursos</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('inhabilitados')}
            className={navTabClass(currentTab === 'inhabilitados')}
          >
            <ShieldBan className="w-4 h-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span>Inhabilitados</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('reportes')}
            className={navTabClass(currentTab === 'reportes')}
          >
            <FileBarChart2 className="w-4 h-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span>Reportes</span>
          </button>
        </>
      )}

      {profile?.role === 'profesor' && (
        <>
          <button
            type="button"
            onClick={() => onSelectTab('mis_cursos')}
            className={navTabClass(currentTab === 'mis_cursos' || currentTab === 'mis_asignaturas')}
          >
            <BookOpen className="w-4 h-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span>Mis cursos</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('reportes')}
            className={navTabClass(currentTab === 'reportes')}
          >
            <FileBarChart2 className="w-4 h-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span>Reportes</span>
          </button>
        </>
      )}

      {profile?.role === 'alumno' && (
        <>
          <button
            type="button"
            onClick={() => onSelectTab('mis_asignaturas')}
            className={navTabClass(currentTab === 'mis_asignaturas')}
          >
            <BookOpen className="w-4 h-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span>Mis asignaturas</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('mi_asistencia')}
            className={navTabClass(currentTab === 'mi_asistencia')}
          >
            <CalendarCheck className="w-4 h-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span>Mi asistencia</span>
          </button>
        </>
      )}
    </>
  );

  return (
    <header className="no-print sticky top-0 z-40 w-full relative bg-gradient-to-r from-[#071C40] via-[#0B2A5B] to-[#123A7A] text-white shadow-[0_6px_22px_-8px_rgba(7,28,64,0.55)] border-b border-white/10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-6 right-[21%] w-16 h-32 bg-[#1F5FA8]/55 rotate-[28deg]" />
        <div className="absolute -top-6 right-[18.5%] w-8 h-32 bg-[#C8102E]/85 rotate-[28deg]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-white p-1 shadow-xs flex items-center justify-center shrink-0">
              <img
                src="/logo-ucvgo.png"
                alt="Logo de UCVGO"
                className="h-full w-auto object-contain"
              />
            </div>

            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg font-bold tracking-[-0.025em] text-white whitespace-nowrap">
                UCV<span className="text-[#F02E47]">GO</span>
              </span>
              <span className="hidden xl:inline-block h-4 w-px bg-white/25" aria-hidden="true" />
              <p className="hidden xl:block text-[12px] text-white/75 font-medium whitespace-nowrap">
                Plataforma de asistencia académica con QR
              </p>
            </div>
          </div>

          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-full"
          >
            {renderNavItems()}
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {profile && <NotificationBell onNavigate={onSelectTab} surface="dark" />}

            {!configured && (
              <div
                title="Sin conexión con el servicio"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 text-red-100 bg-[#C8102E]/40 border border-red-300/40 rounded-lg font-medium"
              >
                <AlertCircle className="w-4 h-4 text-red-200" strokeWidth={1.85} />
                <span className="hidden sm:inline">Sin conexión</span>
              </div>
            )}

            {profile && (
              <div className="flex items-center pl-2.5 sm:pl-3 border-l border-white/15 gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/95 text-[#0B2A5B] border border-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs">
                  {userInitials || <UserIcon className="w-4 h-4" strokeWidth={1.9} />}
                </div>

                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-semibold text-white tracking-[-0.01em] uppercase max-w-[155px] truncate">
                    {profile.first_names} {profile.last_names}
                  </div>
                  <div className="text-[10px] font-medium text-white/70 mt-0.5 whitespace-nowrap">
                    {roleLabels[profile.role] || profile.role} · {profile.code}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => logout()}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  className="w-9 h-9 rounded-xl bg-[#C8102E] hover:bg-[#DF1938] text-white border border-white/15 flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-[0.97] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <LogOut className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        <nav
          aria-label="Navegación móvil"
          className="md:hidden flex items-center gap-1.5 pb-2.5 pt-0.5 overflow-x-auto"
        >
          {renderNavItems()}
        </nav>
      </div>
    </header>
  );
};
