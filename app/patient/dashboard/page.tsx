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
};

type Usage = {
  id: number;
  activation_detected: boolean;
  remaining_doses: number | null;
  used_at: string;
};

export default function PatientDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  // ==================================================
  // INITIAL LOAD + SUPABASE REALTIME
  // ==================================================
  useEffect(() => {
    let active = true;
    let usageChannel: ReturnType<typeof supabase.channel> | null = null;
    let deviceChannel: ReturnType<typeof supabase.channel> | null = null;

    async function setupDashboard() {
      const user = await loadDashboard();

      if (!user || !active) {
        return;
      }

      console.log("Starting SIMS-Cloud Realtime...");

      // ==========================================
      // REALTIME - NEW INHALER USAGE
      // ==========================================
      usageChannel = supabase
        .channel(`patient-usage-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "inhaler_usage",
            filter: `patient_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("New inhaler usage:", payload);

            const newUsage = payload.new as Usage;

            setUsage((currentUsage) => {
              const alreadyExists = currentUsage.some(
                (item) => item.id === newUsage.id
              );

              if (alreadyExists) {
                return currentUsage;
              }

              return [newUsage, ...currentUsage].slice(0, 100);
            });
          }
        )
        .subscribe((status) => {
          console.log("Usage Realtime:", status);
        });

      // ==========================================
      // REALTIME - DEVICE UPDATE
      // ==========================================
      deviceChannel = supabase
        .channel(`patient-device-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "devices",
            filter: `patient_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("Device updated:", payload);

            const updatedDevice = payload.new as Device;

            setDevice(updatedDevice);
          }
        )
        .subscribe((status) => {
          console.log("Device Realtime:", status);
        });
    }

    setupDashboard();

    // ==========================================
    // CLEANUP REALTIME
    // ==========================================
    return () => {
      active = false;

      if (usageChannel) {
        supabase.removeChannel(usageChannel);
      }

      if (deviceChannel) {
        supabase.removeChannel(deviceChannel);
      }
    };
  }, [router]);

  // ==================================================
  // DEVICE ONLINE / OFFLINE TIMER
  // ==================================================
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // ==================================================
  // LOAD DASHBOARD
  // ==================================================
  async function loadDashboard() {
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
        return null;
      }

      // ==========================================
      // GET PATIENT PROFILE
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
        return null;
      }

      // ==========================================
      // CHECK ROLE
      // ==========================================
      if (profileData.role === "doctor") {
        router.push("/doctor/dashboard");
        return null;
      }

      if (profileData.role !== "patient") {
        router.push("/login");
        return null;
      }

      setProfile(profileData);

      // ==========================================
      // GET PATIENT DEVICE
      // ==========================================
      const { data: deviceData, error: deviceError } =
        await supabase
          .from("devices")
          .select(
            "id, device_code, device_name, total_doses, remaining_doses, status, last_sync"
          )
          .eq("patient_id", user.id)
          .limit(1)
          .maybeSingle();

      if (deviceError) {
        console.error("Device error:", deviceError);
        setMessage("Unable to load smart inhaler device.");
        return null;
      }

      setDevice(deviceData || null);

      // ==========================================
      // GET USAGE HISTORY
      // ==========================================
      const { data: usageData, error: usageError } =
        await supabase
          .from("inhaler_usage")
          .select(
            "id, activation_detected, remaining_doses, used_at"
          )
          .eq("patient_id", user.id)
          .order("used_at", { ascending: false })
          .limit(100);

      if (usageError) {
        console.error("Usage error:", usageError);
        setMessage("Unable to load inhaler usage.");
        return null;
      }

      setUsage(usageData || []);

      return user;
    } catch (error) {
      console.error("Dashboard error:", error);

      setMessage(
        "Something went wrong while loading the dashboard."
      );

      return null;
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
  // LAST USAGE
  // ==========================================
  const lastUsage = useMemo(() => {
    return usage.find(
      (item) => item.activation_detected
    );
  }, [usage]);

  // ==========================================
  // TOTAL RECORDED USAGE
  // ==========================================
  const totalUsage = useMemo(() => {
    return usage.filter(
      (item) => item.activation_detected
    ).length;
  }, [usage]);

  // ==========================================
  // LAST 7 DAYS
  // ==========================================
  const weeklyData = useMemo(() => {
    const result: {
      day: string;
      date: string;
      count: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const start = new Date();

      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const count = usage.filter((item) => {
        if (!item.activation_detected) {
          return false;
        }

        const date = new Date(item.used_at);

        return date >= start && date < end;
      }).length;

      result.push({
        day: start.toLocaleDateString("en-MY", {
          weekday: "short",
        }),

        date: start.toLocaleDateString("en-MY", {
          day: "2-digit",
          month: "short",
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
  // DOSE LEVEL
  // ==========================================
  const dosePercentage = device
    ? Math.max(
        0,
        Math.min(
          100,
          device.total_doses > 0
            ? (device.remaining_doses /
                device.total_doses) *
              100
            : 0
        )
      )
    : 0;

  const lowDose: boolean =
    device !== null &&
    device.remaining_doses <= 20;

  // ==========================================
  // DEVICE CONNECTION STATUS
  // ==========================================
  const DEVICE_OFFLINE_AFTER = 8 * 1000;

  const isDeviceOnline = useMemo(() => {
    if (!device?.last_sync) {
      return false;
    }

    const lastSyncTime = new Date(
      device.last_sync
    ).getTime();

    if (Number.isNaN(lastSyncTime)) {
      return false;
    }

    return (
      currentTime - lastSyncTime <=
      DEVICE_OFFLINE_AFTER
    );
  }, [device?.last_sync, currentTime]);

  // ==========================================
  // LOADING SCREEN
  // ==========================================
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Loading patient dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <PatientNav />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* WELCOME */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Patient Dashboard
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Welcome, {profile?.full_name || "Patient"}
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Monitor your smart inhaler usage, estimated
            remaining doses and recent activity.
          </p>
        </section>

        {/* MESSAGE */}
        {message && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {message}
          </div>
        )}

        {/* NO DEVICE */}
        {!device ? (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-2xl font-bold text-slate-300">
              !
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              No Smart Inhaler Assigned
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
              Your SIMS-Cloud smart inhaler has not been
              linked to this patient account yet.
            </p>
          </section>
        ) : (
          <>
            {/* TOP CARDS */}
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
                warning={lowDose}
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
                title="Device Status"
                value={
                  isDeviceOnline
                    ? "Online"
                    : "Offline"
                }
                subtitle={device.device_code}
                success={isDeviceOnline}
              />
            </section>

            {/* LOW DOSE ALERT */}
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
                      Your inhaler is estimated to have only{" "}
                      {device.remaining_doses} doses remaining.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* DEVICE + 7 DAY TREND */}
            <section className="mt-8 grid gap-6 lg:grid-cols-3">
              {/* MY DEVICE */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">
                      My Device
                    </p>

                    <h2 className="mt-1 text-xl font-semibold">
                      {device.device_name ||
                        "SIMS Smart Inhaler"}
                    </h2>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isDeviceOnline
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {isDeviceOnline
                      ? "Online"
                      : "Offline"}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <InfoRow
                    label="Device ID"
                    value={device.device_code}
                  />

                  <InfoRow
                    label="Total Doses"
                    value={device.total_doses.toString()}
                  />

                  <InfoRow
                    label="Remaining"
                    value={device.remaining_doses.toString()}
                  />

                  <InfoRow
                    label="Last Sync"
                    value={
                      device.last_sync
                        ? formatDateTime(device.last_sync)
                        : "No sync"
                    }
                  />
                </div>

                {/* DOSE LEVEL */}
                <div className="mt-6">
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
                      {Math.round(dosePercentage)}%
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        lowDose
                          ? "bg-amber-400"
                          : "bg-cyan-400"
                      }`}
                      style={{
                        width: `${dosePercentage}%`,
                      }}
                    />
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    {device.remaining_doses} of{" "}
                    {device.total_doses} estimated doses
                    remaining
                  </p>
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
              </div>

              {/* LAST 7 DAYS */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      Usage Overview
                    </p>

                    <h2 className="mt-1 text-xl font-semibold">
                      Last 7 Days
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push("/patient/history")
                    }
                    className="w-fit rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
                  >
                    View History
                  </button>
                </div>

                <div className="mt-8 flex h-60 items-end justify-between gap-2 sm:gap-3">
                  {weeklyData.map((item) => (
                    <UsageBar
                      key={item.date}
                      day={item.day}
                      date={item.date}
                      value={item.count}
                      max={maxUsage}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* QUICK OVERVIEW */}
            <section className="mt-8 grid gap-5 md:grid-cols-3">
              <QuickCard
                title="Total Recorded Usage"
                value={totalUsage.toString()}
                description="Available activation records"
              />

              <QuickCard
                title="Smart Inhaler"
                value={device.device_code}
                description={
                  device.device_name ||
                  "SIMS Smart Inhaler"
                }
              />

              <QuickCard
                title="Estimated Dose Level"
                value={`${Math.round(dosePercentage)}%`}
                description={
                  lowDose
                    ? "Low remaining dose"
                    : "Dose level available"
                }
              />
            </section>

            {/* RECENT ACTIVITY */}
            <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    Recent Activity
                  </p>

                  <h2 className="mt-1 text-xl font-semibold">
                    Inhaler Usage
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push("/patient/history")
                  }
                  className="w-fit rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
                >
                  View All History
                </button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[650px] text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-sm text-slate-500">
                      <th className="pb-4 font-medium">
                        Date
                      </th>

                      <th className="pb-4 font-medium">
                        Time
                      </th>

                      <th className="pb-4 font-medium">
                        Activity
                      </th>

                      <th className="pb-4 font-medium">
                        Remaining Dose
                      </th>
                    </tr>
                  </thead>

                  <tbody className="text-sm">
                    {usage.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-10 text-center text-slate-500"
                        >
                          No inhaler usage history available.
                        </td>
                      </tr>
                    ) : (
                      usage.slice(0, 5).map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-800/70"
                        >
                          <td className="py-4 text-slate-300">
                            {formatDate(item.used_at)}
                          </td>

                          <td className="py-4 font-medium text-white">
                            {formatTime(item.used_at)}
                          </td>

                          <td className="py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                item.activation_detected
                                  ? "bg-cyan-500/10 text-cyan-400"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {item.activation_detected
                                ? "Inhaler Used"
                                : "Sensor Event"}
                            </span>
                          </td>

                          <td className="py-4 text-slate-300">
                            {item.remaining_doses ?? "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* DISCLAIMER */}
            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-sm leading-6 text-slate-400">
                SIMS-Cloud records smart inhaler usage to
                support monitoring of usage patterns and
                estimated remaining doses. The information
                displayed does not replace professional
                medical assessment or treatment advice.
              </p>
            </section>
          </>
        )}
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
  subtitle,
  warning = false,
  success = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  warning?: boolean;
  success?: boolean;
}) {
  let valueClass = "text-white";

  if (warning) {
    valueClass = "text-amber-400";
  } else if (success) {
    valueClass = "text-emerald-400";
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className={`mt-3 text-3xl font-bold ${valueClass}`}>
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {subtitle}
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
// QUICK CARD
// ==========================================
function QuickCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-2 break-words text-2xl font-bold text-white">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

// ==========================================
// 7 DAY BAR
// ==========================================
function UsageBar({
  day,
  date,
  value,
  max,
}: {
  day: string;
  date: string;
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
    <div className="flex min-w-0 flex-1 flex-col items-center justify-end">
      <span className="mb-2 text-xs font-semibold text-cyan-400">
        {value}
      </span>

      <div className="flex h-36 w-full items-end justify-center sm:h-40">
        <div
          className="w-full max-w-10 rounded-t-lg bg-cyan-500 transition-all"
          style={{
            height: `${height}%`,
          }}
        />
      </div>

      <span className="mt-3 text-[11px] font-medium text-slate-400 sm:text-xs">
        {day}
      </span>

      <span className="mt-1 hidden text-[10px] text-slate-600 sm:block">
        {date}
      </span>
    </div>
  );
}

// ==========================================
// DATE / TIME FORMAT
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