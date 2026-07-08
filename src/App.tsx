import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';

import { AppLayout } from './layouts/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MutasiBank from './pages/MutasiBank';
import RekapTahunan from './pages/RekapTahunan';
import Sampah from './pages/Sampah';
import ImportTransaksi from './pages/ImportTransaksi';

import "./App.css"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<Dashboard />} />
            <Route path='/mutasi' element={<MutasiBank />} />
            <Route path='/rekap' element={<RekapTahunan />} />
            <Route path='/sampah' element={<Sampah />} />
            <Route path='/import' element={<ImportTransaksi />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}