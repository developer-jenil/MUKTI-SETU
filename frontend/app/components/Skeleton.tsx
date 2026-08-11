"use client";

export function SkeletonText({
  width = "100%",
  height = "1rem",
  className = "",
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-line ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonRow() {
  return (
    <div className="case-row skeleton-row" aria-hidden="true">
      <div className="person">
        <div className="skeleton-avatar" />
        <div style={{ flex: 1 }}>
          <SkeletonText width="60%" height="0.9rem" />
          <SkeletonText width="40%" height="0.7rem" className="mt-1" />
        </div>
      </div>
      <SkeletonText width="70%" height="0.8rem" />
      <div>
        <SkeletonText width="80%" height="0.8rem" />
        <div className="progress mt-1">
          <div className="skeleton-progress-bar" />
        </div>
      </div>
      <SkeletonText width="60px" height="1.4rem" />
      <SkeletonText width="16px" height="16px" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="panel skeleton-card" aria-hidden="true">
      <SkeletonText width="30%" height="0.7rem" />
      <SkeletonText width="60%" height="1.3rem" className="mt-2" />
      <SkeletonText width="100%" height="0.8rem" className="mt-3" />
      <SkeletonText width="80%" height="0.8rem" className="mt-1" />
    </div>
  );
}
