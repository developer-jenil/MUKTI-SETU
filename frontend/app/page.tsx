"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity, ArrowUpRight, BadgeCheck, Bell, BookOpen, ChevronRight, CircleHelp,
  Filter, LayoutDashboard, Menu, Search, ShieldCheck, Sparkles, UploadCloud, Users, X,
} from "lucide-react";
import Link from "next/link";
import gsap from "gsap";
import { api, type CaseBundle, type Dashboard } from "../lib/api";
import {
  CommandPalette, NotificationsPopover, SkeletonRow, StatusBadge, UserDropdown,
} from "./components";

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

function animateCount(el: HTMLElement, to: number, suffix = "") {
  const proxy = { v: 0 };
  gsap.to(proxy, {
    v: to,
    duration: 1.4,
    ease: "power2.out",
    onUpdate() {
      el.textContent = formatNumber(Math.round(proxy.v)) + suffix;
    },
  });
}

function Progress({ days, threshold }: { days: number | null; threshold: number | null }) {
  const percent = Math.min(Math.round(((days ?? 0) / (threshold || 1)) * 100), 100);
  return (
    <div className="progress">
      <div style={{ width: `${percent}%` }} />
    </div>
  );
}

function CaseRow({ bundle }: { bundle: CaseBundle }) {
  const { case: record, decision } = bundle;
  return (
    <Link href={`/cases/${record.id}`} className="case-row">
      <div className="person">
        <div className="case-avatar">{bundle.prisoner.name.split(" ").map((n) => n[0]).join("")}</div>
        <div>
          <b>
            {bundle.prisoner.name}
            {record.is_uploaded && (
              <span className="flag-pill" style={{ marginLeft: "8px", fontSize: "9px", padding: "2px 6px" }}>
                Uploaded
              </span>
            )}
          </b>
          <small>{record.id} · {record.sections.join(", ")}</small>
        </div>
      </div>
      <div className="facility">{bundle.prisoner.prison_name}</div>
      <div className="detention">
        <div>
          <b>{decision.detention_days ?? "—"} days</b>
          <small> / {decision.threshold_days ?? "—"} threshold</small>
        </div>
        <Progress days={decision.detention_days} threshold={decision.threshold_days} />
      </div>
      <StatusBadge status={decision.status} />
      <span className="row-arrow"><ArrowUpRight size={17} /></span>
    </Link>
  );
}

