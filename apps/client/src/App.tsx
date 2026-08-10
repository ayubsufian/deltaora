import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { Dashboard } from './pages/Dashboard';
import { MonitoredPages } from './pages/MonitoredPages';
import { PageDetail } from './pages/PageDetail';
import { Search } from './pages/Search';
import { Settings } from './pages/Settings';
import { Notifications } from './pages/Notifications';
import { Statistics } from './pages/Statistics';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { JoinWorkspace } from './pages/JoinWorkspace';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';

function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>
      
      <Route path="/join" element={<JoinWorkspace />} />
      
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pages" element={<MonitoredPages />} />
        <Route path="/pages/:id" element={<PageDetail />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
