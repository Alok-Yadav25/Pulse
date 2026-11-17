import { Activity } from "lucide-react";
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
