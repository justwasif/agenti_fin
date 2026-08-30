import type { JobState } from "@/lib/types";
import { stateColor, stateTint } from "@/lib/colors";

export function Badge({
  state,
  className = "",
}: {
  state: JobState;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${className}`}
      style={{ color: stateColor(state), backgroundColor: stateTint(state) }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: stateColor(state) }}
      />
      {state}
    </span>
  );
}
