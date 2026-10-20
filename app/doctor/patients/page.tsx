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
  activation_detected: boolean;
  used_at: string;
};

type PatientRow = {
  id: string;
  name: string;
  deviceCode: string;
  deviceName: string;
  remainingDoses: number | null;
  totalDoses: number | null;
  status: string;
  totalUsage: number;
  lastUsage: string | null;
};

export default function DoctorPatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
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
      // CHECK DOCTOR PROFILE
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
      // GET ASSIGNED PATIENT IDS
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
      // GET PATIENT PROFILES
      // ==========================================
      const { data: patientData, error: patientError } =
        await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", patientIds)
          .eq("role", "patient")
          .order("full_name", { ascending: true });

      if (patientError) {
        console.error(patientError);
        setMessage("Unable to load patient information.");
        return;
      }

      // ==========================================
      // GET DEVICES
      // ==========================================
      const { data: deviceData, error: deviceError } =
        await supabase
          .from("devices")
          .select(
            "id, patient_id, device_code, device_name, remaining_doses, total_doses, status, last_sync"
          )
          .in("patient_id", patientIds);

      if (deviceError) {
        console.error(deviceError);
        setMessage("Unable to load patient devices.");
        return;
      }

      // ==========================================
      // GET USAGE
      // ==========================================
      const { data: usageData, error: usageError } =
        await supabase
          .from("inhaler_usage")
          .select(
            "id, patient_id, activation_detected, used_at"
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
      setMessage("Something went wrong while loading patients.");
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // BUILD PATIENT ROWS
  // ==========================================
  const patientRows = useMemo<PatientRow[]>(() => {
    return patients.map((patient) => {
      const device = devices.find(
        (item) => item.patient_id === patient.id
      );

      const patientUsage = usage.filter(
        (item) => item.patient_id === patient.id
      );

      return {
        id: patient.id,
        name: patient.full_name || "Unnamed Patient",

        deviceCode:
          device?.device_code || "Not assigned",

        deviceName:
          device?.device_name || "No device",

        remainingDoses:
          device?.remaining_doses ?? null,

        totalDoses:
          device?.total_doses ?? null,

        status:
          device?.status || "No device",

        totalUsage:
          patientUsage.length,

        lastUsage:
          patientUsage.length > 0
            ? patientUsage[0].used_at
            : null,
      };
    });
  }, [patients, devices, usage]);

  // ==========================================
  // SEARCH
  // ==========================================
  const filteredPatients = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return patientRows;
    }

    return patientRows.filter((patient) => {
      return (
        patient.name.toLowerCase().includes(keyword) ||
        patient.deviceCode.toLowerCase().includes(keyword)
      );
    });
  }, [patientRows, search]);

  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Loading patients...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <DoctorNav />

      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* PAGE TITLE */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Patient Management
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            My Patients
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            View assigned patients, connected inhaler devices
            and recent usage information.
          </p>
        </section>

        {/* ERROR */}
        {message && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {message}
          </div>
        )}

        {/* SUMMARY */}
        <section className="mt-8 grid gap-5 sm:grid-cols-3">
          <SummaryCard
            title="Assigned Patients"
            value={patients.length.toString()}
            subtitle="patients under your care"
          />

          <SummaryCard
            title="Connected Devices"
            value={devices.length.toString()}
            subtitle="registered inhalers"
          />

          <SummaryCard
            title="Online Devices"
            value={devices
              .filter((device) => device.status === "online")
              .length.toString()}
            subtitle="currently online"
          />
        </section>

        {/* PATIENT LIST */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Patient Directory
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
                placeholder="Search patient or device..."
                className="min-w-[240px] rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500"
              />

              <button
                onClick={loadPatients}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* EMPTY */}
          {filteredPatients.length === 0 ? (
            <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950/50 px-6 py-12 text-center">
              <p className="font-medium text-slate-300">
                No patients found
              </p>

              <p className="mt-2 text-sm text-slate-500">
                No patients are currently assigned to this doctor.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 transition hover:border-slate-700"
                >
                  {/* NAME */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {patient.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {patient.deviceCode}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        patient.status === "online"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {patient.status}
                    </span>
                  </div>

                  {/* DEVICE */}
                  <div className="mt-5 space-y-3 border-t border-slate-800 pt-5">

                    <InfoRow
                      label="Device"
                      value={patient.deviceName}
                    />

                    <InfoRow
                      label="Remaining Doses"
                      value={
                        patient.remainingDoses !== null &&
                        patient.totalDoses !== null
                          ? `${patient.remainingDoses} / ${patient.totalDoses}`
                          : "-"
                      }
                    />

                    <InfoRow
                      label="Total Usage"
                      value={patient.totalUsage.toString()}
                    />

                    <InfoRow
                      label="Last Usage"
                      value={
                        patient.lastUsage
                          ? formatDateTime(patient.lastUsage)
                          : "No usage"
                      }
                    />
                  </div>

                  {/* BUTTON */}
                  <button
                    onClick={() =>
                      router.push(
                        `/doctor/patient/${patient.id}`
                      )
                    }
                    className="mt-6 w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    View Patient
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* DISCLAIMER */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4">
          <p className="text-sm leading-6 text-slate-500">
            Patient inhaler usage information is provided to
            support monitoring and healthcare review.
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
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="text-right text-sm font-medium text-slate-300">
        {value}
      </span>
    </div>
  );
}

// ==========================================
// DATE FORMAT
// ==========================================
function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}