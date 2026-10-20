"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DoctorNav from "@/app/components/DoctorNav";

type DoctorProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

export default function DoctorProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  // =========================
  // LOAD PROFILE
  // =========================
  async function loadProfile() {
    try {
      setLoading(true);
      setErrorMessage("");

      // =========================
      // GET CURRENT USER
      // =========================
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      setEmail(user.email || "");

      // =========================
      // GET PROFILE
      // =========================
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        console.error(error);
        setErrorMessage("Unable to load profile.");
        return;
      }

      // =========================
      // CHECK DOCTOR ROLE
      // =========================
      if (data.role !== "doctor") {
        if (data.role === "patient") {
          router.push("/patient/dashboard");
        } else {
          router.push("/login");
        }

        return;
      }

      setProfile(data);
      setFullName(data.full_name || "");
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "Something went wrong while loading your profile."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // SAVE PROFILE
  // =========================
  async function handleSaveProfile() {
    if (!profile) return;

    if (!fullName.trim()) {
      setErrorMessage("Full name cannot be empty.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
        })
        .eq("id", profile.id);

      if (error) {
        console.error(error);
        setErrorMessage("Unable to update profile.");
        return;
      }

      setProfile({
        ...profile,
        full_name: fullName.trim(),
      });

      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "Something went wrong while updating your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // CHANGE PASSWORD
  // =========================
  async function handleChangePassword() {
    if (!email) {
      setErrorMessage("Email address not found.");
      return;
    }

    try {
      setMessage("");
      setErrorMessage("");

      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });

      if (error) {
        console.error(error);

        setErrorMessage(
          "Unable to send password reset email."
        );

        return;
      }

      setMessage(
        "Password reset link has been sent to your email."
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "Something went wrong while sending the reset email."
      );
    }
  }

  // =========================
  // CANCEL EDIT
  // =========================
  function handleCancelEdit() {
    setFullName(profile?.full_name || "");
    setEditing(false);
    setErrorMessage("");
  }

  // =========================
  // LOADING
  // =========================
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
      <DoctorNav />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* PAGE TITLE */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Account Settings
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Doctor Profile
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            View and manage your SIMS-Cloud healthcare
            provider account.
          </p>
        </section>

        {/* SUCCESS MESSAGE */}
        {message && (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {message}
          </div>
        )}

        {/* ERROR MESSAGE */}
        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          {/* LEFT */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {/* AVATAR */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-2xl font-bold text-cyan-400">
                  {getInitials(
                    profile?.full_name || "Doctor"
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {profile?.full_name || "Doctor"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Healthcare Provider
                  </p>
                </div>
              </div>

              {!editing && (
                <button
                  onClick={() => {
                    setEditing(true);
                    setMessage("");
                    setErrorMessage("");
                  }}
                  className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-400 transition hover:bg-cyan-500/20"
                >
                  Edit Profile
                </button>
              )}
            </div>

            {/* DETAILS */}
            <div className="mt-8 space-y-6">
              {/* FULL NAME */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Full Name
                </label>

                {editing ? (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) =>
                      setFullName(e.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
                    placeholder="Enter full name"
                  />
                ) : (
                  <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                    {profile?.full_name || "-"}
                  </div>
                )}
              </div>

              {/* EMAIL */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Email Address
                </label>

                <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                  {email || "-"}
                </div>

                <p className="mt-2 text-xs text-slate-600">
                  Your login email is managed through
                  SIMS-Cloud authentication.
                </p>
              </div>

              {/* ROLE */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Account Role
                </label>

                <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                  <span className="text-sm text-slate-300">
                    Doctor
                  </span>

                  <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
                    Healthcare Provider
                  </span>
                </div>
              </div>

              {/* EDIT BUTTONS */}
              {editing && (
                <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : "Save Changes"}
                  </button>

                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT */}
          <div className="space-y-6">
            {/* ACCOUNT STATUS */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-500">
                Account Status
              </p>

              <div className="mt-4 flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                <div>
                  <p className="font-medium text-white">
                    Active
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Your healthcare provider account is
                    currently active.
                  </p>
                </div>
              </div>
            </section>

            {/* SECURITY */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-500">
                Security
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                Password
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Send a secure password reset link to your
                registered email address.
              </p>

              <button
                onClick={handleChangePassword}
                className="mt-5 w-full rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
              >
                Change Password
              </button>
            </section>

            {/* PORTAL INFO */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-slate-500">
                Portal Access
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                Doctor Portal
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Access patient monitoring, inhaler usage
                records and SIMS-Cloud alerts for patients
                assigned to your account.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

// =========================
// INITIALS
// =========================
function getInitials(name: string) {
  return name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}