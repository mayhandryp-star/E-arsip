import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Archive, CircleNotch } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      login(data);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAFA]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Left brand panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-[#171717] p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-white text-[#171717]">
            <Archive size={20} weight="fill" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Arsip Digital</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Kelola arsip Anda
            <br />
            dengan rapi & aman.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-400">
            Sistem manajemen kearsipan digital untuk menyimpan, mencari, dan mengelola dokumen PDF secara terpusat.
          </p>
        </div>
        <div className="font-mono text-xs text-neutral-500">© {new Date().getFullYear()} Arsip Digital</div>
      </div>

      {/* Right form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-sm bg-[#171717] text-white">
              <Archive size={22} weight="fill" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Masuk ke akun
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">Silakan masukkan kredensial Anda.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
                Username
              </Label>
              <Input
                id="username"
                data-testid="login-username-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="rounded-sm border-neutral-300 focus:border-neutral-900 focus-visible:ring-1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="rounded-sm border-neutral-300 focus:border-neutral-900 focus-visible:ring-1"
                required
              />
            </div>

            {error && (
              <div data-testid="login-error" className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#262626] disabled:opacity-60"
            >
              {loading && <CircleNotch size={16} className="animate-spin" />}
              Masuk
            </button>
          </form>

          <p className="mt-6 text-xs text-neutral-400">
            Akun default: <span className="font-mono text-neutral-600">admin / admin</span>
          </p>
        </div>
      </div>
    </div>
  );
}
