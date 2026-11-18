import { clsx } from "clsx";
import type { Monitor } from "../lib/demo";
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={clsx("brand", small && "small")}>
      <img
        className={small ? "pulse-logo pulse-logo-icon" : "pulse-logo"}
        src={small ? "/brand/pulse-mark.svg" : "/brand/pulse-logo.svg"}
        alt="Pulse"
        width={small ? 32 : 146}
        height={small ? 32 : 50}
      />
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
