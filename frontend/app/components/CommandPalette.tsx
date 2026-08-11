"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Search, X } from "lucide-react";
import Link from "next/link";
import type { CaseBundle } from "../../lib/api";

export function CommandPalette({
  isOpen,
  onClose,
  cases = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  cases?: CaseBundle[];
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = cases.filter((bundle) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      bundle.case.id.toLowerCase().includes(q) ||
      bundle.prisoner.name.toLowerCase().includes(q) ||
      bundle.prisoner.prison_name.toLowerCase().includes(q) ||
      bundle.case.sections.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="modal-backdrop" onClick={onClose} aria-modal="true" role="dialog">
      <div className="command-modal" onClick={(e) => e.stopPropagation()}>
        <div className="command-input-wrap">
          <Search size={18} className="command-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-input"
            placeholder="Search cases, prisoners, sections, or court orders... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="command-close" onClick={onClose} aria-label="Close search modal">
            <X size={16} />
          </button>
        </div>

        <div className="command-results">
          {filtered.length === 0 ? (
            <div className="command-empty">No matching cases found for &quot;{query}&quot;</div>
          ) : (
            filtered.map((bundle) => (
              <Link
                key={bundle.case.id}
                href={`/cases/${bundle.case.id}`}
                className="command-item"
                onClick={onClose}
              >
                <div className="command-item-left">
                  <b>{bundle.prisoner.name}</b>
                  <small>
                    {bundle.case.id} · {bundle.prisoner.prison_name} · {bundle.case.sections.join(", ")}
                  </small>
                </div>
                <div className="command-item-right">
                  <span className={`status-pill ${bundle.decision.status.toLowerCase()}`}>
                    {bundle.decision.status.replace(/_/g, " ")}
                  </span>
                  <ArrowRight size={15} />
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="command-footer">
          <span>
            <BookOpen size={13} /> Quick navigation: Try searching <code>Section 479</code> or <code>CASE-1042</code>
          </span>
          <span className="kbd-shortcut">ESC</span>
        </div>
      </div>
    </div>
  );
}
