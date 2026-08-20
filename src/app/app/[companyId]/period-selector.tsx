"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { periodLabel } from "@/lib/format";

export function PeriodSelector({ periods, current }: { periods: string[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="muted">Période</span>
      <select
        className="w-auto"
        value={current}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("period", event.target.value);
          router.push(`${pathname}?${params.toString()}`);
        }}
      >
        {[...periods].reverse().map((code) => (
          <option key={code} value={code}>
            {periodLabel(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
