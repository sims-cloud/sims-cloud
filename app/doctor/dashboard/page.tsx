"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  patient_id: string;
  device_name: string | null;
  total_doses: number;
  remaining_doses: number;
  status: string;
  last_sync: string | null;
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

type PatientRow = {
  patientId: string;
  fullName: string;
  deviceCode: string;
  todayUsage: number;
  remainingDoses: number;
  lastUsage: string | null;
  deviceStatus: string;
  review: boolean;
};

export default function DoctorDashboard() {
  const router = useRouter();

  const [doctor, setDoctor] = useState<Profile | null>(null);
  const [patients, setPatients] = useState<Profile[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  // ==================================================
  // INITIAL LOAD + SUPABASE REALTIME
  // ==================================================
  useEffect(() => {
    let active = true;

    let usageChannel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    let deviceChannel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    async function setupDashboard() {
      const result = await loadDashboard();

      if (!result || !active) {
        return;
      }

      const { patientIds } = result;

      if (patientIds.length === 0) {
        return;
      }

      console.log("Starting Doctor Realtime...");

      // ==========================================
      // REALTIME - NEW INHALER USAGE
      // ==========================================
      usageChannel = supabase
        .channel("doctor-inhaler-usage")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "inhaler_usage",
          },
          (payload) => {
            const newUsage = payload.new as Usage;

            console.log(
              "Doctor received new usage:",
              newUsage
            );

            // Only update if patient belongs to this doctor
            if (!patientIds.includes(newUsage.patient_id)) {
              return;
            }

            setUsage((currentUsage) => {
              const exists = currentUsage.some(
                (item) => item.id === newUsage.id
              );

              if (exists) {
                return currentUsage;
              }

              return [newUsage, ...currentUsage].slice(
                0,
                500
              );
            });
          }
        )
        .subscribe((status) => {
          console.log(
            "Doctor Usage Realtime:",
            status
          );
        });

      // ==========================================
      // REALTIME - DEVICE UPDATE
      // ==========================================
      deviceChannel = supabase
        .channel("doctor-device-update")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "devices",
          },
          (payload) => {
            const updatedDevice = payload.new as Device;

            console.log(
              "Doctor received device update:",
              updatedDevice
            );

            // Only update assigned patient
            if (
              !patientIds.includes(
                updatedDevice.patient_id
              )
            ) {
              return;
            }

            setDevices((currentDevices) => {
              const exists = currentDevices.some(
                (item) =>
                  item.id === updatedDevice.id
              );

              if (!exists) {
                return [
                  ...currentDevices,
                  updatedDevice,
                ];
              }

              return currentDevices.map((item) =>
                item.id === updatedDevice.id
                  ? updatedDevice
                  : item
              );
            });
          }
        )
        .subscribe((status) => {
          console.log(
            "Doctor Device Realtime:",
            status
          );
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
      // 1. CHECK CURRENT LOGIN
      // ==========================================
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return null;
      }

      // ==========================================
      // 2. GET DOCTOR PROFILE
      // ==========================================
      const {
        data: doctorProfile,
        error: doctorError,
      } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (doctorError || !doctorProfile) {
        console.error(
          "Doctor profile error:",
          doctorError
        );

        setMessage(
          "Unable to load doctor profile."
        );

        return null;
      }

      // ==========================================
      // 3. MAKE SURE USER IS DOCTOR
      // ==========================================
      if (doctorProfile.role !== "doctor") {
        if (doctorProfile.role === "patient") {
          router.push("/patient/dashboard");
          return null;
        }

        router.push("/login");
        return null;
      }

      setDoctor(doctorProfile);

      // ==========================================
      // 4. GET PATIENT ASSIGNMENTS
      // ==========================================
      const {
        data: assignments,
        error: assignmentError,
      } = await supabase
        .from("doctor_patients")
        .select("patient_id")
        .eq("doctor_id", user.id);

      if (assignmentError) {
        console.error(
          "Assignment error:",
          assignmentError
        );

        setMessage(
          "Unable to load assigned patients."
        );

        return null;
      }

      const patientIds =
        assignments?.map(
          (item) => item.patient_id
        ) || [];

      // ==========================================
      // 5. GET ASSIGNED PATIENT PROFILES
      // ==========================================
      let patientData: Profile[] = [];

      if (patientIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("id", patientIds)
          .eq("role", "patient")
          .order("full_name", {
            ascending: true,
          });

        if (error) {
          console.error(
            "Patient profile error:",
            error
          );

          setMessage(
            "Unable to load patient profiles."
          );

          return null;
        }

        patientData = data || [];
      }

      // ==========================================
      // 6. GET DEVICES
      // ==========================================
      let deviceData: Device[] = [];

      if (patientIds.length > 0) {
        const { data, error } = await supabase
          .from("devices")
          .select(
            "id, device_code, patient_id, device_name, total_doses, remaining_doses, status, last_sync"
          )
          .in("patient_id", patientIds)
          .order("device_code", {
            ascending: true,
          });

        if (error) {
          console.error(
            "Device error:",
            error
          );

          setMessage(
            "Unable to load devices."
          );

          return null;
        }

        deviceData = data || [];
      }

      // ==========================================
      // 7. GET USAGE
      // ==========================================
      let usageData: Usage[] = [];

      if (patientIds.length > 0) {
        const { data, error } = await supabase
          .from("inhaler_usage")
          .select(
            "id, device_id, patient_id, sensor_value, activation_detected, remaining_doses, used_at"
          )
          .in("patient_id", patientIds)
          .order("used_at", {
            ascending: false,
          })
          .limit(500);

        if (error) {
          console.error(
            "Usage error:",
            error
          );

          setMessage(
            "Unable to load inhaler usage."
          );

          return null;
        }

        usageData = data || [];
      }

      setPatients(patientData);
      setDevices(deviceData);
      setUsage(usageData);

      return {
        user,
        patientIds,
      };
    } catch (error) {
      console.error(
        "Dashboard error:",
        error
      );

      setMessage(
        "Something went wrong while loading dashboard."
      );

      return null;
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // DEVICE CONNECTION STATUS
  // Heartbeat every 3 seconds.
  // Consider device offline after 8 seconds.
  // ==========================================
  const DEVICE_OFFLINE_AFTER = 8 * 1000;

  function isDeviceOnline(device: Device | undefined) {
    if (!device?.last_sync) {
      return false;
    }

    const lastSyncTime = new Date(device.last_sync).getTime();

    if (Number.isNaN(lastSyncTime)) {
      return false;
    }

    return currentTime - lastSyncTime <= DEVICE_OFFLINE_AFTER;
  }

  // ==========================================
  // BUILD PATIENT TABLE
  // ==========================================
  const patientRows =
    useMemo<PatientRow[]>(() => {
      const today = new Date();

      return patients.map((patient) => {
        const device = devices.find(
          (item) =>
            item.patient_id === patient.id
        );

        const patientUsage = usage.filter(
          (item) =>
            item.patient_id === patient.id &&
            item.activation_detected
        );

        const todayUsage =
          patientUsage.filter((item) => {
            const date = new Date(
              item.used_at
            );

            return (
              date.getFullYear() ===
                today.getFullYear() &&
              date.getMonth() ===
                today.getMonth() &&
              date.getDate() ===
                today.getDate()
            );
          }).length;

        const lastUsage =
          patientUsage.length > 0
            ? patientUsage[0].used_at
            : null;

        const remainingDoses =
          device?.remaining_doses ?? 0;

        const review =
          todayUsage >= 4 ||
          (device
            ? device.remaining_doses <= 20
            : false);

        return {
          patientId: patient.id,
          fullName:
            patient.full_name ||
            "Unnamed Patient",

          deviceCode:
            device?.device_code ||
            "Not assigned",

          todayUsage,
          remainingDoses,
          lastUsage,

          deviceStatus:
            !device
              ? "No device"
              : isDeviceOnline(device)
                ? "online"
                : "offline",

          review,
        };
      });
    }, [patients, devices, usage, currentTime]);

  // ==========================================
  // SEARCH
  // ==========================================
  const filteredPatients = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    if (!keyword) {
      return patientRows;
    }

    return patientRows.filter(
      (patient) => {
        return (
          patient.fullName
            .toLowerCase()
            .includes(keyword) ||
          patient.deviceCode
            .toLowerCase()
            .includes(keyword)
        );
      }
    );
  }, [patientRows, search]);

  // ==========================================
  // SUMMARY DATA
  // ==========================================
  const activeDevices = devices.filter(
    (device) => isDeviceOnline(device)
  ).length;

  const totalUsageToday = useMemo(() => {
    const today = new Date();

    return usage.filter((item) => {
      if (!item.activation_detected) {
        return false;
      }

      const date = new Date(
        item.used_at
      );

      return (
        date.getFullYear() ===
          today.getFullYear() &&
        date.getMonth() ===
          today.getMonth() &&
        date.getDate() ===
          today.getDate()
      );
    }).length;
  }, [usage]);

  const reviewCount =
    patientRows.filter(
      (patient) => patient.review
    ).length;

  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Loading doctor dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <DoctorNav />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* WELCOME */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Doctor Dashboard
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Welcome,{" "}
            {doctor?.full_name || "Doctor"}
          </h1>

          <p className="mt-3 text-slate-400">
            Monitor assigned patient inhaler
            usage, connected devices and usage
            patterns.
          </p>
        </section>

        {/* ERROR MESSAGE */}
        {message && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {message}
          </div>
        )}

        {/* SUMMARY CARDS */}
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Assigned Patients"
            value={patients.length.toString()}
            subtitle="patients under your care"
          />

          <SummaryCard
            title="Active Devices"
            value={activeDevices.toString()}
            subtitle={`${devices.length} total devices`}
          />

          <SummaryCard
            title="Usage Today"
            value={totalUsageToday.toString()}
            subtitle="recorded activations"
          />

          <SummaryCard
            title="Needs Review"
            value={reviewCount.toString()}
            subtitle="monitoring alerts"
            warning={reviewCount > 0}
          />
        </section>

        {/* PATIENT OVERVIEW */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Patient Monitoring
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Assigned Patients
              </h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search patient..."
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500"
              />

              <button
                onClick={loadDashboard}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-slate-800 text-sm text-slate-500">
                  <th className="pb-4 font-medium">
                    Patient
                  </th>

                  <th className="pb-4 font-medium">
                    Device
                  </th>

                  <th className="pb-4 font-medium">
                    Today
                  </th>

                  <th className="pb-4 font-medium">
                    Remaining
                  </th>

                  <th className="pb-4 font-medium">
                    Last Usage
                  </th>

                  <th className="pb-4 font-medium">
                    Device Status
                  </th>

                  <th className="pb-4 font-medium">
                    Review
                  </th>

                  <th className="pb-4 font-medium">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredPatients.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      No assigned patient found.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map(
                    (patient) => (
                      <tr
                        key={
                          patient.patientId
                        }
                        className="border-b border-slate-800/70 text-sm"
                      >
                        <td className="py-4 font-medium text-white">
                          {patient.fullName}
                        </td>

                        <td className="py-4 text-slate-400">
                          {patient.deviceCode}
                        </td>

                        <td className="py-4 text-white">
                          {patient.todayUsage}
                        </td>

                        <td className="py-4 text-slate-300">
                          {patient.deviceCode ===
                          "Not assigned"
                            ? "-"
                            : patient.remainingDoses}
                        </td>

                        <td className="py-4 text-slate-300">
                          {patient.lastUsage
                            ? formatDateTime(
                                patient.lastUsage
                              )
                            : "No usage"}
                        </td>

                        <td className="py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              patient.deviceStatus ===
                              "online"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : patient.deviceStatus ===
                                    "offline"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            {
                              patient.deviceStatus
                            }
                          </span>
                        </td>

                        <td className="py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              patient.review
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-emerald-500/10 text-emerald-400"
                            }`}
                          >
                            {patient.review
                              ? "Review"
                              : "Normal"}
                          </span>
                        </td>

                        <td className="py-4">
                          <button
                            onClick={() =>
                              router.push(
                                `/doctor/patient/${patient.patientId}`
                              )
                            }
                            className="font-medium text-cyan-400 hover:text-cyan-300"
                          >
                            View Patient
                          </button>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* LOWER SECTION */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* ALERTS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-500">
              Monitoring Alerts
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              Usage Pattern Review
            </h2>

            <div className="mt-6 space-y-4">
              {patientRows.filter(
                (patient) => patient.review
              ).length === 0 ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="font-medium text-emerald-400">
                    No alerts
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    No assigned patients
                    currently meet the monitoring
                    review threshold.
                  </p>
                </div>
              ) : (
                patientRows
                  .filter(
                    (patient) =>
                      patient.review
                  )
                  .map((patient) => (
                    <div
                      key={
                        patient.patientId
                      }
                      className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
                    >
                      <p className="font-medium text-amber-300">
                        {patient.fullName}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {patient.todayUsage >=
                        4
                          ? "Higher inhaler usage recorded today."
                          : "Estimated remaining doses are low."}
                      </p>

                      <button
                        onClick={() =>
                          router.push(
                            `/doctor/patient/${patient.patientId}`
                          )
                        }
                        className="mt-3 text-sm font-medium text-cyan-400 hover:text-cyan-300"
                      >
                        View Patient
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* SYSTEM OVERVIEW */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-500">
              SIMS-Cloud
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              System Overview
            </h2>

            <div className="mt-6 space-y-5">
              <SystemRow
                label="Assigned Patients"
                value={patients.length.toString()}
              />

              <SystemRow
                label="Connected Devices"
                value={devices.length.toString()}
              />

              <SystemRow
                label="Online Devices"
                value={activeDevices.toString()}
              />

              <SystemRow
                label="Usage Records Today"
                value={totalUsageToday.toString()}
              />
            </div>
          </div>
        </section>

        {/* DISCLAIMER */}
        <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <p className="text-sm leading-6 text-amber-200">
            SIMS-Cloud provides inhaler usage
            monitoring information to support
            healthcare review. Monitoring alerts
            are not medical diagnoses.
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
  warning = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p
        className={`mt-3 text-3xl font-bold ${
          warning
            ? "text-amber-400"
            : "text-white"
        }`}
      >
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

// ==========================================
// SYSTEM ROW
// ==========================================
function SystemRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
      <span className="text-sm text-slate-400">
        {label}
      </span>

      <span className="text-sm font-semibold text-cyan-400">
        {value}
      </span>
    </div>
  );
}

// ==========================================
// DATE FORMAT
// ==========================================
function formatDateTime(
  dateString: string
) {
  return new Date(
    dateString
  ).toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}