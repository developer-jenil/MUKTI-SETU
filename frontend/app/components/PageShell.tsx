"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Scale, ShieldCheck } from "lucide-react";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export function PageShell({
  eyebrow,
  title,
  breadcrumbs,
  children,
}: {
  eyebrow: string;
  title: string;
  breadcrumbs?: Breadcrumb[];
  children: React.ReactNode;
}) {
  return (
    <main className="subpage">
      <header className="subnav">
        <div className="subnav-left">
          <Link href="/" className="back">
            <ArrowLeft size={16} /> Command center
          </Link>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="breadcrumbs" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="crumb">
                  <ChevronRight size={13} className="crumb-sep" />
                  {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
                </span>
              ))}
            </nav>
          )}
        </div>
        <div className="brand">
          <span className="brand-mark">MS</span>MUKTI-SETU
        </div>
      </header>
      <section className="page-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>
          <ShieldCheck size={15} /> Every recommendation requires designated human approval.
        </p>
      </section>
      {children}
      <footer>
        <span>Decision support, not legal advice</span>
        <span className="footer-note">
          <Scale size={14} /> BNSS Section 479 · Human oversight is always in the loop
        </span>
      </footer>
    </main>
  );
}
