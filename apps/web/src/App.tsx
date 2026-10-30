import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';

const UserLoginPage = lazy(() => import('./pages/UserLoginPage').then(m => ({ default: m.UserLoginPage })));
const PreJoinPage = lazy(() => import('./pages/PreJoinPage').then(m => ({ default: m.PreJoinPage })));
const MeetingPage = lazy(() => import('./pages/MeetingPage').then(m => ({ default: m.MeetingPage })));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));

export function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<main className="loading-page"><span className="route-loader"/><p>Opening StudyRoom…</p></main>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<UserLoginPage />} />
          <Route path="/room/:roomId" element={<PreJoinPage />} />
          <Route path="/room/:roomId/live" element={<MeetingPage />} />
          <Route path="/admin" element={<Navigate to="/admin/rooms" replace />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/rooms" element={<AdminDashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
