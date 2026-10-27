import type { RouteLog, RoutePlan } from '../src/route/log';

/**
 * data/route-log.json as the Route page reads it: the fields src/route/log.ts names and no others,
 * so a re-import that carried more of the runner's log could not ship it.
 */
export function projectRouteLog(raw: RouteLog): RouteLog {
  return {
    source: { export: raw.source.export, files: raw.source.files.map(({ name, sha256, at }) => ({ name, sha256, ...(at ? { at } : {}) })) },
    tickMs: raw.tickMs,
    sessions: raw.sessions.map(({ run, runId, session, start, end, firstObserved, ended, heldFrom, startAt, endAt }) => ({
      run,
      runId,
      session,
      start,
      end,
      firstObserved,
      ended,
      ...(heldFrom === undefined ? {} : { heldFrom }),
      startAt,
      endAt,
    })),
    steps: raw.steps.map(({ run, session, label, start, end, ok }) => ({ run, session, label, start, end, ok })),
    levels: raw.levels.map(([skill, level, run, tick]) => [skill, level, run, tick] as const),
    hiscore: { at: raw.hiscore.at, overall: raw.hiscore.overall, skills: raw.hiscore.skills.map(({ skill, ticks }) => ({ skill, ticks })) },
  };
}

/** data/route-plan.json with its rows' figures; the scenario lines keep their ticks, not the run order's words. */
export function projectRoutePlan(raw: RoutePlan): RoutePlan {
  return {
    source: raw.source,
    total: raw.total,
    rows: raw.rows.map(({ id, kind, expected, tags, best, scenario, line }) => ({
      id,
      kind,
      expected,
      tags,
      best,
      scenario: scenario.map(({ ticks }) => ({ ticks, says: '' })),
      line,
    })),
  };
}
