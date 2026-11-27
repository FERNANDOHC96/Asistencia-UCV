import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Breadcrumb } from './components/Breadcrumb';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminUsersList } from './components/AdminUsersList';
import { CoursesScreen } from './components/academic/CoursesScreen';
import { AdminBlockedStudentsScreen } from './components/academic/AdminBlockedStudentsScreen';
import { TeacherHome } from './components/teacher/TeacherHome';
import { TeacherCoursesScreen } from './components/teacher/TeacherCoursesScreen';
import { StudentHome } from './components/student/StudentHome';
import { StudentCoursesScreen } from './components/student/StudentCoursesScreen';
import { StudentAttendanceScreen } from './components/student/StudentAttendanceScreen';
import { StudentTeacherDashboard } from './components/StudentTeacherDashboard';
import { AttendanceReportScreen } from './components/reports/AttendanceReportScreen';
import { NotificationsProvider } from './context/NotificationsContext';
import { TeacherRiskAlertModal } from './components/teacher/TeacherRiskAlertModal';
import { NotificationDetailModal } from './components/NotificationDetailModal';
import { Loader2 } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('inicio');
  const [targetAttendanceRequest, setTargetAttendanceRequest] = useState<{
    refId: string;
    key: number;
  } | null>(null);

  const handleSelectTab = (tab: string, targetRefId?: string) => {
    setCurrentTab(tab);
    setTargetAttendanceRequest(
      targetRefId ? { refId: targetRefId, key: Date.now() } : null
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen ucv-canvas-bg flex flex-col items-center justify-center p-4">
        <div className="ucv-card ucv-scale-in rounded-2xl overflow-hidden text-center max-w-sm w-full">
          <div className="h-1.5 ucv-topbar-split w-full" />
          <div className="p-8">
            <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
              <img src="/logo-ucvgo.png" alt="Logo de UCVGO" className="h-11 w-auto object-contain" />
            </div>
            <Loader2 className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-3" />
            <h2 className="text-base font-bold text-[#0B2A5B]">Cargando UCVGO</h2>
            <p className="text-xs text-slate-500 mt-1">Verificando sesión institucional...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginScreen />;
  }

  const renderTabContent = () => {
    if (profile.role === 'administrador') {
      switch (currentTab) {
        case 'alumnos':
          return <AdminUsersList role="alumno" />;
        case 'profesores':
          return <AdminUsersList role="profesor" />;
        case 'cursos':
          return <CoursesScreen />;
        case 'inhabilitados':
          return <AdminBlockedStudentsScreen />;
        case 'reportes':
          return <AttendanceReportScreen />;
        case 'inicio':
        default:
          return <AdminDashboard onNavigate={handleSelectTab} />;
      }
    }

    if (profile.role === 'profesor') {
      switch (currentTab) {
        case 'mis_cursos':
        case 'mis_asignaturas':
          return <TeacherCoursesScreen />;
        case 'reportes':
          return <AttendanceReportScreen />;
        case 'inicio':
        default:
          return <TeacherHome onNavigate={handleSelectTab} />;
      }
    }

    if (profile.role === 'alumno') {
      switch (currentTab) {
        case 'mis_asignaturas':
          return <StudentCoursesScreen />;
        case 'mi_asistencia':
          return <StudentAttendanceScreen targetSectionOrCourseRequest={targetAttendanceRequest} />;
        case 'inicio':
        default:
          return <StudentHome onNavigate={handleSelectTab} />;
      }
    }

    return <StudentTeacherDashboard />;
  };

  return (
    <div className="min-h-screen flex flex-col ucv-canvas-bg">
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
      />

      {currentTab !== 'inicio' && (
        <div className="no-print">
          <Breadcrumb
            currentTab={currentTab}
            onNavigate={handleSelectTab}
          />
        </div>
      )}

      <main className="flex-1 pb-10">
        {renderTabContent()}
      </main>

      <footer className="no-print py-4 text-center text-xs border-t border-slate-200/80 bg-white/85 backdrop-blur-xs text-slate-500">
        <span className="font-bold tracking-[-0.025em] text-[#0B2A5B]">UCV</span>
        <span className="font-bold tracking-[-0.025em] text-[#C8102E]">GO</span>
      </footer>

      {profile.role === 'profesor' && (
        <TeacherRiskAlertModal onNavigate={handleSelectTab} />
      )}
      <NotificationDetailModal onNavigate={handleSelectTab} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <MainContent />
      </NotificationsProvider>
    </AuthProvider>
  );
}
