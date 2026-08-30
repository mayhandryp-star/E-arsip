import { useState } from "react";
import Layout, { PageHeader } from "@/components/Layout";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleNotch, Lock } from "@phosphor-icons/react";

const labelCls = "text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500";
const inputCls = "rounded-sm border-neutral-300 focus:border-neutral-900 focus-visible:ring-1";

export default function Profil() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success("Password berhasil diubah");
      setForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <PageHeader title="Profil" subtitle="Informasi akun dan pengaturan keamanan." />

        <div className="grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="rounded-sm border border-neutral-200 bg-white p-6 lg:col-span-2" data-testid="profile-info">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-[#171717] text-lg font-bold uppercase text-white">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div>
                <div className="text-lg font-medium" style={{ fontFamily: "'Manrope', sans-serif" }}>{user?.name}</div>
                <div className="font-mono text-xs text-neutral-400">@{user?.username}</div>
              </div>
            </div>
            <div className="mt-5 space-y-3 border-t border-neutral-200 pt-5 text-sm">
              <div className="flex justify-between"><span className="text-neutral-500">Username</span><span className="font-mono">{user?.username}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Peran</span><span className="uppercase">{user?.role}</span></div>
            </div>
          </div>

          <form onSubmit={submit} className="rounded-sm border border-neutral-200 bg-white p-6 lg:col-span-3" data-testid="change-password-form">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-medium" style={{ fontFamily: "'Manrope', sans-serif" }}>
              <Lock size={18} /> Ganti Password
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className={labelCls}>Password Saat Ini</Label>
                <Input type="password" data-testid="current-password-input" value={form.current_password} onChange={(e) => set("current_password", e.target.value)} className={inputCls} required />
              </div>
              <div className="space-y-2">
                <Label className={labelCls}>Password Baru</Label>
                <Input type="password" data-testid="new-password-input" value={form.new_password} onChange={(e) => set("new_password", e.target.value)} className={inputCls} required />
              </div>
              <div className="space-y-2">
                <Label className={labelCls}>Konfirmasi Password Baru</Label>
                <Input type="password" data-testid="confirm-password-input" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} className={inputCls} required />
              </div>
              <button type="submit" disabled={loading} data-testid="change-password-button" className="flex items-center gap-2 rounded-sm bg-[#171717] px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#262626] disabled:opacity-60">
                {loading && <CircleNotch size={16} className="animate-spin" />}Simpan Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
