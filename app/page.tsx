import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}
      <header className="border-b border-slate-800/80 bg-slate-950/95">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-8">
          
          {/* LOGO */}
          <Link href="/" className="flex items-center">
            <Image
              src="/sims-cloud-logo.png"
              alt="SIMS-Cloud Smart Inhaler System"
              width={330}
              height={110}
              priority
              className="h-auto w-[220px] object-contain md:w-[270px]"
            />
          </Link>

          {/* MENU */}
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#home"
              className="text-sm text-slate-300 transition hover:text-cyan-400"
            >
              Home
            </a>

            <a
              href="#features"
              className="text-sm text-slate-300 transition hover:text-cyan-400"
            >
              Features
            </a>

            <a
              href="#about"
              className="text-sm text-slate-300 transition hover:text-cyan-400"
            >
              About
            </a>

            <a
              href="#contact"
              className="text-sm text-slate-300 transition hover:text-cyan-400"
            >
              Contact
            </a>
          </div>

          {/* LOGIN / REGISTER */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-200 transition hover:text-cyan-400"
            >
              Login
            </Link>

            <Link
              href="/register"
              className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Register
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section
        id="home"
        className="relative mx-auto grid min-h-[78vh] max-w-7xl items-center gap-14 overflow-hidden px-6 py-16 lg:grid-cols-2 lg:px-8"
      >
        {/* BACKGROUND GLOW */}
        <div className="absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />

        {/* LEFT */}
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            IoT-Based Smart Healthcare
          </div>

          <h1 className="text-5xl font-bold leading-[1.08] tracking-tight md:text-6xl">
            Smart Inhaler
            <span className="mt-2 block text-cyan-400">
              Monitoring System
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
            Monitor inhaler usage, remaining doses and patient trends through
            IoT connectivity and cloud-based analytics.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="rounded-xl bg-cyan-500 px-7 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Login to Dashboard
            </Link>

            <Link
              href="/register"
              className="rounded-xl border border-slate-700 bg-slate-900/50 px-7 py-3.5 font-semibold transition hover:border-cyan-500 hover:text-cyan-400"
            >
              Create Account
            </Link>
          </div>

          {/* QUICK INFO */}
          <div className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-slate-800 pt-8">
            <div>
              <p className="text-2xl font-bold text-cyan-400">24/7</p>
              <p className="mt-1 text-sm text-slate-500">Monitoring</p>
            </div>

            <div>
              <p className="text-2xl font-bold text-cyan-400">IoT</p>
              <p className="mt-1 text-sm text-slate-500">Connected</p>
            </div>

            <div>
              <p className="text-2xl font-bold text-cyan-400">Cloud</p>
              <p className="mt-1 text-sm text-slate-500">Analytics</p>
            </div>
          </div>
        </div>

        {/* RIGHT DASHBOARD PREVIEW */}
        <div className="relative z-10">
          <div className="absolute -inset-10 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative rounded-3xl border border-slate-800 bg-slate-900/90 p-7 shadow-2xl">
            
            {/* HEADER */}
            <div className="mb-7 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                  Live Monitoring
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  Patient Dashboard
                </h2>
              </div>

              <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Connected
              </div>
            </div>

            {/* CARDS */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <p className="text-sm text-slate-500">
                  Today&apos;s Usage
                </p>

                <p className="mt-3 text-4xl font-bold">2</p>

                <p className="mt-1 text-xs text-slate-500">
                  doses used
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <p className="text-sm text-slate-500">
                  Remaining Doses
                </p>

                <p className="mt-3 text-4xl font-bold text-cyan-400">
                  118
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  doses available
                </p>
              </div>
            </div>

            {/* LAST USAGE */}
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Last Inhaler Usage
                </p>

                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-400">
                  Today
                </span>
              </div>

              <p className="mt-3 text-2xl font-semibold">
                10:35 AM
              </p>

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs text-slate-500">
                  <span>Remaining Capacity</span>
                  <span>98%</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-[98%] rounded-full bg-cyan-500" />
                </div>
              </div>
            </div>

            {/* DEVICE STATUS */}
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div>
                <p className="text-sm text-slate-500">
                  Smart Inhaler
                </p>

                <p className="mt-1 font-semibold">
                  Device #SIMS001
                </p>
              </div>

              <span className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
                Normal
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="border-y border-slate-800 bg-slate-900/30 px-6 py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Key Features
            </p>

            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Smarter Inhaler Monitoring
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              One connected platform for smart inhaler monitoring, dose
              tracking and patient usage analytics.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <FeatureCard
              number="01"
              title="Usage Monitoring"
              description="Monitor inhaler activation and maintain a digital history of patient inhaler usage."
            />

            <FeatureCard
              number="02"
              title="Dose Tracking"
              description="Track inhaler usage and estimate the number of remaining doses available."
            />

            <FeatureCard
              number="03"
              title="Cloud Analytics"
              description="Visualise usage patterns and patient trends through cloud-based analytics."
            />
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section
        id="about"
        className="mx-auto max-w-7xl px-6 py-20 lg:px-8"
      >
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            About SIMS-Cloud
          </p>

          <h2 className="mt-4 max-w-3xl text-3xl font-bold">
            Connecting smart inhaler technology with digital healthcare.
          </h2>

          <p className="mt-5 max-w-3xl leading-7 text-slate-400">
            SIMS-Cloud is an IoT-based Smart Inhaler Monitoring System designed
            to capture inhaler usage information and provide useful monitoring
            data through a cloud-connected platform.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        id="contact"
        className="border-t border-slate-800 px-6 py-8"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
            © 2026 SIMS-Cloud. Smart Inhaler Monitoring System.
          </p>

          <p>Breathe • Monitor • Live Better</p>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 transition hover:-translate-y-1 hover:border-cyan-500/40">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 font-semibold text-cyan-400">
        {number}
      </div>

      <h3 className="text-lg font-semibold">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  );
}