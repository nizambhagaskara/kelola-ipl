import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MutasiBank from './pages/MutasiBank';
import RekapTahunan from './pages/RekapTahunan';
import Sampah from './pages/Sampah';

import "./App.css"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path='/mutasi' element={
            <ProtectedRoute>
              <MutasiBank />
            </ProtectedRoute>
          } />
          <Route path='/rekap' element={
            <ProtectedRoute>
              <RekapTahunan />
            </ProtectedRoute>
          } />
          <Route path='/sampah' element={
            <ProtectedRoute>
              <Sampah />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}