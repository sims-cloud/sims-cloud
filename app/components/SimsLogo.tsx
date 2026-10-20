import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/sims-cloud-logo.png"
        alt="SIMS-Cloud Smart Inhaler System"
        width={70}
        height={70}
        priority
        className="h-16 w-auto object-contain"
      />

      <div className="hidden sm:block">
        <div className="text-lg font-bold tracking-wide text-white">
          SIMS-<span className="text-cyan-400">CLOUD</span>
        </div>

        <div className="text-[10px] tracking-[0.18em] text-slate-400">
          SMART INHALER SYSTEM
        </div>
      </div>
    </Link>
  );
}