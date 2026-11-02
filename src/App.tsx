import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Breadcrumb } from './components/Breadcrumb';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminUsersList } from './components/AdminUsersList';
import { CoursesScreen } from './components/academic/CoursesScreen';
import { TeacherHome } from './components/teacher/TeacherHome';
import { TeacherCoursesScreen } from './components/teacher/TeacherCoursesScreen';
import { StudentHome } from './components/student/StudentHome';
import { StudentCoursesScreen } from './components/student/StudentCoursesScreen';
import { StudentAttendanceScreen } from './components/student/StudentAttendanceScreen';
import { StudentTeacherDashboard } from './components/StudentTeacherDashboard';
import { Loader2 } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('inicio');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEF2F7] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 text-center max-w-sm w-full">
          <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-xs flex items-center justify-center mx-auto mb-4">
            <img src="/logo-ucvgo.png" alt="Logo de UCVGO" className="h-11 w-auto object-contain" />
          </div>
          <Loader2 className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">Cargando UCVGO</h2>
          <p className="text-xs text-slate-500 mt-1">Verificando sesión institucional...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado o no se tiene perfil válido activo
  if (!user || !profile) {
    return <LoginScreen />;
  }

  // Renderizar vistas según el rol del perfil
  const renderTabContent = () => {
    if (profile.role === 'administrador') {
      switch (currentTab) {
        case 'alumnos':
          return <AdminUsersList role="alumno" />;
        case 'profesores':
          return <AdminUsersList role="profesor" />;
        case 'cursos':
          return <CoursesScreen />;
        case 'inicio':
        default:
          return <AdminDashboard onNavigate={setCurrentTab} />;
      }
    }

    if (profile.role === 'profesor') {
      switch (currentTab) {
        case 'mis_cursos':
        case 'mis_asignaturas':
          return <TeacherCoursesScreen />;
        case 'inicio':
        default:
          return <TeacherHome onNavigate={setCurrentTab} />;
      }
    }

    if (profile.role === 'alumno') {
      switch (currentTab) {
        case 'mis_asignaturas':
          return <StudentCoursesScreen />;
        case 'mi_asistencia':
          return <StudentAttendanceScreen />;
        case 'inicio':
        default:
          return <StudentHome onNavigate={setCurrentTab} />;
      }
    }

    return <StudentTeacherDashboard />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF2F7]">
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
      />

      <Breadcrumb
        currentTab={currentTab}
        onNavigate={(tab) => setCurrentTab(tab)}
      />

      <main className="flex-1 pb-10">
        {renderTabContent()}
      </main>

      {/* Pie de página */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200/60 bg-white/40">
        UCVGO
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
