import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Breadcrumb } from './components/Breadcrumb';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminUsersList } from './components/AdminUsersList';
import { PeriodsScreen } from './components/academic/PeriodsScreen';
import { CoursesScreen } from './components/academic/CoursesScreen';
import { SectionsScreen } from './components/academic/SectionsScreen';
import { EnrollmentsScreen } from './components/academic/EnrollmentsScreen';
import { SchedulesScreen } from './components/academic/SchedulesScreen';
import { TeacherHome } from './components/teacher/TeacherHome';
import { TeacherCoursesScreen } from './components/teacher/TeacherCoursesScreen';
import { TeacherUnitsWeeksScreen } from './components/teacher/TeacherUnitsWeeksScreen';
import { TeacherSessionsScreen } from './components/teacher/TeacherSessionsScreen';
import { TeacherAttendanceScreen } from './components/teacher/TeacherAttendanceScreen';
import { TeacherQrAttendanceScreen } from './components/teacher/TeacherQrAttendanceScreen';
import { TeacherSchedulesScreen } from './components/teacher/TeacherSchedulesScreen';
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
          <div className="w-12 h-12 rounded-xl bg-[#0B2A5B] text-white flex items-center justify-center mx-auto mb-4 font-black text-xl">
            QR
          </div>
          <Loader2 className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">Cargando AsisQR UCV</h2>
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
        case 'periodos':
          return <PeriodsScreen />;
        case 'cursos':
          return <CoursesScreen />;
        case 'secciones':
          return <SectionsScreen />;
        case 'matriculas':
          return <EnrollmentsScreen />;
        case 'horarios':
          return <SchedulesScreen />;
        case 'inicio':
        default:
          return <AdminDashboard onNavigate={setCurrentTab} />;
      }
    }

    if (profile.role === 'profesor') {
      switch (currentTab) {
        case 'mis_asignaturas':
          return <TeacherCoursesScreen />;
        case 'unidades_semanas':
          return <TeacherUnitsWeeksScreen />;
        case 'sesiones':
          return <TeacherSessionsScreen />;
        case 'asistencia':
          return <TeacherAttendanceScreen />;
        case 'asistencia_qr':
          return <TeacherQrAttendanceScreen />;
        case 'horarios':
          return <TeacherSchedulesScreen />;
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-6 text-center text-[11px] text-slate-500">
        AsisQR UCV · Proyecto universitario, no oficial
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
