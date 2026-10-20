"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PatientNav from "@/app/components/PatientNav";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  created_at: string | null;
};

type Device = {
  id: string;
  device_code: string;
  device_name: string | null;
  status: string;
  remaining_doses: number;
  total_doses: number;
};

export default function PatientProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setMessage("");
      setErrorMessage("");

      // ==========================================
      // CHECK LOGIN
      // ==========================================
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email || "");

      // ==========================================
      // GET PROFILE
      // ==========================================
      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, full_name, role, created_at")
          .eq("id", user.id)
          .single();

      if (profileError || !profileData) {
        console.error("Profile error:", profileError);
        setErrorMessage(
          "Unable to load patient profile."
        );
        return;
      }

      if (profileData.role === "doctor") {
        router.push("/doctor/dashboard");
        return;
      }

      if (profileData.role !== "patient") {
        router.push("/login");
        return;
      }

      setProfile(profileData);
      setFullName(profileData.full_name || "");

      // ==========================================
      // GET ASSIGNED DEVICE
      // ==========================================
      const { data: deviceData, error: deviceError } =
        await supabase
          .from("devices")
          .select(
            "id, device_code, device_name, status, remaining_doses, total_doses"
          )
          .eq("patient_id", user.id)
          .limit(1)
          .maybeSingle();

      if (deviceError) {
        console.error("Device error:", deviceError);
      }

      setDevice(deviceData || null);
    } catch (error) {
      console.error("Profile page error:", error);

      setErrorMessage(
        "Something went wrong while loading your profile."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // UPDATE NAME
  // ==========================================
  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!profile) return;

    const cleanName = fullName.trim();

    if (!cleanName) {
      setErrorMessage(
        "Please enter your full name."
      );
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: cleanName,
        })
        .eq("id", profile.id);

      if (error) {
        console.error("Update error:", error);
        setErrorMessage(
          "Unable to update your profile."
        );
        return;
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              full_name: cleanName,
            }
          : current
      );

      setMessage(
        "Profile updated successfully."
      );
    } catch (error) {
      console.error("Save profile error:", error);

      setErrorMessage(
        "Something went wrong while updating your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // CHANGE PASSWORD
  // ==========================================
  async function handleChangePassword() {
    const newPassword = window.prompt(
      "Enter your new password:"
    );

    if (!newPassword) return;

    if (newPassword.length < 6) {
      setMessage("");
      setErrorMessage(
        "Password must contain at least 6 characters."
      );
      return;
    }

    const confirmPassword = window.prompt(
      "Confirm your new password:"
    );

    if (newPassword !== confirmPassword) {
      setMessage("");
      setErrorMessage(
        "Passwords do not match."
      );
      return;
    }

    try {
      setMessage("");
      setErrorMessage("");

      const { error } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (error) {
        console.error(
          "Password update error:",
          error
        );

        setErrorMessage(
          error.message ||
            "Unable to change password."
        );

        return;
      }

      setMessage(
        "Password changed successfully."
      );
    } catch (error) {
      console.error(
        "Change password error:",
        error
      );

      setErrorMessage(
        "Something went wrong while changing your password."
      );
    }
  }

  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Loading profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* SAME NAVBAR */}
      <PatientNav />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* ======================================
            PAGE TITLE
        ====================================== */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Patient Portal
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            My Profile
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Manage your SIMS-Cloud patient account and
            view your connected smart inhaler.
          </p>
        </section>

        {/* ======================================
            MESSAGES
        ====================================== */}
        {message && (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* ======================================
            PROFILE SUMMARY
        ====================================== */}
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Patient Name"
            value={
              profile?.full_name || "Not provided"
            }
          />

          <SummaryCard
            title="Account Type"
            value="Patient"
          />

          <SummaryCard
            title="Patient ID"
            value={
              profile?.id
                ? `${profile.id.substring(0, 8)}...`
                : "-"
            }
          />

          <SummaryCard
            title="Account Created"
            value={
              profile?.created_at
                ? formatDate(profile.created_at)
                : "-"
            }
          />
        </section>

        {/* ======================================
            ACCOUNT + DEVICE
        ====================================== */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* ACCOUNT DETAILS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
            <div>
              <p className="text-sm text-slate-500">
                Personal Information
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Account Details
              </h2>
            </div>

            <form
              onSubmit={handleSave}
              className="mt-7 space-y-5"
            >
              {/* FULL NAME */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Full Name
                </label>

                <input
                  type="text"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                  placeholder="Enter your full name"
                />
              </div>

              {/* EMAIL */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-500"
                />

                <p className="mt-2 text-xs text-slate-600">
                  Email address is linked to your
                  SIMS-Cloud login account.
                </p>
              </div>

              {/* ROLE */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Account Type
                </label>

                <input
                  type="text"
                  value="Patient"
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-500"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

                <button
                  type="button"
                  onClick={handleChangePassword}
                  className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
                >
                  Change Password
                </button>
              </div>
            </form>
          </div>

          {/* ==================================
              CONNECTED DEVICE
          ================================== */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-500">
              Connected Device
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              Smart Inhaler
            </h2>

            {!device ? (
              <div className="mt-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 font-bold text-slate-400">
                  !
                </div>

                <p className="mt-4 font-medium text-slate-300">
                  No device assigned
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  There is currently no smart inhaler
                  connected to this account.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
                      {device.device_code}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        device.status === "online"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {device.status === "online"
                        ? "Online"
                        : "Offline"}
                    </span>
                  </div>

                  <h3 className="mt-4 font-semibold">
                    {device.device_name ||
                      "SIMS Smart Inhaler"}
                  </h3>
                </div>

                <div className="mt-6 space-y-4">
                  <InfoRow
                    label="Remaining"
                    value={`${device.remaining_doses} doses`}
                  />

                  <InfoRow
                    label="Total Capacity"
                    value={`${device.total_doses} doses`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push("/patient/device")
                  }
                  className="mt-6 w-full rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm font-medium text-cyan-400 transition hover:bg-cyan-500/10"
                >
                  View My Device
                </button>
              </>
            )}
          </div>
        </section>

        {/* ======================================
            SECURITY
        ====================================== */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-500">
            Account Security
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            Login & Password
          </h2>

          <div className="mt-6 flex flex-col gap-5 rounded-xl border border-slate-800 bg-slate-950/50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-white">
                Password
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Change your SIMS-Cloud account password
                when necessary.
              </p>
            </div>

            <button
              type="button"
              onClick={handleChangePassword}
              className="shrink-0 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
            >
              Change Password
            </button>
          </div>
        </section>

        {/* ======================================
            DISCLAIMER
        ====================================== */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm leading-6 text-slate-400">
            SIMS-Cloud stores account and smart inhaler
            information for monitoring purposes. Your
            account credentials should be kept private and
            should not be shared with other users.
          </p>
        </section>
      </div>
    </main>
  );
}

// ==========================================
// SUMMARY CARD
// ==========================================
function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-3 break-words text-xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

// ==========================================
// INFO ROW
// ==========================================
function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-slate-800 pb-4">
      <span className="text-sm text-slate-400">
        {label}
      </span>

      <span className="text-right text-sm font-medium text-white">
        {value}
      </span>
    </div>
  );
}

// ==========================================
// DATE
// ==========================================
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(
    "en-MY",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}