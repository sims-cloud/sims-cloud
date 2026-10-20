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

type Usage = {
  id: number;
  activation_detected: boolean;
  remaining_doses: number | null;
  used_at: string;
};

type FilterType = "today" | "7days" | "30days" | "all";

export default function PatientHistoryPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [filter, setFilter] = useState<FilterType>("7days");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
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
          .limit(500);

      if (usageError) {
        console.error("Usage error:", usageError);
        setMessage("Unable to load inhaler usage history.");
        return;
      }

      setUsage(usageData || []);
    } catch (error) {
      console.error("History page error:", error);

      setMessage(
        "Something went wrong while loading usage history."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // VALID ACTIVATIONS
  // ==========================================
  const validUsage = useMemo(() => {
    return usage.filter(
      (item) => item.activation_detected
    );
  }, [usage]);

  // ==========================================
  // TODAY
  // ==========================================
  const todayUsage = useMemo(() => {
    const today = new Date();

    return validUsage.filter((item) => {
      const date = new Date(item.used_at);

      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
  }, [validUsage]);

  // ==========================================
  // LAST 7 DAYS
  // ==========================================
  const sevenDayUsage = useMemo(() => {
    const start = new Date();

    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    return validUsage.filter((item) => {
      return new Date(item.used_at) >= start;
    });
  }, [validUsage]);

  // ==========================================
  // LAST 30 DAYS
  // ==========================================
  const thirtyDayUsage = useMemo(() => {
    const start = new Date();

    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);

    return validUsage.filter((item) => {
      return new Date(item.used_at) >= start;
    });
  }, [validUsage]);

  // ==========================================
  // LAST USAGE
  // ==========================================
  const lastUsage =
    validUsage.length > 0
      ? validUsage[0]
      : null;

  // ==========================================
  // FILTERED TABLE DATA
  // ==========================================
  const filteredUsage = useMemo(() => {
    if (filter === "today") {
      return todayUsage;
    }

    if (filter === "7days") {
      return sevenDayUsage;
    }

    if (filter === "30days") {
      return thirtyDayUsage;
    }

    return validUsage;
  }, [
    filter,
    todayUsage,
    sevenDayUsage,
    thirtyDayUsage,
    validUsage,
  ]);

  // ==========================================
  // 7 DAY GRAPH
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

      const count = validUsage.filter((item) => {
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
  }, [validUsage]);

  const maxUsage = Math.max(
    ...weeklyData.map((item) => item.count),
    1
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
            Loading usage history...
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
            Usage History
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Review your recorded smart inhaler usage
            activity and recent usage patterns.
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
            SUMMARY CARDS
        ====================================== */}
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Today"
            value={todayUsage.length.toString()}
            subtitle="recorded activations"
          />

          <SummaryCard
            title="Last 7 Days"
            value={sevenDayUsage.length.toString()}
            subtitle="recorded activations"
          />

          <SummaryCard
            title="Last 30 Days"
            value={thirtyDayUsage.length.toString()}
            subtitle="recorded activations"
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
        </section>

        {/* ======================================
            7 DAY TREND
        ====================================== */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <p className="text-sm text-slate-500">
              Usage Pattern
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              Last 7 Days
            </h2>
          </div>

          <div className="mt-8 flex h-64 items-end justify-between gap-2 sm:gap-4">
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
        </section>

        {/* ======================================
            HISTORY TABLE
        ====================================== */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Inhaler Activity
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Usage Records
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Showing {filteredUsage.length} record
                {filteredUsage.length === 1 ? "" : "s"}
              </p>
            </div>

            {/* FILTER BUTTONS */}
            <div className="flex flex-wrap gap-2">
              <FilterButton
                label="Today"
                active={filter === "today"}
                onClick={() => setFilter("today")}
              />

              <FilterButton
                label="7 Days"
                active={filter === "7days"}
                onClick={() => setFilter("7days")}
              />

              <FilterButton
                label="30 Days"
                active={filter === "30days"}
                onClick={() => setFilter("30days")}
              />

              <FilterButton
                label="All"
                active={filter === "all"}
                onClick={() => setFilter("all")}
              />
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
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
                {filteredUsage.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center"
                    >
                      <p className="font-medium text-slate-400">
                        No usage records
                      </p>

                      <p className="mt-2 text-xs text-slate-600">
                        No inhaler activation was recorded
                        for the selected period.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsage.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-800/70 transition hover:bg-slate-800/20"
                    >
                      <td className="py-4 text-slate-300">
                        {formatDate(item.used_at)}
                      </td>

                      <td className="py-4 font-medium text-white">
                        {formatTime(item.used_at)}
                      </td>

                      <td className="py-4">
                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
                          Inhaler Used
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

        {/* ======================================
            INFORMATION
        ====================================== */}
        <section className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 font-bold text-cyan-400">
              i
            </div>

            <div>
              <p className="font-semibold text-cyan-300">
                About Your Usage History
              </p>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Each recorded activation represents an
                inhaler-use event received by SIMS-Cloud.
                These records can be used to review usage
                frequency and changes in usage patterns
                over time.
              </p>
            </div>
          </div>
        </section>

        {/* ======================================
            ACTIONS
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
              router.push("/patient/device")
            }
            className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            View My Device
          </button>
        </section>

        {/* ======================================
            DISCLAIMER
        ====================================== */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm leading-6 text-slate-400">
            SIMS-Cloud provides inhaler usage information
            for monitoring purposes. Usage records should
            not be interpreted as a diagnosis or used as
            a replacement for professional medical
            assessment or treatment advice.
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
// FILTER BUTTON
// ==========================================
function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-cyan-500 text-slate-950"
          : "border border-slate-700 bg-slate-950 text-slate-400 hover:border-cyan-500 hover:text-cyan-400"
      }`}
    >
      {label}
    </button>
  );
}

// ==========================================
// USAGE BAR
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

      <div className="flex h-40 w-full items-end justify-center">
        <div
          className="w-full max-w-12 rounded-t-lg bg-cyan-500 transition-all"
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