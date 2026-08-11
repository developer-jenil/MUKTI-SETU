"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, BadgeCheck, Bell, CheckCircle2, ShieldAlert, X } from "lucide-react";
import Link from "next/link";

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  type: "warning" | "success" | "alert";
  href: string;
}

const DEFAULT_NOTIFS: NotificationItem[] = [
  {
    id: "n1",
    title: "Article 21 Flag Detected",
    detail: "CASE-2088 custody date discrepancy between prison register & court order.",
    time: "10m ago",
    type: "alert",
    href: "/cases/CASE-2088",
  },
  {
    id: "n2",
    title: "Eligibility Threshold Met",
    detail: "CASE-1042 reached 1/3 maximum sentence threshold (Section 479).",
    time: "25m ago",
    type: "success",
    href: "/cases/CASE-1042",
  },
  {
    id: "n3",
    title: "Four-Eye Approval Required",
    detail: "Level 1 verification completed by Legal Officer A. Level 2 pending.",
    time: "1h ago",
    type: "warning",
    href: "/workflow",
  },
];

export function NotificationsPopover({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

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
    <div className="notif-popover" ref={panelRef} role="dialog" aria-label="Notifications Panel">
      <div className="notif-header">
        <div>
          <b><Bell size={15} /> System Signals</b>
          <small>3 unread alerts</small>
        </div>
        <button className="icon-btn-sm" onClick={onClose} aria-label="Close notifications">
          <X size={14} />
        </button>
      </div>

      <div className="notif-list">
        {DEFAULT_NOTIFS.map((item) => (
          <Link key={item.id} href={item.href} className={`notif-item ${item.type}`} onClick={onClose}>
            <span className="notif-icon">
              {item.type === "alert" ? (
                <ShieldAlert size={16} />
              ) : item.type === "warning" ? (
                <AlertTriangle size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
            </span>
            <div className="notif-content">
              <b>{item.title}</b>
              <p>{item.detail}</p>
              <small>{item.time}</small>
            </div>
          </Link>
        ))}
      </div>

      <div className="notif-footer">
        <Link href="/workflow" onClick={onClose}>
          View all audit signals <BadgeCheck size={13} />
        </Link>
      </div>
    </div>
  );
}
