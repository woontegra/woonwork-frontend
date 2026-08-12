import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TasksPage } from './pages/TasksPage';
import { CalendarPage } from './pages/CalendarPage';
import { PagesPage } from './pages/PagesPage';
import { PageDetailPage } from './pages/PageDetailPage';
import { MediaPage } from './pages/MediaPage';
import { DatabasesPage } from './pages/DatabasesPage';
import { DatabaseDetailPage } from './pages/DatabaseDetailPage';
import { SocialLayout } from './pages/social/SocialLayout';
import { SocialHubPage } from './pages/social/SocialHubPage';
import { SocialContentsPage } from './pages/social/SocialContentsPage';
import { SocialCalendarPage } from './pages/social/SocialCalendarPage';
import { SocialBrandsPage } from './pages/social/SocialBrandsPage';
import { SocialAccountsPage } from './pages/social/SocialAccountsPage';
import { SocialHashtagsPage } from './pages/social/SocialHashtagsPage';
import { TeamPage } from './pages/TeamPage';
import { SettingsPage } from './pages/SettingsPage';
import { LibraryPage } from './pages/LibraryPage';
import { AreaDetailPage } from './pages/AreaDetailPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

export default function App() {
  return (
    <Routes>
      <Route path="/giris" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="kutuphane" element={<LibraryPage />} />
        <Route path="alanlar/:id" element={<AreaDetailPage />} />
        <Route path="projeler" element={<ProjectsPage />} />
        <Route path="projeler/:id" element={<ProjectDetailPage />} />
        <Route path="gorevler" element={<TasksPage />} />
        <Route path="takvim" element={<CalendarPage />} />
        <Route path="notlar" element={<PagesPage />} />
        <Route path="notlar/:id" element={<PageDetailPage />} />
        <Route path="tablolar" element={<DatabasesPage />} />
        <Route path="tablolar/:id" element={<DatabaseDetailPage />} />
        <Route path="medya" element={<MediaPage />} />
        <Route path="sosyal-medya" element={<SocialLayout />}>
          <Route index element={<SocialHubPage />} />
          <Route path="icerikler" element={<SocialContentsPage />} />
          <Route path="takvim" element={<SocialCalendarPage />} />
          <Route path="markalar" element={<SocialBrandsPage />} />
          <Route path="hesaplar" element={<SocialAccountsPage />} />
          <Route path="hashtagler" element={<SocialHashtagsPage />} />
        </Route>
        <Route path="ekip" element={<TeamPage />} />
        <Route path="ayarlar" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
