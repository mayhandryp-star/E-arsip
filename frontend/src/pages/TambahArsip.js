import { useEffect, useState } from "react";
import Layout, { PageHeader } from "@/components/Layout";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilePdf, UploadSimple, CircleNotch, X } from "@phosphor-icons/react";

const empty = { nomor_arsip: "", nama_arsip: "", jenis_arsip: "", lokasi_arsip: "" };

export default function TambahArsip() {
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [types, setTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/archive-types").then((r) => setTypes(r.data)).catch(() => {});
    api.get("/archive-locations").then((r) => setLocations(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f && f.type !== "application/pdf") {
      toast.error("File harus berformat PDF");
      return;
    }
    setFile(f || null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("nomor_arsip", form.nomor_arsip);
      fd.append("nama_arsip", form.nama_arsip);
      fd.append("jenis_arsip", form.jenis_arsip);
      fd.append("lokasi_arsip", form.lokasi_arsip);
      if (file) fd.append("file", file);
      await api.post("/archives", fd);
      toast.success("Arsip berhasil ditambahkan");
      setForm(empty);
      setFile(null);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const labelCls = "text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500";
  const inputCls = "rounded-sm border-neutral-300 focus:border-neutral-900 focus-visible:ring-1";

  return (
    <Layout>
      <div className="p-8">
        <PageHeader title="Tambah Arsip" subtitle="Isi detail arsip dan unggah dokumen PDF." />

        <form onSubmit={submit} className="max-w-3xl rounded-sm border border-neutral-200 bg-white p-8" data-testid="tambah-arsip-form">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className={labelCls}>Nomor Arsip</Label>
              <Input data-testid="input-nomor-arsip" value={form.nomor_arsip} onChange={(e) => set("nomor_arsip", e.target.value)} className={inputCls} required />
            </div>
            <div className="space-y-2">
              <Label className={labelCls}>Nama Arsip</Label>
              <Input data-testid="input-nama-arsip" value={form.nama_arsip} onChange={(e) => set("nama_arsip", e.target.value)} className={inputCls} required />
            </div>
            <div className="space-y-2">
              <Label className={labelCls}>Jenis Arsip</Label>
              <Select value={form.jenis_arsip} onValueChange={(v) => set("jenis_arsip", v)}>
                <SelectTrigger data-testid="select-jenis-arsip" className={inputCls}>
                  <SelectValue placeholder="Pilih jenis arsip" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={labelCls}>Lokasi Arsip</Label>
              <Select value={form.lokasi_arsip} onValueChange={(v) => set("lokasi_arsip", v)}>
                <SelectTrigger data-testid="select-lokasi-arsip" className={inputCls}>
                  <SelectValue placeholder="Pilih lokasi arsip" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label className={labelCls}>Upload Arsip (PDF)</Label>
            {!file ? (
              <label
                htmlFor="pdf-upload"
                data-testid="pdf-dropzone"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-neutral-300 bg-neutral-50 py-10 text-center transition-colors duration-200 hover:border-neutral-500 hover:bg-neutral-100"
              >
                <UploadSimple size={26} className="text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700">Klik untuk memilih file PDF</span>
                <span className="text-xs text-neutral-400">Hanya file .pdf yang didukung</span>
                <input id="pdf-upload" data-testid="input-pdf-file" type="file" accept="application/pdf" className="hidden" onChange={onFile} />
              </label>
            ) : (
              <div className="flex items-center justify-between rounded-sm border border-neutral-200 bg-neutral-50 px-4 py-3" data-testid="pdf-selected">
                <div className="flex items-center gap-3">
                  <FilePdf size={22} className="text-red-600" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <button type="button" onClick={() => setFile(null)} className="text-neutral-400 hover:text-neutral-900" data-testid="remove-pdf-button">
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              data-testid="submit-arsip-button"
              disabled={loading}
              className="flex items-center gap-2 rounded-sm bg-[#171717] px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#262626] disabled:opacity-60"
            >
              {loading && <CircleNotch size={16} className="animate-spin" />}
              Simpan Arsip
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