export default function Home() {
  const [menu, setMenu] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);

  const hero = useRef<HTMLDivElement>(null);
  const pipeline = useRef<HTMLDivElement>(null);
  const topbar = useRef<HTMLElement>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    api.dashboard().then(setData).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!topbar.current || reduceMotion.current) return;
    const items = topbar.current.querySelectorAll<HTMLElement>(":scope > *");
    gsap.fromTo(
      items,
      { y: -14, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.06, duration: 0.5, ease: "power3.out" },
    );
    topbar.current.classList.add("sheen");
  }, []);

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".reveal-init");
    if (reduceMotion.current) {
      targets.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [data]);

  useEffect(() => {
    if (!hero.current || reduceMotion.current) return;
    gsap.fromTo(
      hero.current.querySelectorAll(".reveal"),
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.08, duration: 0.7, ease: "power3.out" },
    );
  }, []);

  useEffect(() => {
    if (!data) return;
    if (reduceMotion.current) {
      document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
        el.textContent = formatNumber(Number(el.getAttribute("data-count")));
      });
      return;
    }
    document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
      animateCount(el, Number(el.getAttribute("data-count")));
    });
  }, [data]);

  useEffect(() => {
    if (!pipeline.current || reduceMotion.current) return;
    gsap.fromTo(
      pipeline.current.querySelectorAll(".timeline-item"),
      { opacity: 0.25 },
      { opacity: 1, stagger: 0.5, duration: 0.5, ease: "power1.out", delay: 0.8 },
    );
  }, []);

  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  const metrics = data?.metrics;
  const heroCount = metrics ? metrics.eligible + metrics.flagged : 0;

  const casesList = data?.recent_cases ?? [];
  const filteredCases = casesList.filter((bundle) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || (
      bundle.case.id.toLowerCase().includes(q) ||
      bundle.prisoner.name.toLowerCase().includes(q) ||
      bundle.prisoner.prison_name.toLowerCase().includes(q) ||
      (bundle.case.fir_number && bundle.case.fir_number.toLowerCase().includes(q)) ||
      bundle.case.sections.some((s) => s.toLowerCase().includes(q))
    );
    const matchesFilter = filterStatus === "ALL" || bundle.decision.status === filterStatus;
    return matchesQuery && matchesFilter;
  });

  return (
    <main ref={hero}>
      <a href="#queue" className="skip-link">Skip to review queue</a>

      <header className="topbar" ref={topbar}>
        <div className="brand">
          <span className="brand-mark">MS</span>
          <span>MUKTI<span className="accent">—</span>SETU</span>
        </div>
        <nav className={menu ? "nav open" : "nav"} aria-label="Primary">
          <a className="active" aria-current="page">Overview</a>
          <Link href="/cases/CASE-1042">Casework</Link>
          <Link href="/upload">Intake desk</Link>
          <Link href="/workflow">Audit trail</Link>
        </nav>
        <div className="top-actions">
          <button
            className="icon-btn"
            aria-label="Open search command palette"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search size={18} />
          </button>

          <button
            className="icon-btn"
            aria-label="Toggle notifications popover"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
          >
            <Bell size={18} />
            <i />
          </button>
          <NotificationsPopover isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

          <div
            className="avatar"
            role="button"
            aria-label="User menu"
            tabIndex={0}
            onClick={() => setIsUserOpen(!isUserOpen)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsUserOpen(!isUserOpen); }}
          >
            AS
          </div>
          <UserDropdown isOpen={isUserOpen} onClose={() => setIsUserOpen(false)} />

          <button
            className="mobile-menu"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        cases={casesList}
      />

      <div className="nav-scrim" onClick={() => setMenu(false)} aria-hidden="true" />

      {error && (
        <div className="api-error">
          API offline: {error} — start backend with <code>uvicorn app.main:app --reload</code>
        </div>
      )}

      <section className="hero reveal">
        <div>
          <p className="eyebrow"><span className="pulse" /> NATIONAL LEGAL AID INTELLIGENCE CONSOLE</p>
          <h1>Clarity for every<br /><em>day in custody.</em></h1>
          <p className="hero-copy">
            MUKTI-SETU turns fragmented case records into an auditable path to justice. Built for the people who make every review count under Section 479 BNSS.
          </p>
          <div className="hero-actions">
            <a className="primary" href="#queue"><LayoutDashboard size={17} /> Review queue <ArrowUpRight size={17} /></a>
            <Link className="text-btn" href="/simulator"><BookOpen size={17} /> Rule sandbox</Link>
          </div>
        </div>
        <div className="hero-orbit">
          <div className="orbit-card">
            <div className="orbit-top"><Sparkles size={15} /> SIGNAL DETECTED <span>LIVE</span></div>
            <strong><span data-count={heroCount}>0</span></strong>
            <p>undertrials eligible<br />for Section 479 review</p>
            <div className="orbit-foot"><span>↑ {metrics ? metrics.flagged : 0} flagged</span> Article 21 review</div>
          </div>
          <div className="ring ring-a" /><div className="ring ring-b" /><div className="orbit-dot" />
        </div>
      </section>

      <section className="stats reveal-init">
        <div>
          <span className="stat-icon cyan"><Users size={18} /></span>
          <p>Active caseload</p>
          <strong><span data-count={metrics?.total_cases ?? 0}>0</span></strong>
          <small><b>Live</b> mock persistence</small>
        </div>
        <div>
          <span className="stat-icon mint"><BadgeCheck size={18} /></span>
          <p>Eligible now</p>
          <strong><span data-count={metrics?.eligible ?? 0}>0</span></strong>
          <small><b>{metrics?.approaching ?? 0}</b> approaching threshold</small>
        </div>
        <div>
          <span className="stat-icon violet"><Activity size={18} /></span>
          <p>Flagged for Article 21</p>
          <strong><span data-count={metrics?.flagged ?? 0}>0</span></strong>
          <small><b>{metrics?.conflicts ?? 0}</b> source conflicts found</small>
        </div>
        <div>
          <span className="stat-icon amber"><ShieldCheck size={18} /></span>
          <p>Pending review</p>
          <strong><span data-count={metrics?.pending_review ?? 0}>0</span></strong>
          <small><b>Human</b> verification in the loop</small>
        </div>
      </section>

      <section className="workspace reveal-init" id="queue">
        <div className="section-head">
          <div>
            <p className="eyebrow">PRIORITY REVIEW QUEUE</p>
            <h2>Cases that need a decision.</h2>
          </div>
          <button className="outline" onClick={() => setIsSearchOpen(true)}>
            Search all cases <ChevronRight size={16} />
          </button>
        </div>

        <div className="queue-toolbar">
          <div className="queue-search-wrap">
            <Search size={16} className="queue-search-icon" />
            <input
              type="text"
              className="queue-search-input"
              placeholder="Filter queue by name, case ID, prison, or section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-pills">
            <Filter size={14} style={{ color: "var(--muted)" }} />
            <button
              className={`filter-btn ${filterStatus === "ALL" ? "active" : ""}`}
              onClick={() => setFilterStatus("ALL")}
            >
              ALL
            </button>
            <button
              className={`filter-btn ${filterStatus === "ELIGIBLE" ? "active" : ""}`}
              onClick={() => setFilterStatus("ELIGIBLE")}
            >
              ELIGIBLE
            </button>
            <button
              className={`filter-btn ${filterStatus === "ELIGIBLE_FLAGGED" ? "active" : ""}`}
              onClick={() => setFilterStatus("ELIGIBLE_FLAGGED")}
            >
              FLAGGED
            </button>
            <button
              className={`filter-btn ${filterStatus === "APPROACHING" ? "active" : ""}`}
              onClick={() => setFilterStatus("APPROACHING")}
            >
              MONITORING
            </button>
          </div>
        </div>

        <div className="case-table">
          <div className="table-head">
            <span>CASE / PERSON</span>
            <span>FACILITY</span>
            <span>DETENTION PROGRESS</span>
            <span>STATUS</span>
            <span />
          </div>

          {filteredCases.map((bundle) => (
            <CaseRow key={bundle.case.id} bundle={bundle} />
          ))}

          {!data && !error && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {data && filteredCases.length === 0 && (
            <div className="case-row">
              <div className="person">
                <div>
                  <b>No cases found</b>
                  <small>Try clearing your search query or filter status pills</small>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bottom-grid reveal-init">
        <div className="panel" ref={pipeline}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">WORKFLOW PULSE</p>
              <h3>From signal to safeguard.</h3>
            </div>
            <Activity size={19} />
          </div>
          <div className="timeline">
            <div className="timeline-item done">
              <span>01</span>
              <div><b>Source documents indexed</b><small>OCR + manual transcription · fails closed</small></div>
              <BadgeCheck size={17} />
            </div>
            <div className="timeline-item done">
              <span>02</span>
              <div><b>Truth discovery reconciled</b><small>court order &gt; prison register &gt; FIR &gt; OCR</small></div>
              <BadgeCheck size={17} />
            </div>
            <div className="timeline-item done">
              <span>03</span>
              <div><b>Deterministic rule engine</b><small>S.479 first proviso ⅓ · S.479(1) ½ · maximum-period cap</small></div>
              <BadgeCheck size={17} />
            </div>
            <div className="timeline-item current">
              <span>04</span>
              <div><b>Human verification</b><small>{metrics?.pending_review ?? 0} cases waiting for your review</small></div>
              <span className="live-dot" />
            </div>
          </div>
        </div>

        <div className="panel upload-panel">
          <div className="upload-icon"><UploadCloud size={24} /></div>
          <p className="eyebrow">INTAKE DESK</p>
          <h3>Bring a record into focus.</h3>
          <p>Upload court orders, prison registers or case files. We will map every fact to its source.</p>
          <Link className="primary" href="/upload">Start an intake <ArrowUpRight size={16} /></Link>
        </div>
      </section>

      <footer>
        <span>© 2026 MUKTI-SETU</span>
        <span className="footer-note"><ShieldCheck size={14} /> Human oversight is always in the loop</span>
        <span>Rulebook v2023-demo-v1 · <CircleHelp size={14} /></span>
      </footer>
    </main>
  );
}
