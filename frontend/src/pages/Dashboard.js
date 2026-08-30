import { useEffect, useState } from "react";
import Layout, { PageHeader } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Archive, FilePdf, Tag, MapPin, UsersThree } from "@phosphor-icons/react";

const cards = [
  { key: "total_arsip", label: "Total Arsip", icon: Archive },
  { key: "arsip_dengan_file", label: "Arsip dengan PDF", icon: FilePdf },
  { key: "jenis_arsip", label: "Jenis Arsip", icon: Tag },
  { key: "lokasi_arsip", label: "Lokasi Arsip", icon: MapPin },
  { key: "pengguna", label: "Pengguna", icon: UsersThree },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <Layout>
      <div className="p-8">
        <PageHeader title={`Selamat datang, ${user?.name}`} subtitle="Ringkasan sistem kearsipan digital Anda." />
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3" data-testid="stats-grid">
          {cards.map((c) => (
            <div key={c.key} className="bg-white p-6" data-testid={`stat-${c.key}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">{c.label}</div>
                  <div className="mt-3 text-4xl font-bold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {stats ? stats[c.key] : "—"}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-neutral-100 text-neutral-700">
                  <c.icon size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
