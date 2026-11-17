import * as Dialog from "@radix-ui/react-dialog";
import { Activity, ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import type { ReactNode } from "react";
import { clsx } from "clsx";
import type { Monitor } from "../lib/demo";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={clsx("brand", small && "small")}>
      <span className="brand-mark">
        <Activity size={23} strokeWidth={2.3} />
      </span>
      {!small && (
        <span>
          pulse<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}

export function StatusDot({
  status = "operational",
  pulse = false,
}: {
  status?: Monitor["status"];
  pulse?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={clsx("status-dot", status, pulse && "pulsing")}
    />
  );
}

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
        `${index === 0 ? "M" : "L"}${(index / (values.length - 1)) * 160},${58 - value * 0.8}`,
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
}: {
  degraded?: boolean;
  count?: number;
}) {
  return (
    <div
      className="uptime-strip"
      aria-label={
        degraded
          ? "Demo history: one degraded interval"
          : "Demo history: all intervals operational"
      }
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={
            degraded && i === Math.floor(count * 0.73) ? "warning-bar" : ""
          }
          title={`${count - i} intervals ago · ${degraded && i === Math.floor(count * 0.73) ? "Degraded performance" : "Operational"} (sample)`}
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
