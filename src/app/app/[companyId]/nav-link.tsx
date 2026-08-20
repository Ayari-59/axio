"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href.split("/").length > 4 && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
        active ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-ink-100"
      }`}
    >
      {label}
    </Link>
  );
}
