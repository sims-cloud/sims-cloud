"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DoctorNav from "@/app/components/DoctorNav";

type Patient = {
  id: string;
  full_name: string | null;
};

type Device = {
  id: string;
  patient_id: string;
  device_code: string;
};

type Usage = {
  id: number;
  device_id: string;
  patient_id: string;
  sensor_value: number | null;
  activation_detected: boolean;
  remaining_doses: number | null;
  used_at: string;
};

type UsageRow = Usage & {
  patientName: string;
  deviceCode: string;
};

export default function DoctorUsagePage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadUsage();
  }, []);

  async function loadUsage() {
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
      // CHECK DOCTOR
      // ==========================================
      const { data: doctorProfile, error: doctorError } =
        await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .single();

      if (doctorError || !doctorProfile) {
        setMessage("Unable to load doctor profile.");
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
      // GET ASSIGNED PATIENTS
      // ==========================================
      const { data: assignments, error: assignmentError } =
        await supabase
          .from("doctor_patients")
          .select("patient_id")
          .eq("doctor_id", user.id);

      if (assignmentError) {
        console.error(assignmentError);
        setMessage("Unable to load patient assignments.");
        return;
      }

      const patientIds =
        assignments?.map((item) => item.patient_id) || [];

      if (patientIds.length === 0) {
        setPatients([]);
        setDevices([]);
        setUsage([]);
        return;
      }

      // ==========================================
      // PATIENT PROFILES
      // ==========================================
      const { data: patientData, error: patientError } =
        await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", patientIds)
          .eq("role", "patient");

      if (patientError) {
        console.error(patientError);
        setMessage("Unable to load patients.");
        return;
      }

      // ==========================================
      // DEVICES
      // ==========================================
      const { data: deviceData, error: deviceError } =
        await supabase
          .from("devices")
          .select("id, patient_id, device_code")
          .in("patient_id", patientIds);

      if (deviceError) {
        console.error(deviceError);
        setMessage("Unable to load devices.");
        return;
      }

      // ==========================================
      // USAGE
      // ==========================================
      const { data: usageData, error: usageError } =
        await supabase
          .from("inhaler_usage")
          .select(
            "id, device_id, patient_id, sensor_value, activation_detected, remaining_doses, used_at"
          )
          .in("patient_id", patientIds)
          .eq("activation_detected", true)
          .order("used_at", { ascending: false });

      if (usageError) {
        console.error(usageError);
        setMessage("Unable to load inhaler usage.");
        return;
      }

      setPatients(patientData || []);
      setDevices(deviceData || []);
      setUsage(usageData || []);
    } catch (error) {
      console.error(error);
      setMessage(
        "Something went wrong while loading usage data."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // BUILD USAGE ROWS
  // ==========================================
  const usageRows = useMemo<UsageRow[]>(() => {
    return usage.map((item) => {
      const patient = patients.find(
        (p) => p.id === item.patient_id
      );

      const device = devices.find(
        (d) => d.id === item.device_id
      );

      return {
        ...item,
        patientName:
          patient?.full_name || "Unknown Patient",
        deviceCode:
          device?.device_code || "Unknown Device",
      };
    });
  }, [usage, patients, devices]);

  // ==========================================
  // FILTER
  // ==========================================
  const filteredUsage = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return usageRows.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.patientName
          .toLowerCase()
          .includes(keyword) ||
        item.deviceCode
          .toLowerCase()
          .includes(keyword);

      const usageDate = getLocalDateKey(item.used_at);

      const matchesDate =
        !dateFilter || usageDate === dateFilter;

      return matchesSearch && matchesDate;
    });
  }, [usageRows, search, dateFilter]);

  // ==========================================
  // TODAY USAGE
  // ==========================================
  const usageToday = useMemo(() => {
    const todayKey = getLocalDateKey(new Date());

    return usageRows.filter(
      (item) => getLocalDateKey(item.used_at) === todayKey
    ).length;
  }, [usageRows]);

  // ==========================================
  // LAST 7 DAYS
  // ==========================================
  const usageLast7Days = useMemo(() => {
    const now = new Date();

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    return usageRows.filter((item) => {
      const date = new Date(item.used_at);

      return date >= start && date <= now;
    }).length;
  }, [usageRows]);

  // ==========================================
  // PATIENTS WITH USAGE
  // ==========================================
  const activePatients = useMemo(() => {
    return new Set(
      usageRows.map((item) => item.patient_id)
    ).size;
  }, [usageRows]);

  // ==========================================
  // 7 DAY CHART DATA
  // ==========================================
  const chartData = useMemo(() => {
    const days: {
      key: string;
      label: string;
      count: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const key = getLocalDateKey(date);

      const count = usageRows.filter(
        (item) =>
          getLocalDateKey(item.used_at) === key
      ).length;

      days.push({
        key,
        label: date.toLocaleDateString("en-MY", {
          weekday: "short",
        }),
        count,
      });
    }

    return days;
  }, [usageRows]);

  const maxChartValue = Math.max(
    1,
    ...chartData.map((item) => item.count)
  );

  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Loading usage monitoring...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <DoctorNav />

      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* TITLE */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Inhaler Monitoring
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Usage Monitoring
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            Review inhaler activation records and usage
            patterns for assigned patients.
          </p>
        </section>

        {/* ERROR */}
        {message && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {message}
          </div>
        )}

        {/* SUMMARY */}
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Usage Today"
            value={usageToday.toString()}
            subtitle="recorded activations"
          />

          <SummaryCard
            title="Last 7 Days"
            value={usageLast7Days.toString()}
            subtitle="recorded activations"
          />

          <SummaryCard
            title="Patients With Usage"
            value={activePatients.toString()}
            subtitle={`of ${patients.length} assigned patients`}
          />

          <SummaryCard
            title="Total Records"
            value={usageRows.length.toString()}
            subtitle="available usage records"
          />
        </section>

        {/* 7 DAY TREND */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Usage Analytics
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                7-Day Usage Trend
              </h2>
            </div>

            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
              Last 7 Days
            </span>
          </div>

          <div className="mt-8 grid h-52 grid-cols-7 items-end gap-3">
            {chartData.map((item) => {
              const height =
                item.count === 0
                  ? 4
                  : Math.max(
                      12,
                      (item.count / maxChartValue) * 140
                    );

              return (
                <div
                  key={item.key}
                  className="flex h-full flex-col items-center justify-end"
                >
                  <span className="mb-2 text-sm font-semibold text-cyan-400">
                    {item.count}
                  </span>

                  <div
                    className="w-full max-w-[48px] rounded-t-lg bg-cyan-400/80 transition-all"
                    style={{
                      height: `${height}px`,
                    }}
                  />

                  <span className="mt-3 text-xs text-slate-500">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* USAGE HISTORY */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Patient Activity
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Inhaler Usage Records
              </h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              {/* SEARCH */}
              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search patient or device..."
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500"
              />

              {/* DATE */}
              <input
                type="date"
                value={dateFilter}
                onChange={(e) =>
                  setDateFilter(e.target.value)
                }
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-cyan-500"
              />

              {/* CLEAR */}
              {(search || dateFilter) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setDateFilter("");
                  }}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:border-slate-600 hover:text-white"
                >
                  Clear
                </button>
              )}

              {/* REFRESH */}
              <button
                onClick={loadUsage}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[950px] text-left">
              <thead>
                <tr className="border-b border-slate-800 text-sm text-slate-500">
                  <th className="pb-4 font-medium">
                    Patient
                  </th>

                  <th className="pb-4 font-medium">
                    Device
                  </th>

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

                  <th className="pb-4 font-medium">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsage.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-sm text-slate-500"
                    >
                      No inhaler usage records found.
                    </td>
                  </tr>
                ) : (
                  filteredUsage.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-800/70 text-sm"
                    >
                      <td className="py-4 font-medium text-white">
                        {item.patientName}
                      </td>

                      <td className="py-4 text-slate-400">
                        {item.deviceCode}
                      </td>

                      <td className="py-4 text-slate-300">
                        {formatDate(item.used_at)}
                      </td>

                      <td className="py-4 text-slate-300">
                        {formatTime(item.used_at)}
                      </td>

                      <td className="py-4 text-slate-300">
                        {item.sensor_value ?? "-"}
                      </td>

                      <td className="py-4">
                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
                          Inhaler Used
                        </span>
                      </td>

                      <td className="py-4 text-slate-300">
                        {item.remaining_doses ?? "-"}
                      </td>

                      <td className="py-4">
                        <button
                          onClick={() =>
                            router.push(
                              `/doctor/patient/${item.patient_id}`
                            )
                          }
                          className="font-medium text-cyan-400 hover:text-cyan-300"
                        >
                          View Patient
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-600">
            Showing {filteredUsage.length} of{" "}
            {usageRows.length} usage records.
          </p>
        </section>

        {/* DISCLAIMER */}
        <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <p className="text-sm leading-6 text-amber-200">
            SIMS-Cloud usage information supports patient
            monitoring and healthcare review. Usage records
            should not be interpreted as a medical diagnosis.
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

// ==========================================
// DATE HELPERS
// ==========================================
function getLocalDateKey(value: string | Date) {
  const date =
    typeof value === "string"
      ? new Date(value)
      : value;

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString(
    "en-MY",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}