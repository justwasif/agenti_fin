import type { JobState } from "@/lib/types";
import { stateColor, stateTint } from "@/lib/colors";

const ORDER: JobState[] = [
  "DRAFT",
  "LOCKED",
  "IN_PROGRESS",
  "SUBMITTED",
  "VERIFYING",
  "CAPTURED",
];

/**
 * 2D state pills for the linear happy path.
 * Shows DRAFT→LOCKED→IN_PROGRESS→SUBMITTED→VERIFYING→CAPTURED.
 * FAILED / CANCELLED are terminal branches rendered separately when present.
 */
export function StateTimeline({ current }: { current: JobState }) {
  const activeIdx = ORDER.indexOf(current);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="list">
      {ORDER.map((s, i) => {
        const reached = activeIdx >= i;
        const isCurrent = current === s;
        const color = stateColor(s);
        return (
          <div key={s} className="flex items-center gap-1.5" role="listitem">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-opacity ${
                reached || isCurrent ? "opacity-100" : "opacity-35"
              }`}
              style={{
                color: reached ? color : stateColor("CANCELLED"),
                backgroundColor: reached ? stateTint(s) : "transparent",
                boxShadow: isCurrent ? `0 0 0 1px ${color}` : undefined,
              }}
            >
              {isCurrent && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
              {s}
            </span>
            {i < ORDER.length - 1 && (
              <span className="h-px w-3 bg-ink/15" aria-hidden />
            )}
          </div>
        );
      })}
      {current === "FAILED" && (
        <span
          className="ml-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: stateColor("FAILED"), backgroundColor: stateTint("FAILED") }}
        >
          FAILED
        </span>
      )}
    </div>
  );
}
