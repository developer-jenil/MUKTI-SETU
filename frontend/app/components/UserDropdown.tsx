"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Shield, User, Volume2, VolumeX } from "lucide-react";

export function UserDropdown({
  isOpen,
  onClose,
  onRoleChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRoleChange?: (role: string) => void;
}) {
  const [activeRole, setActiveRole] = useState("Legal Aid Officer (L1)");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const roles = [
    "Legal Aid Officer (L1)",
    "District Judge / Court (L2)",
    "Prisons Department Auditor",
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="user-dropdown-popover" ref={panelRef} role="menu">
      <div className="user-profile-header">
        <div className="avatar-large">AS</div>
        <div>
          <b>Adv. Ananya Sharma</b>
          <small>DLSA Senior Panelist</small>
        </div>
      </div>

      <div className="user-role-section">
        <span className="section-label">ACTIVE ROLE & PERMISSIONS</span>
        {roles.map((r) => (
          <button
            key={r}
            className={`role-option ${r === activeRole ? "selected" : ""}`}
            onClick={() => {
              setActiveRole(r);
              if (onRoleChange) onRoleChange(r);
              onClose();
            }}
          >
            <Shield size={14} />
            <span>{r}</span>
            {r === activeRole && <Check size={14} className="check-mark" />}
          </button>
        ))}
      </div>

      <div className="user-pref-section">
        <button className="pref-option" onClick={() => setSoundEnabled(!soundEnabled)}>
          {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          <span>Audio Cues & Haptics</span>
          <span className="toggle-badge">{soundEnabled ? "ON" : "OFF"}</span>
        </button>
      </div>

      <div className="user-footer">
        <small>BNSS S.479 Session ID: #8820-A</small>
      </div>
    </div>
  );
}
