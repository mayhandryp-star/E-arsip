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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { MagnifyingGlass, Trash, FilePdf, CircleNotch } from "@phosphor-icons/react";

export default function HapusArsip() {
  const [nomor, setNomor] = useState("");
  const [nama, setNama] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/archives/${target.id}`);
      toast.success("Arsip berhasil dihapus");
      setResults((r) => r.filter((x) => x.id !== target.id));
      setTarget(null);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setDeleting(false);
    }
  };

  const inputCls = "rounded-sm border-neutral-300 focus:border-neutral-900 focus-visible:ring-1";
  const labelCls = "text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500";

  return (
    <Layout>
      <div className="p-8">
        <PageHeader title="Hapus Arsip" subtitle="Cari arsip lalu hapus secara permanen." />

        <form onSubmit={doSearch} className="mb-6 rounded-sm border border-neutral-200 bg-white p-6" data-testid="delete-search-form">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className={labelCls}>Nomor Arsip</Label>
              <Input data-testid="delete-search-nomor" value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="Cari nomor..." className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label className={labelCls}>Nama Arsip</Label>
              <Input data-testid="delete-search-nama" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Cari nama..." className={inputCls} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" data-testid="delete-search-button" disabled={loading} className="flex items-center gap-2 rounded-sm bg-[#171717] px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#262626] disabled:opacity-60">
              {loading ? <CircleNotch size={16} className="animate-spin" /> : <MagnifyingGlass size={16} />}
              Cari
            </button>
          </div>
        </form>

        {!searched ? (
          <div className="rounded-sm border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-400">Cari arsip untuk mulai menghapus.</div>
        ) : results.length === 0 ? (
          <div className="rounded-sm border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-400" data-testid="delete-results-empty">Tidak ada arsip ditemukan.</div>
        ) : (
          <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white" data-testid="delete-results-table">
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-200 hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-[0.08em] text-neutral-500">Nomor</TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.08em] text-neutral-500">Nama</TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.08em] text-neutral-500">Jenis</TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.08em] text-neutral-500">Dokumen</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-[0.08em] text-neutral-500">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row) => (
                  <TableRow key={row.id} className="border-neutral-200 transition-colors duration-200 hover:bg-neutral-50" data-testid={`delete-row-${row.id}`}>
                    <TableCell className="font-mono text-sm">{row.nomor_arsip}</TableCell>
                    <TableCell className="text-sm font-medium">{row.nama_arsip}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{row.jenis_arsip || "—"}</TableCell>
                    <TableCell>
                      {row.has_file ? (
                        <a href={fileUrl(row.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#2563EB] hover:underline"><FilePdf size={16} /> Buka</a>
                      ) : (
                        <Badge variant="secondary" className="rounded-sm text-xs">Tanpa file</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <button onClick={() => setTarget(row)} data-testid={`delete-button-${row.id}`} className="inline-flex items-center gap-1.5 rounded-sm bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-red-700">
                        <Trash size={14} /> Hapus
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent className="rounded-sm bg-white" data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "'Manrope', sans-serif" }}>Hapus arsip ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Arsip <span className="font-semibold text-neutral-800">{target?.nama_arsip}</span> ({target?.nomor_arsip}) akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} data-testid="confirm-delete-button" className="rounded-sm bg-[#DC2626] hover:bg-red-700">
              {deleting && <CircleNotch size={16} className="mr-2 animate-spin" />}Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
