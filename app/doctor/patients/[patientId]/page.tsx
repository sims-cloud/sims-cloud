"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DoctorNav from "@/app/components/DoctorNav";

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
};

type Usage = {
  id: number;
  sensor_value: number | null;
  activation_detected: boolean;
  remaining_doses: number | null;
  used_at: string;
};

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams();

  const patientId = params.patientId as string;

  const [patient, setPatient] = useState<Profile | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!patientId) {
      return;
    }

    let active = true;
    let usageChannel: ReturnType<typeof supabase.channel> | null = null;
    let deviceChannel: ReturnType<typeof supabase.channel> | null = null;

    async function setupPatient() {
      const result = await loadPatient();

      if (!result || !active) {
        return;
      }

      usageChannel = supabase
        .channel(`doctor-patient-usage-${patientId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "inhaler_usage",
            filter: `patient_id=eq.${patientId}`,
          },
          (payload) => {
            const newUsage = payload.new as Usage;

            setUsage((currentUsage) => {
              const exists = currentUsage.some(
                (item) => item.id === newUsage.id
              );

              if (exists) {
                return currentUsage;
              }

              return [newUsage, ...currentUsage].slice(0, 100);
            });
          }
        )
        .subscribe();

      deviceChannel = supabase
        .channel(`doctor-patient-device-${patientId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "devices",
            filter: `patient_id=eq.${patientId}`,
          },
          (payload) => {
            const updatedDevice = payload.new as Device;
            setDevice(updatedDevice);
          }
        )
        .subscribe();
    }

    setupPatient();

    return () => {
      active = false;

      if (usageChannel) {
        supabase.removeChannel(usageChannel);
      }

      if (deviceChannel) {
        supabase.removeChannel(deviceChannel);
      }
    };
  }, [patientId, router]);

  // Re-check heartbeat age every second.
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  async function loadPatient() {
    try {
      setLoading(true);
      setMessage("");

      // ==========================================
      // 1. CHECK CURRENT LOGIN
      // ==========================================
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // ==========================================
      // 2. MAKE SURE CURRENT USER IS DOCTOR
      // ==========================================
      const { data: doctorProfile, error: doctorError } =
        await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", user.id)
          .single();

      if (doctorError || !doctorProfile) {
        setMessage("Unable to verify doctor account.");
        return;
      }

      if (doctorProfile.role !== "doctor") {
        if (doctorProfile.role === "patient") {
          router.push("/patient/dashboard");
          return;
        }

        router.push("/login");
        return;
      }

      // ==========================================
      // 3. GET SELECTED PATIENT
      // ==========================================
      const { data: patientData, error: patientError } =
        await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", patientId)
          .eq("role", "patient")
          .maybeSingle();

      if (patientError) {
        console.error(patientError);
        setMessage("Unable to load patient information.");
        return;
      }

      if (!patientData) {
        setMessage("Patient not found.");
        return;
      }

      setPatient(patientData);

      // ==========================================
      // 4. GET PATIENT DEVICE
      // ==========================================
      const { data: deviceData, error: deviceError } =
        await supabase
          .from("devices")
          .select(
            "id, device_code, device_name, total_doses, remaining_doses, status, last_sync"
          )
          .eq("patient_id", patientId)
          .limit(1)
          .maybeSingle();

      if (deviceError) {
        console.error(deviceError);
        setMessage("Unable to load patient device.");
        return;
      }

      setDevice(deviceData || null);

      // ==========================================
      // 5. GET PATIENT USAGE HISTORY
      // ==========================================
      const { data: usageData, error: usageError } =
        await supabase
          .from("inhaler_usage")
          .select(
            "id, sensor_value, activation_detected, remaining_doses, used_at"
          )
          .eq("patient_id", patientId)
          .order("used_at", { ascending: false })
          .limit(100);

      if (usageError) {
        console.error(usageError);
        setMessage("Unable to load patient usage history.");
        return;
      }

      setUsage(usageData || []);

      return true;
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while loading patient data.");
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // TODAY USAGE
  // ==========================================
  const todayUsage = useMemo(() => {
    const today = new Date();

    return usage.filter((item) => {
      if (!item.activation_detected) return false;

      const date = new Date(item.used_at);

      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    }).length;
  }, [usage]);

  // ==========================================
  // TOTAL USAGE
  // ==========================================
  const totalUsage = useMemo(() => {
    return usage.filter(
      (item) => item.activation_detected
    ).length;
  }, [usage]);

  // ==========================================
  // LAST USAGE
  // ==========================================
  const lastUsage = useMemo(() => {
    return usage.find(
      (item) => item.activation_detected
    );
  }, [usage]);

  // ==========================================
  // 7 DAY DATA
  // ==========================================
  const weeklyData = useMemo(() => {
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const start = new Date();

      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const count = usage.filter((item) => {
        const date = new Date(item.used_at);

        return (
          item.activation_detected &&
          date >= start &&
          date < end
        );
      }).length;

      result.push({
        day: start.toLocaleDateString("en-MY", {
          weekday: "short",
        }),
        count,
      });
    }

    return result;
  }, [usage]);

  const maxUsage = Math.max(
    ...weeklyData.map((item) => item.count),
    1
  );

  // ==========================================
  // DEVICE CONNECTION STATUS
  // Heartbeat every 3 seconds.
  // Offline after 8 seconds without heartbeat.
  // ==========================================
  const DEVICE_OFFLINE_AFTER = 8 * 1000;

  const isDeviceOnline = useMemo(() => {
    if (!device?.last_sync) {
      return false;
    }

    const lastSyncTime = new Date(device.last_sync).getTime();

    if (Number.isNaN(lastSyncTime)) {
      return false;
    }

    return currentTime - lastSyncTime <= DEVICE_OFFLINE_AFTER;
  }, [device?.last_sync, currentTime]);

  // ==========================================
  // PROTOTYPE REVIEW STATUS
  // ==========================================
  const needsReview =
    todayUsage >= 4 ||
    (device ? device.remaining_doses <= 20 : false);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Loading patient data...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <DoctorNav />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <p className="font-semibold text-red-400">
              {message}
            </p>

            <button
              onClick={() =>
                router.push("/doctor/dashboard")
              }
              className="mt-4 text-sm font-medium text-cyan-400"
            >
              Return to Doctor Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* PATIENT HEADER */}
            <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
                  Patient Monitoring
                </p>

                <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                  {patient?.full_name || "Patient"}
                </h1>

                <p className="mt-3 text-slate-400">
                  Smart inhaler monitoring and usage history.
                </p>
              </div>

              <div>
                <span
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    needsReview
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  {needsReview
                    ? "Needs Review"
                    : "Normal"}
                </span>
              </div>
            </section>

            {!device ? (
              <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
                <h2 className="text-xl font-semibold">
                  No smart inhaler assigned
                </h2>

                <p className="mt-2 text-slate-400">
                  This patient currently has no SIMS-Cloud device.
                </p>
              </section>
            ) : (
              <>
                {/* SUMMARY */}
                <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard
                    title="Today's Usage"
                    value={todayUsage.toString()}
                    subtitle="recorded activations"
                  />

                  <SummaryCard
                    title="Remaining Doses"
                    value={device.remaining_doses.toString()}
                    subtitle={`of ${device.total_doses} doses`}
                  />

                  <SummaryCard
                    title="Last Usage"
                    value={
                      lastUsage
                        ? formatTime(lastUsage.used_at)
                        : "No usage"
                    }
                    subtitle={
                      lastUsage
                        ? formatDate(lastUsage.used_at)
                        : "No record"
                    }
                  />

                  <SummaryCard
                    title="Total Usage"
                    value={totalUsage.toString()}
                    subtitle="available records"
                  />
                </section>

                {/* DEVICE + TREND */}
                <section className="mt-8 grid gap-6 lg:grid-cols-3">
                  {/* DEVICE */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <p className="text-sm text-slate-500">
                      Connected Device
                    </p>

                    <h2 className="mt-1 text-xl font-semibold">
                      {device.device_name ||
                        "SIMS Smart Inhaler"}
                    </h2>

                    <div className="mt-6 space-y-4">
                      <InfoRow
                        label="Device ID"
                        value={device.device_code}
                      />

                      <InfoRow
                        label="Status"
                        value={isDeviceOnline ? "Online" : "Offline"}
                        valueClassName={
                          isDeviceOnline
                            ? "text-emerald-400"
                            : "text-red-400"
                        }
                      />

                      <InfoRow
                        label="Total Capacity"
                        value={`${device.total_doses} doses`}
                      />

                      <InfoRow
                        label="Remaining"
                        value={`${device.remaining_doses} doses`}
                      />

                      <InfoRow
                        label="Last Sync"
                        value={
                          device.last_sync
                            ? formatDateTime(
                                device.last_sync
                              )
                            : "No sync"
                        }
                      />
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">
                          Dose Level
                        </span>

                        <span className="font-semibold text-cyan-400">
                          {device.remaining_doses} /{" "}
                          {device.total_doses}
                        </span>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                (device.remaining_doses /
                                  device.total_doses) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 7 DAY CHART */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">
                          Usage Analytics
                        </p>

                        <h2 className="mt-1 text-xl font-semibold">
                          7-Day Usage Trend
                        </h2>
                      </div>

                      <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
                        Last 7 Days
                      </span>
                    </div>

                    <div className="mt-8 flex h-56 items-end justify-between gap-3">
                      {weeklyData.map((item, index) => (
                        <UsageBar
                          key={`${item.day}-${index}`}
                          day={item.day}
                          value={item.count}
                          max={maxUsage}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* ALERT */}
                {needsReview && (
                  <section className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <p className="font-semibold text-amber-300">
                      Usage Pattern Review
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {todayUsage >= 4 &&
                      device.remaining_doses <= 20
                        ? "Higher inhaler usage and low estimated remaining doses have been detected."
                        : todayUsage >= 4
                        ? "Higher inhaler usage has been recorded today."
                        : "The estimated number of remaining inhaler doses is low."}
                    </p>
                  </section>
                )}

                {/* HISTORY */}
                <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm text-slate-500">
                        Patient Activity
                      </p>

                      <h2 className="mt-1 text-xl font-semibold">
                        Inhaler Usage History
                      </h2>
                    </div>

                    <button
                      onClick={loadPatient}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full min-w-[750px] text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-sm text-slate-500">
                          <th className="pb-4 font-medium">
                            Date
                          </th>

                          <th className="pb-4 font-medium">
                            Time
                          </th>

                          <th className="pb-4 font-medium">
                            Sensor Value
                          </th>

                          <th className="pb-4 font-medium">
                            Event
                          </th>

                          <th className="pb-4 font-medium">
                            Remaining
                          </th>
                        </tr>
                      </thead>

                      <tbody className="text-sm">
                        {usage.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-10 text-center text-slate-500"
                            >
                              No inhaler usage records
                              available.
                            </td>
                          </tr>
                        ) : (
                          usage.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-slate-800/70"
                            >
                              <td className="py-4 text-slate-300">
                                {formatDate(
                                  item.used_at
                                )}
                              </td>

                              <td className="py-4 text-white">
                                {formatTime(
                                  item.used_at
                                )}
                              </td>

                              <td className="py-4 text-slate-300">
                                {item.sensor_value ??
                                  "-"}
                              </td>

                              <td className="py-4">
                                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
                                  {item.activation_detected
                                    ? "Inhaler Used"
                                    : "Sensor Reading"}
                                </span>
                              </td>

                              <td className="py-4 text-slate-300">
                                {item.remaining_doses ??
                                  "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* DISCLAIMER */}
                <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
                  <p className="text-sm leading-6 text-amber-200">
                    SIMS-Cloud provides inhaler usage
                    monitoring information to support
                    healthcare review. Usage indicators are
                    not medical diagnoses.
                  </p>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-3xl font-bold text-white">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
      <span className="text-sm text-slate-400">
        {label}
      </span>

      <span className={`text-sm font-medium ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}

function UsageBar({
  day,
  value,
  max,
}: {
  day: string;
  value: number;
  max: number;
}) {
  const height =
    value === 0
      ? 4
      : Math.max(
          12,
          Math.round((value / max) * 100)
        );

  return (
    <div className="flex flex-1 flex-col items-center justify-end">
      <span className="mb-2 text-xs font-semibold text-cyan-400">
        {value}
      </span>

      <div className="flex h-40 w-full items-end justify-center">
        <div
          className="w-full max-w-10 rounded-t-lg bg-cyan-500"
          style={{
            height: `${height}%`,
          }}
        />
      </div>

      <span className="mt-3 text-xs text-slate-500">
        {day}
      </span>
    </div>
  );
}

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