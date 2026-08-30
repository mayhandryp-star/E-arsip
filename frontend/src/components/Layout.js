import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  SquaresFour,
  FilePlus,
  MagnifyingGlass,
  Trash,
  Gear,
  SignOut,
  Archive,
  UserCircle,
} from "@phosphor-icons/react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: SquaresFour, admin: false },
  { to: "/tambah", label: "Tambah Arsip", icon: FilePlus, admin: false },
  { to: "/cari", label: "Cari Arsip", icon: MagnifyingGlass, admin: false },
  { to: "/hapus", label: "Hapus Arsip", icon: Trash, admin: true },
  { to: "/pengaturan", label: "Pengaturan", icon: Gear, admin: true },
  { to: "/profil", label: "Profil", icon: UserCircle, admin: false },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-[#FAFAFA] text-[#171717]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <aside className="flex w-64 flex-col border-r border-neutral-200 bg-white" data-testid="sidebar">
        <div className="flex items-center gap-2.5 border-b border-neutral-200 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#171717] text-white">
            <Archive size={20} weight="fill" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Arsip Digital
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-400">Sistem Kearsipan</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems
            .filter((i) => !i.admin || user?.role === "admin")
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={`nav-${item.to.replace("/", "")}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors duration-200 ${
                    isActive
                      ? "bg-neutral-100 font-semibold text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="border-t border-neutral-200 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-sm px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-neutral-100 text-xs font-bold uppercase">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-button"
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-neutral-600 transition-colors duration-200 hover:bg-red-50 hover:text-red-600"
          >
            <SignOut size={18} />
            Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl tracking-tight text-neutral-900 sm:text-4xl" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700 }}>
        {title}
      </h1>
      {subtitle && <p className="mt-1.5 text-sm text-neutral-500">{subtitle}</p>}
    </div>
  );
}
