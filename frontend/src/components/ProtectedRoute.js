import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { CircleNotch } from "@phosphor-icons/react";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();

  if (user === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAFAFA]">
        <CircleNotch size={28} className="animate-spin text-neutral-400" />
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}
