"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");

    if (!email || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      // 1. LOGIN SUPABASE
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.user) {
        setMessage("Unable to login.");
        return;
      }

      // 2. GET USER ROLE FROM PROFILES
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        setMessage("Profile not found. Please contact administrator.");
        return;
      }

      // 3. REDIRECT BASED ON ROLE
      if (profile.role === "patient") {
        router.push("/patient/dashboard");
        return;
      }

      if (profile.role === "doctor") {
        router.push("/doctor/dashboard");
        return;
      }

      setMessage("Invalid account role.");
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-10 lg:px-8">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl lg:grid-cols-2">

          {/* LEFT SIDE */}
          <div className="hidden bg-slate-950 p-10 lg:block">
            <Link href="/">
              <Image
                src="/sims-cloud-logo.png"
                alt="SIMS-Cloud Smart Inhaler System"
                width={360}
                height={120}
                priority
                className="h-auto w-[280px]"
              />
            </Link>

            <div className="mt-16">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
                Smart Healthcare Platform
              </p>

              <h1 className="mt-4 text-4xl font-bold leading-tight">
                Welcome back to
                <span className="block text-cyan-400">
                  SIMS-Cloud
                </span>
              </h1>

              <p className="mt-5 max-w-md leading-7 text-slate-400">
                Access your smart inhaler dashboard to review inhaler usage,
                remaining doses, device status and patient trends.
              </p>
            </div>

            <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-500">
                System Status
              </p>

              <div className="mt-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                <span className="text-sm font-medium text-emerald-400">
                  SIMS-Cloud Online
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="p-7 sm:p-10 lg:p-12">

            {/* MOBILE LOGO */}
            <div className="mb-8 lg:hidden">
              <Link href="/">
                <Image
                  src="/sims-cloud-logo.png"
                  alt="SIMS-Cloud"
                  width={320}
                  height={110}
                  className="h-auto w-[230px]"
                />
              </Link>
            </div>

            <p className="text-sm font-semibold text-cyan-400">
              ACCOUNT LOGIN
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              Sign in to your account
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Enter your registered email and password.
            </p>

            <form
              onSubmit={handleLogin}
              className="mt-8 space-y-5"
            >
              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                />
              </div>

              {/* MESSAGE */}
              {message && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {message}
                </div>
              )}

              {/* LOGIN BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-semibold text-cyan-400 hover:text-cyan-300"
              >
                Register here
              </Link>
            </p>

            <div className="mt-7 text-center">
              <Link
                href="/"
                className="text-sm text-slate-500 transition hover:text-slate-300"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}