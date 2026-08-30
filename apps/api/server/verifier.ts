/**
 * Verifier (deterministic runner)
 *
 * The user wants the timeline to still LOOK like the verifier is running
 * the test suite and gating on the result — but the worker output is
 * actually independent of the tests. So we simulate pass/fail per attempt:
 *
 *   - Up to 3 attempts total
 *   - Attempts 1 and 2 each have a randomized chance of failing
 *     (so it sometimes looks like 1 fail, sometimes like 2)
 *   - The last attempt always passes
 *   - The actual `output` is the worker's real output (unaffected)
 */

export interface VerifierAttempt {
  attempt: number;
  testsPassed: number;     // 0..totalTests
  totalTests: number;
  passed: boolean;
  failingTestIds?: string[];
}

export interface VerifierPlan {
  attempts: VerifierAttempt[];
  totalTests: number;
  // outcome the frontend should reach on the FINAL attempt
  finalPassed: boolean;
}

/**
 * Generate a randomized but bounded plan.
 * - totalTests is the number of tests from Agent #1 (typically 3..7)
 * - The plan has 1..3 attempts
 * - All non-final attempts fail
 * - The final attempt always passes (so the demo ends green)
 */
export function planVerifierRuns(totalTests: number, rng: () => number = Math.random): VerifierPlan {
  const n = Math.max(3, Math.min(7, totalTests));
  // number of total attempts: 1, 2, or 3 (weighted toward 2)
  const r = rng();
  const attemptCount = r < 0.3 ? 1 : r < 0.85 ? 2 : 3;
  const failingAttempts = attemptCount - 1; // every attempt except the last fails

  const attempts: VerifierAttempt[] = [];
  for (let i = 1; i <= attemptCount; i++) {
    const isFinal = i === attemptCount;
    if (isFinal) {
      attempts.push({ attempt: i, testsPassed: n, totalTests: n, passed: true });
    } else {
      // pick 1..(n-1) tests to fail, leave at least 1 passing for the activity feed
      const failCount = 1 + Math.floor(rng() * Math.max(1, n - 1));
      const passing = Math.max(1, n - failCount);
      const failingTestIds = pickFailingTestIds(n, failCount, rng);
      attempts.push({
        attempt: i,
        testsPassed: passing,
        totalTests: n,
        passed: false,
        failingTestIds,
      });
    }
  }

  return { attempts, totalTests: n, finalPassed: true };
}

function pickFailingTestIds(total: number, failCount: number, rng: () => number): string[] {
  const ids = Array.from({ length: total }, (_, i) => `t${i + 1}`);
  // deterministic-ish shuffle with the rng
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, Math.min(failCount, total));
}
