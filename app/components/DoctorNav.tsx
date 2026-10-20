"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DoctorNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    {
      label: "Dashboard",
      path: "/doctor/dashboard",
    },
    {
      label: "My Patients",
      path: "/doctor/patients",
    },
    {
      label: "Usage Monitoring",
      path: "/doctor/usage",
    },
    {
      label: "Alerts",
      path: "/doctor/alerts",
    },
    {
      label: "Profile",
      path: "/doctor/profile",
    },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(path: string) {
    if (path === "/doctor/dashboard") {
      return pathname === path;
    }

    return pathname.startsWith(path);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

        {/* LOGO */}
        <div
          className="flex cursor-pointer items-center gap-4"
          onClick={() => router.push("/doctor/dashboard")}
        >
          <Image
            src="/sims-cloud-logo.png"
            alt="SIMS-Cloud"
            width={220}
            height={80}
            priority
            className="h-auto w-[170px] md:w-[200px]"
          />

          <div className="hidden border-l border-slate-700 pl-4 lg:block">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Healthcare Provider Portal
            </p>
          </div>
        </div>

        {/* DESKTOP MENU */}
        <nav className="hidden items-center gap-1 xl:flex">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                isActive(item.path)
                  ? "bg-cyan-500/10 font-medium text-cyan-400"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}

          <div className="mx-2 h-6 w-px bg-slate-800" />

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
          >
            Logout
          </button>
        </nav>

        {/* MOBILE BUTTON */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-slate-300 xl:hidden"
          aria-label="Open navigation menu"
        >
          {menuOpen ? (
            <span className="text-xl">×</span>
          ) : (
            <div className="space-y-1.5">
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
            </div>
          )}
        </button>
      </div>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="border-t border-slate-800 bg-slate-950 px-6 py-4 xl:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-2">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  router.push(item.path);
                  setMenuOpen(false);
                }}
                className={`rounded-xl px-4 py-3 text-left text-sm transition ${
                  isActive(item.path)
                    ? "bg-cyan-500/10 font-medium text-cyan-400"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}

            <button
              onClick={handleLogout}
              className="mt-2 rounded-xl border border-red-500/20 px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10"
            >
              Logout
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}