import { useState } from "react";
import Layout, { PageHeader } from "@/components/Layout";
import { api, formatApiErrorDetail, fileUrl } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MagnifyingGlass, PencilSimple, FilePdf, CircleNotch, DownloadSimple, UploadSimple, X } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

export default function CariArsip() {
  const { user } = useAuth();
  const [nomor, setNomor] = useState("");
  const [nama, setNama] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  // edit dialog
  const [editing, setEditing] = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const doSearch = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.get("/archives", { params: { nomor, nama } });
      setResults(data);
      setSearched(true);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (row) => {
    setEditing({ ...row });
    setEditFile(null);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("nomor_arsip", editing.nomor_arsip);
      fd.append("nama_arsip", editing.nama_arsip);
      if (editFile) fd.append("file", editFile);
      await api.put(`/archives/${editing.id}`, fd);
      toast.success("Arsip berhasil diperbarui");
      setEditing(null);
      doSearch();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "rounded-sm border-neutral-300 focus:border-neutral-900 focus-visible:ring-1";
  const labelCls = "text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500";
  const isAdmin = user?.role === "admin";

  return (
    <Layout>
      <div className="p-8">
        <PageHeader title="Cari Arsip" subtitle="Cari berdasarkan nomor atau nama arsip." />

        <form onSubmit={doSearch} className="mb-6 rounded-sm border border-neutral-200 bg-white p-6" data-testid="search-form">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className={labelCls}>Nomor Arsip</Label>
              <Input data-testid="search-nomor-input" value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="Cari nomor..." className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label className={labelCls}>Nama Arsip</Label>
              <Input data-testid="search-nama-input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Cari nama..." className={inputCls} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" data-testid="search-button" disabled={loading} className="flex items-center gap-2 rounded-sm bg-[#171717] px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#262626] disabled:opacity-60">
              {loading ? <CircleNotch size={16} className="animate-spin" /> : <MagnifyingGlass size={16} />}
              Cari
            </button>
          </div>
        </form>

        <ResultsTable results={results} searched={searched} isAdmin={isAdmin} onEdit={openEdit} />
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-sm bg-white sm:max-w-lg" data-testid="edit-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Manrope', sans-serif" }}>Ubah Arsip</DialogTitle>
            <DialogDescription>Perbarui nomor, nama, atau ganti file PDF arsip.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className={labelCls}>Nomor Arsip</Label>
                <Input data-testid="edit-nomor-input" value={editing.nomor_arsip} onChange={(e) => setEditing({ ...editing, nomor_arsip: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label className={labelCls}>Nama Arsip</Label>
                <Input data-testid="edit-nama-input" value={editing.nama_arsip} onChange={(e) => setEditing({ ...editing, nama_arsip: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label className={labelCls}>Ganti File PDF (opsional)</Label>
                {!editFile ? (
                  <label htmlFor="edit-pdf" className="flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-neutral-300 bg-neutral-50 py-4 text-sm text-neutral-600 transition-colors duration-200 hover:border-neutral-500">
                    <UploadSimple size={18} /> Pilih file PDF baru
                    <input id="edit-pdf" data-testid="edit-pdf-input" type="file" accept="application/pdf" className="hidden" onChange={(e) => setEditFile(e.target.files?.[0] || null)} />
                  </label>
                ) : (
                  <div className="flex items-center justify-between rounded-sm border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm"><FilePdf size={18} className="text-red-600" />{editFile.name}</span>
                    <button onClick={() => setEditFile(null)} className="text-neutral-400 hover:text-neutral-900"><X size={16} /></button>
                  </div>
                )}
                {editing.has_file && !editFile && (
                  <p className="text-xs text-neutral-400">File saat ini: {editing.file_name}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setEditing(null)} className="rounded-sm border border-neutral-300 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-neutral-100">Batal</button>
            <button onClick={saveEdit} disabled={saving} data-testid="edit-save-button" className="flex items-center gap-2 rounded-sm bg-[#171717] px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#262626] disabled:opacity-60">
              {saving && <CircleNotch size={16} className="animate-spin" />}Simpan Perubahan
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function ResultsTable({ results, searched, isAdmin, onEdit }) {
  if (!searched) {
    return (
      <div className="rounded-sm border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-400" data-testid="results-empty-initial">
        Masukkan kata kunci lalu klik Cari untuk menampilkan arsip.
      </div>
    );
  }
  if (results.length === 0) {
    return (
      <div className="rounded-sm border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-400" data-testid="results-empty">
        Tidak ada arsip yang cocok dengan pencarian Anda.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white" data-testid="results-table">
      <Table>
        <TableHeader>
          <TableRow className="border-neutral-200 hover:bg-transparent">
            <TableHead className="text-xs uppercase tracking-[0.08em] text-neutral-500">Nomor</TableHead>
            <TableHead className="text-xs uppercase tracking-[0.08em] text-neutral-500">Nama</TableHead>
            <TableHead className="text-xs uppercase tracking-[0.08em] text-neutral-500">Jenis</TableHead>
            <TableHead className="text-xs uppercase tracking-[0.08em] text-neutral-500">Lokasi</TableHead>
            <TableHead className="text-xs uppercase tracking-[0.08em] text-neutral-500">Dokumen</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-[0.08em] text-neutral-500">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((row) => (
            <TableRow key={row.id} className="border-neutral-200 transition-colors duration-200 hover:bg-neutral-50" data-testid={`result-row-${row.id}`}>
              <TableCell className="font-mono text-sm">{row.nomor_arsip}</TableCell>
              <TableCell className="text-sm font-medium">{row.nama_arsip}</TableCell>
              <TableCell className="text-sm text-neutral-600">{row.jenis_arsip || "—"}</TableCell>
              <TableCell className="text-sm text-neutral-600">{row.lokasi_arsip || "—"}</TableCell>
              <TableCell>
                {row.has_file ? (
                  <a href={fileUrl(row.id)} target="_blank" rel="noreferrer" data-testid={`view-pdf-${row.id}`} className="inline-flex items-center gap-1.5 text-sm text-[#2563EB] hover:underline">
                    <FilePdf size={16} /> Buka
                  </a>
                ) : (
                  <Badge variant="secondary" className="rounded-sm text-xs">Tanpa file</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {row.has_file && (
                    <a href={fileUrl(row.id)} download data-testid={`download-pdf-${row.id}`} className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-300 px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-neutral-100">
                      <DownloadSimple size={14} /> Unduh
                    </a>
                  )}
                  {isAdmin && (
                    <button onClick={() => onEdit(row)} data-testid={`edit-button-${row.id}`} className="inline-flex items-center gap-1.5 rounded-sm bg-[#171717] px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-[#262626]">
                      <PencilSimple size={14} /> Ubah
                    </button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
