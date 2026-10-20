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
  device_name: string | null;
  remaining_doses: number;
  total_doses: number;
  status: string;
  last_sync: string | null;
};

type Usage = {
  id: number;
  patient_id: string;
  device_id: string;
  used_at: string;
  activation_detected: boolean;
};

type AlertItem = {
  id: string;
  patientId: string;
  patientName: string;
  deviceCode: string;
  type: "high_usage" | "low_dose" | "offline";
  title: string;
  description: string;
  severity: "warning" | "critical";
};

export default function DoctorAlertsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    let active = true;
    let usageChannel: ReturnType<typeof supabase.channel> | null = null;
    let deviceChannel: ReturnType<typeof supabase.channel> | null = null;

    async function setupAlerts() {
      const result = await loadAlerts();

      if (!result || !active) {
        return;
      }

      const { patientIds } = result;

      if (patientIds.length === 0) {
        return;
      }

      // Realtime: new inhaler usage
      usageChannel = supabase
        .channel("doctor-alerts-usage")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "inhaler_usage",
          },
          (payload) => {
            const newUsage = payload.new as Usage;

            if (
              !patientIds.includes(newUsage.patient_id) ||
              !newUsage.activation_detected
            ) {
              return;
            }

            setUsage((currentUsage) => {
              const exists = currentUsage.some(
                (item) => item.id === newUsage.id
              );

              if (exists) {
                return currentUsage;
              }

              return [newUsage, ...currentUsage];
            });
          }
        )
        .subscribe();

      // Realtime: heartbeat / dose / device updates
      deviceChannel = supabase
        .channel("doctor-alerts-devices")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "devices",
          },
          (payload) => {
            const updatedDevice = payload.new as Device;

            if (!patientIds.includes(updatedDevice.patient_id)) {
              return;
            }

            setDevices((currentDevices) =>
              currentDevices.map((device) =>
                device.id === updatedDevice.id
                  ? updatedDevice
                  : device
              )
            );
          }
        )
        .subscribe();
    }

    setupAlerts();

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

  // Re-check stale heartbeat every second.
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  async function loadAlerts() {
    try {
      setLoading(true);
      setMessage("");

      // ==============================
      // CHECK LOGIN
      // ==============================
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // ==============================
      // CHECK DOCTOR ROLE
      // ==============================
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
        } else {
          router.push("/login");
        }

        return;
      }

      // ==============================
      // GET ASSIGNED PATIENTS
      // ==============================
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
        return { patientIds };
      }

      // ==============================
      // GET PATIENTS
      // ==============================
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

      // ==============================
      // GET DEVICES
      // ==============================
      const { data: deviceData, error: deviceError } =
        await supabase
          .from("devices")
          .select(
            "id, patient_id, device_code, device_name, remaining_doses, total_doses, status, last_sync"
          )
          .in("patient_id", patientIds);

      if (deviceError) {
        console.error(deviceError);
        setMessage("Unable to load devices.");
        return;
      }

      // ==============================
      // GET USAGE
      // ==============================
      const { data: usageData, error: usageError } =
        await supabase
          .from("inhaler_usage")
          .select(
            "id, patient_id, device_id, used_at, activation_detected"
          )
          .in("patient_id", patientIds)
          .eq("activation_detected", true)
          .order("used_at", { ascending: false });

      if (usageError) {
        console.error(usageError);
        setMessage("Unable to load usage data.");
        return;
      }

      setPatients(patientData || []);
      setDevices(deviceData || []);
      setUsage(usageData || []);

      return { patientIds };
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while loading alerts.");
    } finally {
      setLoading(false);
    }
  }

  // ==============================
  // DEVICE CONNECTION STATUS
  // Heartbeat every 3 seconds.
  // Offline after 8 seconds without heartbeat.
  // ==============================
  const DEVICE_OFFLINE_AFTER = 8 * 1000;

  function isDeviceOnline(device: Device) {
    if (!device.last_sync) {
      return false;
    }

    const lastSyncTime = new Date(device.last_sync).getTime();

    if (Number.isNaN(lastSyncTime)) {
      return false;
    }

    return currentTime - lastSyncTime <= DEVICE_OFFLINE_AFTER;
  }

  // ==============================
  // BUILD ALERTS
  // ==============================
  const alerts = useMemo<AlertItem[]>(() => {
    const result: AlertItem[] = [];

    const today = getLocalDateKey(new Date());

    patients.forEach((patient) => {
      const patientName =
        patient.full_name || "Unknown Patient";

      const patientDevices = devices.filter(
        (device) => device.patient_id === patient.id
      );

      const todayUsage = usage.filter(
        (item) =>
          item.patient_id === patient.id &&
          getLocalDateKey(item.used_at) === today
      ).length;

      // ==============================
      // HIGH USAGE ALERT
      // ==============================
      if (todayUsage >= 4) {
        const firstDevice = patientDevices[0];

        result.push({
          id: `high-${patient.id}`,
          patientId: patient.id,
          patientName,
          deviceCode:
            firstDevice?.device_code || "No device",
          type: "high_usage",
          title: "High Inhaler Usage",
          description: `${todayUsage} inhaler activations have been recorded today.`,
          severity: "critical",
        });
      }

      patientDevices.forEach((device) => {
        // ==============================
        // LOW DOSE ALERT
        // ==============================
        if (device.remaining_doses <= 20) {
          result.push({
            id: `dose-${device.id}`,
            patientId: patient.id,
            patientName,
            deviceCode: device.device_code,
            type: "low_dose",
            title: "Low Remaining Doses",
            description: `Only ${device.remaining_doses} of ${device.total_doses} doses remain.`,
            severity:
              device.remaining_doses <= 10
                ? "critical"
                : "warning",
          });
        }

        // ==============================
        // OFFLINE ALERT
        // ==============================
        if (!isDeviceOnline(device)) {
          result.push({
            id: `offline-${device.id}`,
            patientId: patient.id,
            patientName,
            deviceCode: device.device_code,
            type: "offline",
            title: "Device Offline",
            description: device.last_sync
              ? `Device has been offline. Last sync: ${formatDateTime(
                  device.last_sync
                )}.`
              : "Device is currently offline and has no recorded sync time.",
            severity: "warning",
          });
        }
      });
    });

    // Critical alerts first
    return result.sort((a, b) => {
      if (
        a.severity === "critical" &&
        b.severity !== "critical"
      ) {
        return -1;
      }

      if (
        a.severity !== "critical" &&
        b.severity === "critical"
      ) {
        return 1;
      }

      return 0;
    });
  }, [patients, devices, usage, currentTime]);

  const criticalCount = alerts.filter(
    (item) => item.severity === "critical"
  ).length;

  const warningCount = alerts.filter(
    (item) => item.severity === "warning"
  ).length;

  const affectedPatients = new Set(
    alerts.map((item) => item.patientId)
  ).size;

  // ==============================
  // LOADING
  // ==============================
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Loading alerts...
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
            Patient Monitoring
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Alerts
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            Review inhaler usage and device conditions that
            may require attention.
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
            title="Active Alerts"
            value={alerts.length}
            subtitle="requiring review"
          />

          <SummaryCard
            title="Critical"
            value={criticalCount}
            subtitle="higher priority"
          />

          <SummaryCard
            title="Warnings"
            value={warningCount}
            subtitle="monitor closely"
          />

          <SummaryCard
            title="Affected Patients"
            value={affectedPatients}
            subtitle={`of ${patients.length} assigned patients`}
          />
        </section>

        {/* ALERT LIST */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Monitoring Centre
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Active Patient Alerts
              </h2>
            </div>

            <button
              onClick={loadAlerts}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
            >
              Refresh
            </button>
          </div>

          {/* NO ALERTS */}
          {alerts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-12 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-400">
                ✓
              </div>

              <h3 className="mt-4 text-lg font-semibold text-white">
                No Active Alerts
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                No high usage, low-dose or offline device
                alerts are currently detected for your
                assigned patients.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-2xl border p-5 ${
                    alert.severity === "critical"
                      ? "border-red-500/25 bg-red-500/5"
                      : "border-amber-500/25 bg-amber-500/5"
                  }`}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                    <div className="flex gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
                          alert.severity === "critical"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {getAlertIcon(alert.type)}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-white">
                            {alert.title}
                          </h3>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                              alert.severity === "critical"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-300">
                          {alert.patientName}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Device: {alert.deviceCode}
                        </p>

                        <p className="mt-3 text-sm leading-6 text-slate-400">
                          {alert.description}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        router.push(
                          `/doctor/patient/${alert.patientId}`
                        )
                      }
                      className="shrink-0 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      View Patient
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ALERT RULES */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-500">
            Alert Rules
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            Monitoring Criteria
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <RuleCard
              title="High Usage"
              description="4 or more inhaler activations recorded within the current day."
            />

            <RuleCard
              title="Low Dose"
              description="20 or fewer doses remaining in the connected inhaler."
            />

            <RuleCard
              title="Device Offline"
              description="No device heartbeat has been received for more than 8 seconds."
            />
          </div>
        </section>

        {/* DISCLAIMER */}
        <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <p className="text-sm leading-6 text-amber-200">
            Alerts are generated from SIMS-Cloud monitoring
            rules to support healthcare review. They do not
            represent a medical diagnosis or emergency
            assessment.
          </p>
        </section>
      </div>
    </main>
  );
}

// ==============================
// SUMMARY CARD
// ==============================
function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
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

// ==============================
// RULE CARD
// ==============================
function RuleCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <h3 className="font-medium text-white">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

// ==============================
// ICON
// ==============================
function getAlertIcon(
  type: AlertItem["type"]
) {
  if (type === "high_usage") {
    return "!";
  }

  if (type === "low_dose") {
    return "↓";
  }

  return "×";
}

// ==============================
// DATE HELPERS
// ==============================
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