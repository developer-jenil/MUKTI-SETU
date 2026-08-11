"use client";

import { BadgeCheck, LockKeyhole } from "lucide-react";
import type { WorkflowLevel } from "../../lib/api";

export function WorkflowRail({
  levels,
  nextAction,
}: {
  levels: WorkflowLevel[];
  nextAction: string;
}) {
  return (
    <section className="panel rail-panel">
      <p className="eyebrow">FOUR-EYE REVIEW</p>
      <h3>{nextAction}</h3>
      <div className="rail">
        {levels.map((level, index) => {
          const done = level.status === "APPROVED";
          const rejected = level.status === "REJECTED";
          const active = level.status === "PENDING" && !rejected;
          return (
            <div
              key={level.level}
              className={`rail-step ${done ? "done" : rejected ? "no" : active ? "active" : ""}`}
            >
              <span className="rail-icon">
                {done ? (
                  <BadgeCheck size={16} />
                ) : rejected ? (
                  <LockKeyhole size={15} />
                ) : (
                  <span className="rail-num">{level.level}</span>
                )}
              </span>
              <div>
                <b>{level.role}</b>
                <small>
                  {level.actor ? `${level.actor} · ${level.status}` : index === 0 ? "Pending" : "Locked"}
                </small>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
