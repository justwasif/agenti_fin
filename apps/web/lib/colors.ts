export const palette = {
  bg: "#F6F7F9",
  surface: "#FFFFFF",
  ink: "#1A1D23",
  muted: "#5B6472",
  primary: "#2F6BFF",
  success: "#14B877",
  danger: "#E5484D",
  warning: "#F5A524",
  glow: "#6E8BFF",
} as const;

export type PaletteKey = keyof typeof palette;

import type { JobState } from "./types";

/**
 * Map a job state to its semantic color.
 * DRAFT / IN_PROGRESS / VERIFYING = primary (blue)
 * LOCKED = warning (amber), CAPTURED = success (green), FAILED = danger (red)
 * CANCELLED / SUBMITTED = muted (neutral)
 */
export function stateColor(state: JobState): string {
  switch (state) {
    case "LOCKED":
      return palette.warning;
    case "CAPTURED":
      return palette.success;
    case "FAILED":
      return palette.danger;
    case "CANCELLED":
    case "SUBMITTED":
      return palette.muted;
    case "DRAFT":
    case "IN_PROGRESS":
    case "VERIFYING":
    default:
      return palette.primary;
  }
}

/** Lighter tint of the state color, for badge backgrounds. */
export function stateTint(state: JobState): string {
  switch (state) {
    case "LOCKED":
      return "rgba(245,165,36,0.14)";
    case "CAPTURED":
      return "rgba(20,184,119,0.14)";
    case "FAILED":
      return "rgba(229,72,77,0.14)";
    case "CANCELLED":
    case "SUBMITTED":
      return "rgba(91,100,114,0.12)";
    case "DRAFT":
    case "IN_PROGRESS":
    case "VERIFYING":
    default:
      return "rgba(47,107,255,0.12)";
  }
}
