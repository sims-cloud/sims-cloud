"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const menuItems = [
  {
    name: "Dashboard",
    path: "/patient/dashboard",
  },
  {
    name: "My Device",
    path: "/patient/device",
  },
  {
    name: "Usage History",
    path: "/patient/history",
  },
  {
    name: "Profile",
    path: "/patient/profile",
  },
];

export default function PatientNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    setMobileMenuOpen(false);
    router.push("/login");
  }

  function goTo(path: string) {
    setMobileMenuOpen(false);
    router.push(path);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6">
        {/* ======================================
            MAIN NAVIGATION ROW
        ====================================== */}
        <div className="flex min-h-[88px] items-center justify-between">
          {/* ==================================
              LEFT SIDE
          ================================== */}
          <div className="flex items-center gap-6">
            {/* LOGO */}
            <button
              type="button"
              onClick={() =>
                goTo("/patient/dashboard")
              }
              className="shrink-0"
            >
              <Image
                src="/sims-cloud-logo.png"
                alt="SIMS-Cloud"
                width={220}
                height={80}
                priority
                className="h-auto w-[180px] md:w-[210px]"
              />
            </button>

            {/* ==================================
                DESKTOP MENU
            ================================== */}
            <nav className="hidden items-center gap-6 lg:flex">
              {menuItems.map((item) => {
                const active =
                  pathname === item.path;

                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() =>
                      goTo(item.path)
                    }
                    className={`text-sm transition ${
                      active
                        ? "font-semibold text-cyan-400"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ==================================
              RIGHT SIDE - DESKTOP
          ================================== */}
          <div className="hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
            >
              Logout
            </button>
          </div>

          {/* ==================================
              MOBILE BUTTON
          ================================== */}
          <button
            type="button"
            onClick={() =>
              setMobileMenuOpen(
                (current) => !current
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-white transition hover:border-cyan-500 lg:hidden"
            aria-label="Patient menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-6 w-6"
              >
                <path d="M6 6L18 18" />
                <path d="M18 6L6 18" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-6 w-6"
              >
                <path d="M4 7H20" />
                <path d="M4 12H20" />
                <path d="M4 17H20" />
              </svg>
            )}
          </button>
        </div>

        {/* ======================================
            MOBILE MENU
        ====================================== */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-800 pb-5 pt-4 lg:hidden">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const active =
                  pathname === item.path;

                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() =>
                      goTo(item.path)
                    }
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${
                      active
                        ? "bg-cyan-500/10 font-semibold text-cyan-400"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <span>{item.name}</span>

                    {active && (
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="my-4 border-t border-slate-800" />

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  window.location.reload()
                }
                className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}