import { useEffect, useState } from "react";
import Layout, { PageHeader } from "@/components/Layout";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash, CircleNotch } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

const labelCls = "text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500";
const inputCls = "rounded-sm border-neutral-300 focus:border-neutral-900 focus-visible:ring-1";

export default function Pengaturan() {
  return (
    <Layout>
      <div className="p-8">
        <PageHeader title="Pengaturan" subtitle="Kelola pengguna, jenis arsip, dan lokasi arsip." />
        <Tabs defaultValue="users" className="max-w-4xl">
          <TabsList className="rounded-sm bg-neutral-100">
            <TabsTrigger value="users" data-testid="tab-users" className="rounded-sm data-[state=active]:bg-white">Input User</TabsTrigger>
            <TabsTrigger value="types" data-testid="tab-types" className="rounded-sm data-[state=active]:bg-white">Jenis Arsip</TabsTrigger>
            <TabsTrigger value="locations" data-testid="tab-locations" className="rounded-sm data-[state=active]:bg-white">Lokasi Arsip</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
          <TabsContent value="types" className="mt-6"><NamedTab endpoint="archive-types" singular="Jenis Arsip" testid="types" /></TabsContent>
          <TabsContent value="locations" className="mt-6"><NamedTab endpoint="archive-locations" singular="Lokasi Arsip" testid="locations" /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", name: "", password: "", role: "user" });
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState(null);

  const load = () => api.get("/users").then((r) => setUsers(r.data)).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const add = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/users", form);
      toast.success("Pengguna ditambahkan");
      setForm({ username: "", name: "", password: "", role: "user" });
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const del = async () => {
    try {
      await api.delete(`/users/${target.id}`);
      toast.success("Pengguna dihapus");
      setTarget(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <form onSubmit={add} className="rounded-sm border border-neutral-200 bg-white p-6 lg:col-span-2" data-testid="add-user-form">
        <h3 className="mb-4 text-lg font-medium" style={{ fontFamily: "'Manrope', sans-serif" }}>Tambah Pengguna</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className={labelCls}>Username</Label>
            <Input data-testid="user-username-input" value={form.username} onChange={(e) => set("username", e.target.value)} className={inputCls} required />
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Nama Lengkap</Label>
            <Input data-testid="user-name-input" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} required />
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Password</Label>
            <Input type="password" data-testid="user-password-input" value={form.password} onChange={(e) => set("password", e.target.value)} className={inputCls} required />
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Peran</Label>
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger data-testid="user-role-select" className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User (input, buka, unduh)</SelectItem>
                <SelectItem value="admin">Admin (akses penuh)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button type="submit" disabled={loading} data-testid="add-user-button" className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#262626] disabled:opacity-60">
            {loading ? <CircleNotch size={16} className="animate-spin" /> : <Plus size={16} />}Tambah Pengguna
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white lg:col-span-3" data-testid="users-list">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 last:border-0" data-testid={`user-row-${u.id}`}>
            <div>
              <div className="text-sm font-medium">{u.name} <span className="font-mono text-xs text-neutral-400">@{u.username}</span></div>
              <Badge variant={u.role === "admin" ? "default" : "secondary"} className="mt-1 rounded-sm text-[10px] uppercase tracking-wide">{u.role}</Badge>
            </div>
            {u.id !== me.id && (
              <button onClick={() => setTarget(u)} data-testid={`delete-user-${u.id}`} className="text-neutral-400 transition-colors duration-200 hover:text-red-600"><Trash size={18} /></button>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent className="rounded-sm bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "'Manrope', sans-serif" }}>Hapus pengguna?</AlertDialogTitle>
            <AlertDialogDescription>Pengguna {target?.name} akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={del} data-testid="confirm-delete-user" className="rounded-sm bg-[#DC2626] hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NamedTab({ endpoint, singular, testid }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState(null);

  const load = () => api.get(`/${endpoint}`).then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, [endpoint]);

  const add = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/${endpoint}`, { name });
      toast.success(`${singular} ditambahkan`);
      setName("");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const del = async () => {
    try {
      await api.delete(`/${endpoint}/${target.id}`);
      toast.success(`${singular} dihapus`);
      setTarget(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="max-w-xl">
      <form onSubmit={add} className="mb-4 flex gap-3" data-testid={`add-${testid}-form`}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Tambah ${singular.toLowerCase()}...`} className={inputCls} data-testid={`${testid}-input`} required />
        <button type="submit" disabled={loading} data-testid={`add-${testid}-button`} className="flex items-center gap-2 rounded-sm bg-[#171717] px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#262626] disabled:opacity-60">
          {loading ? <CircleNotch size={16} className="animate-spin" /> : <Plus size={16} />}Tambah
        </button>
      </form>
      <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white" data-testid={`${testid}-list`}>
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-400">Belum ada data.</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 last:border-0" data-testid={`${testid}-item-${it.id}`}>
              <span className="text-sm font-medium">{it.name}</span>
              <button onClick={() => setTarget(it)} data-testid={`delete-${testid}-${it.id}`} className="text-neutral-400 transition-colors duration-200 hover:text-red-600"><Trash size={17} /></button>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent className="rounded-sm bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "'Manrope', sans-serif" }}>Hapus {singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>"{target?.name}" akan dihapus.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={del} className="rounded-sm bg-[#DC2626] hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
