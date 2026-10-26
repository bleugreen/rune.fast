import type { CostData, RawCostData, RawRoles, Roles } from '../src/data/costTypes';

/**
 * The cost exports keep per-issue rows whose titles name helper accounts, test
 * accounts and run hosts. The cost page renders none of them, so the public
 * projection keeps only the numeric fields the page draws.
 */
export function projectCostData(raw: RawCostData): CostData {
  const { total, models, conc, t0, step, peak, peak_t, groups, cnt, median } = raw;
  return { total, models, conc, t0, step, peak, peak_t, groups, cnt, median };
}

/** Cost by role per hour; the per-unit rows (issue numbers and thread names) stay archival. */
export function projectRoles(raw: RawRoles): Roles {
  return { hourly: raw.hourly };
}
