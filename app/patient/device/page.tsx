"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PatientNav from "@/app/components/PatientNav";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type Device = {
  id: string;
  device_code: string;
  device_name: string | null;
  total_doses: number;
  remaining_doses: number;
  status: string;
  last_sync: string | null;
  created_at?: string | null;
};

export default function PatientDevicePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDevice();
  }, []);

  async function loadDevice() {
    try {
      setLoading(true);
      setMessage("");

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

      // ==========================================
      // GET PROFILE
      // ==========================================
      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", user.id)
          .single();

      if (profileError || !profileData) {
        console.error("Profile error:", profileError);
        setMessage("Unable to load patient profile.");
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

      // ==========================================
      // GET SMART INHALER
      // ==========================================
      const { data: deviceData, error: deviceError } =
        await supabase
          .from("devices")
          .select(
            "id, device_code, device_name, total_doses, remaining_doses, status, last_sync, created_at"
          )
          .eq("patient_id", user.id)
          .limit(1)
          .maybeSingle();

      if (deviceError) {
        console.error("Device error:", deviceError);
        setMessage("Unable to load smart inhaler.");
        return;
      }

      setDevice(deviceData || null);
    } catch (error) {
      console.error("Device page error:", error);

      setMessage(
        "Something went wrong while loading your device."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // DOSE PERCENTAGE
  // ==========================================
  const dosePercentage = useMemo(() => {
    if (!device || device.total_doses <= 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        100,
        (device.remaining_doses /
          device.total_doses) *
          100
      )
    );
  }, [device]);

  const lowDose: boolean =
    device !== null &&
    device.remaining_doses <= 20;

  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Loading smart inhaler...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* SAME NAVBAR AS DASHBOARD */}
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
            My Device
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            View your connected SIMS-Cloud smart
            inhaler, estimated remaining doses and
            device connection information.
          </p>

          {profile?.full_name && (
            <p className="mt-2 text-sm text-slate-500">
              Patient: {profile.full_name}
            </p>
          )}
        </section>

        {/* ======================================
            ERROR
        ====================================== */}
        {message && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {message}
          </div>
        )}

        {/* ======================================
            NO DEVICE
        ====================================== */}
        {!device ? (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-2xl font-bold text-slate-300">
              !
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              No Smart Inhaler Assigned
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
              There is currently no SIMS-Cloud smart
              inhaler linked to this patient account.
            </p>
          </section>
        ) : (
          <>
            {/* ======================================
                DEVICE HERO
            ====================================== */}
            <section className="mt-8 overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-6 md:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
                      SIMS-CLOUD DEVICE
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

                  <h2 className="mt-5 text-2xl font-bold md:text-3xl">
                    {device.device_name ||
                      "SIMS Smart Inhaler"}
                  </h2>

                  <p className="mt-2 text-slate-400">
                    Device ID:{" "}
                    <span className="font-semibold text-white">
                      {device.device_code}
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 px-6 py-5">
                  <p className="text-sm text-slate-400">
                    Remaining Doses
                  </p>

                  <div className="mt-2 flex items-end gap-2">
                    <span
                      className={`text-4xl font-bold ${
                        lowDose
                          ? "text-amber-400"
                          : "text-cyan-400"
                      }`}
                    >
                      {device.remaining_doses}
                    </span>

                    <span className="pb-1 text-sm text-slate-500">
                      / {device.total_doses}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* ======================================
                LOW DOSE ALERT
            ====================================== */}
            {lowDose && (
              <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 font-bold text-amber-400">
                    !
                  </div>

                  <div>
                    <p className="font-semibold text-amber-300">
                      Low Remaining Dose
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Your smart inhaler is estimated to
                      have only {device.remaining_doses}{" "}
                      doses remaining.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* ======================================
                MAIN INFORMATION
            ====================================== */}
            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              {/* SMART INHALER DETAILS */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <div>
                  <p className="text-sm text-slate-500">
                    Device Information
                  </p>

                  <h2 className="mt-1 text-xl font-semibold">
                    Smart Inhaler Details
                  </h2>
                </div>

                <div className="mt-6 space-y-4">
                  <InfoRow
                    label="Device Name"
                    value={
                      device.device_name ||
                      "SIMS Smart Inhaler"
                    }
                  />

                  <InfoRow
                    label="Device ID"
                    value={device.device_code}
                  />

                  <InfoRow
                    label="Device Status"
                    value={
                      device.status === "online"
                        ? "Online"
                        : "Offline"
                    }
                  />

                  <InfoRow
                    label="Total Doses"
                    value={device.total_doses.toString()}
                  />

                  <InfoRow
                    label="Remaining Doses"
                    value={device.remaining_doses.toString()}
                  />

                  <InfoRow
                    label="Last Sync"
                    value={
                      device.last_sync
                        ? formatDateTime(
                            device.last_sync
                          )
                        : "No sync available"
                    }
                  />
                </div>
              </div>

              {/* ==================================
                  DOSE MONITORING
              ================================== */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <div>
                  <p className="text-sm text-slate-500">
                    Dose Monitoring
                  </p>

                  <h2 className="mt-1 text-xl font-semibold">
                    Estimated Dose Level
                  </h2>
                </div>

                <div className="mt-8 flex justify-center">
                  <div
                    className={`flex h-44 w-44 flex-col items-center justify-center rounded-full border-[12px] ${
                      lowDose
                        ? "border-amber-500/30"
                        : "border-cyan-500/30"
                    } bg-slate-950`}
                  >
                    <span
                      className={`text-4xl font-bold ${
                        lowDose
                          ? "text-amber-400"
                          : "text-cyan-400"
                      }`}
                    >
                      {Math.round(dosePercentage)}%
                    </span>

                    <span className="mt-1 text-xs text-slate-500">
                      remaining
                    </span>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      Dose Level
                    </span>

                    <span
                      className={`font-semibold ${
                        lowDose
                          ? "text-amber-400"
                          : "text-cyan-400"
                      }`}
                    >
                      {device.remaining_doses} /{" "}
                      {device.total_doses}
                    </span>
                  </div>

                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        lowDose
                          ? "bg-amber-400"
                          : "bg-cyan-400"
                      }`}
                      style={{
                        width: `${dosePercentage}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ======================================
                CONNECTION INFORMATION
            ====================================== */}
            <section className="mt-8 grid gap-5 md:grid-cols-3">
              <StatusCard
                title="Connection Status"
                value={
                  device.status === "online"
                    ? "Online"
                    : "Offline"
                }
                description={
                  device.status === "online"
                    ? "Device connection available"
                    : "Device currently unavailable"
                }
                active={device.status === "online"}
              />

              <StatusCard
                title="Device ID"
                value={device.device_code}
                description="Assigned SIMS-Cloud inhaler"
              />

              <StatusCard
                title="Last Sync"
                value={
                  device.last_sync
                    ? formatTime(device.last_sync)
                    : "No sync"
                }
                description={
                  device.last_sync
                    ? formatDate(device.last_sync)
                    : "No synchronisation record"
                }
              />
            </section>

            {/* ======================================
                PROTOTYPE INFORMATION
            ====================================== */}
            <section className="mt-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 font-bold text-cyan-400">
                  i
                </div>

                <div>
                  <h2 className="font-semibold text-cyan-300">
                    SIMS-Cloud Smart Inhaler Monitoring
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                    This page displays the smart inhaler
                    currently assigned to your account.
                    SIMS-Cloud is designed to record
                    inhaler activations, estimate
                    remaining doses and synchronise usage
                    information with the cloud monitoring
                    system.
                  </p>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                    Physical ESP32 and pressure-sensor
                    integration is currently part of the
                    prototype development process.
                  </p>
                </div>
              </div>
            </section>

            {/* ======================================
                ACTION
            ====================================== */}
            <section className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  router.push("/patient/dashboard")
                }
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
              >
                Back to Dashboard
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/patient/history")
                }
                className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                View Usage History
              </button>
            </section>

            {/* ======================================
                DISCLAIMER
            ====================================== */}
            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-sm leading-6 text-slate-400">
                SIMS-Cloud provides inhaler usage and
                estimated dose information for monitoring
                purposes. It does not replace professional
                medical assessment, diagnosis or treatment
                advice.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
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
    <div className="flex items-center justify-between gap-6 border-b border-slate-800 pb-4">
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
// STATUS CARD
// ==========================================
function StatusCard({
  title,
  value,
  description,
  active = false,
}: {
  title: string;
  value: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <div className="mt-3 flex items-center gap-2">
        {active && (
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        )}

        <p
          className={`break-words text-xl font-bold ${
            active
              ? "text-emerald-400"
              : "text-white"
          }`}
        >
          {value}
        </p>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

// ==========================================
// DATE / TIME
// ==========================================
function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString(
    "en-MY",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

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

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString(
    "en-MY",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}