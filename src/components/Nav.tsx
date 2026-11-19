"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";

const links = [
  { href: "/#problem", label: "Problem" },
  { href: "/#levers", label: "Levers" },
  { href: "/#method", label: "Method" },
  { href: "/dashboard", label: "Demo" },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const onDash = path.startsWith("/dashboard");

  return (
    <header className="sticky top-0 z-40 border-b border-sand-line/80 bg-sand/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="ThirstCap home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-ink-soft md:flex" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={link.href === "/dashboard" && onDash ? "text-lagoon" : "hover:text-ink"}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="rounded-full bg-lagoon px-4 py-2 font-medium text-white hover:bg-lagoon-deep"
          >
            Open demo
          </Link>
        </nav>
        <button
          type="button"
          className="rounded-md border border-sand-line px-3 py-1.5 text-sm md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open ? (
        <nav id="mobile-nav" className="border-t border-sand-line px-4 py-3 md:hidden" aria-label="Mobile">
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block rounded-md px-2 py-2 hover:bg-white" onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
