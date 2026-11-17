import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import type { ReactNode } from "react";
import { clsx } from "clsx";

export { Logo, StatusDot } from "./brand";

export function Sparkline({
  values,
  color = "var(--green)",
  filled = false,
}: {
  values: number[];
  color?: string;
  filled?: boolean;
}) {
  const path = values
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${(index / Math.max(1, values.length - 1)) * 160},${58 - value * 0.8}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 160 64"
      preserveAspectRatio="none"
      className="sparkline"
      aria-hidden="true"
    >
      {filled && (
        <path d={`${path} L160,64 L0,64 Z`} fill={color} opacity=".07" />
      )}
      <path
        d={path}
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function UptimeStrip({
  degraded = false,
  count = 60,
  points,
}: {
  degraded?: boolean;
  count?: number;
  points?: { ts: string; ok?: boolean }[];
}) {
  return (
    <div
      className="uptime-strip"
      aria-label={
        points
          ? "Observed check history; inspect each interval for its result"
          : degraded
            ? "Demo history: one degraded interval"
            : "Demo history: all intervals operational"
      }
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={
            points
              ? !points.length
                ? "unknown-bar"
                : points[
                      Math.min(
                        points.length - 1,
                        Math.floor((i / count) * points.length),
                      )
                    ].ok
                  ? ""
                  : "warning-bar"
              : degraded && i === Math.floor(count * 0.73)
                ? "warning-bar"
                : ""
          }
          title={
            points
              ? points.length
                ? `${new Date(points[Math.min(points.length - 1, Math.floor((i / count) * points.length))].ts).toLocaleString()} · ${points[Math.min(points.length - 1, Math.floor((i / count) * points.length))].ok ? "OK" : "Failed"}`
                : "No observations"
              : `${count - i} intervals ago (sample)`
          }
        />
      ))}
    </div>
  );
}

export function Trend({
  children,
  down = false,
  neutral = false,
}: {
  children: ReactNode;
  down?: boolean;
  neutral?: boolean;
}) {
  return (
    <span className={clsx("trend", neutral && "neutral")}>
      {down ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
      {children}
    </span>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={clsx("modal", className)}>
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={19} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
