import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import TambahArsip from "@/pages/TambahArsip";
import CariArsip from "@/pages/CariArsip";
import HapusArsip from "@/pages/HapusArsip";
import Pengaturan from "@/pages/Pengaturan";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/tambah" element={<ProtectedRoute><TambahArsip /></ProtectedRoute>} />
          <Route path="/cari" element={<ProtectedRoute><CariArsip /></ProtectedRoute>} />
          <Route path="/hapus" element={<ProtectedRoute adminOnly><HapusArsip /></ProtectedRoute>} />
          <Route path="/pengaturan" element={<ProtectedRoute adminOnly><Pengaturan /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
