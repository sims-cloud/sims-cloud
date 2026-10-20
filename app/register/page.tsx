"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setSuccess(false);

    if (!fullName || !email || !password || !confirmPassword) {
      setMessage("Please complete all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "patient",
          },
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.user) {
        setMessage("Unable to create account.");
        return;
      }

      setSuccess(true);
      setMessage("Patient account created successfully! Redirecting to login...");

      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
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

            <div className="mt-14">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
                Smart Healthcare Platform
              </p>

              <h1 className="mt-4 text-4xl font-bold leading-tight">
                Join
                <span className="block text-cyan-400">
                  SIMS-Cloud
                </span>
              </h1>

              <p className="mt-5 max-w-md leading-7 text-slate-400">
                Create your patient account to monitor smart inhaler usage,
                remaining doses and personal inhaler activity.
              </p>
            </div>

            <div className="mt-10 space-y-4">
              <InfoItem
                number="01"
                title="Monitor Usage"
                text="Track inhaler usage digitally."
              />

              <InfoItem
                number="02"
                title="Track Doses"
                text="Monitor estimated remaining doses."
              />

              <InfoItem
                number="03"
                title="View Trends"
                text="Understand your inhaler usage patterns."
              />
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
              PATIENT REGISTRATION
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              Create Patient Account
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Register to access your personal smart inhaler dashboard.
            </p>

            <form
              onSubmit={handleRegister}
              className="mt-8 space-y-5"
            >

              {/* FULL NAME */}
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Full Name
                </label>

                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                />
              </div>

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
                  placeholder="Create a password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                />
              </div>

              {/* CONFIRM PASSWORD */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Confirm Password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                />
              </div>

              {/* INFO BOX */}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
                Public registration is available for patients only.
                Doctor accounts are managed separately by the system administrator.
              </div>

              {/* MESSAGE */}
              {message && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    success
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400"
                  }`}
                >
                  {message}
                </div>
              )}

              {/* BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating Account..." : "Create Patient Account"}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-cyan-400 hover:text-cyan-300"
              >
                Login here
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

function InfoItem({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-sm font-bold text-cyan-400">
        {number}
      </div>

      <div>
        <p className="font-medium">
          {title}
        </p>

        <p className="text-xs text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}