import rawLog from '../../data/route-log.json';
import rawPlan from '../../data/route-plan.json';
import { timeline } from '../data/timeline';
import type { RouteLog, RoutePlan } from './log';
import { buildRoute } from './model';

/** In the site build these are the public projections; vite.config.ts rewrites the imports. */
export const routeLog = rawLog as unknown as RouteLog;
export const routePlan = rawPlan as unknown as RoutePlan;

export const route = buildRoute(routeLog, routePlan, timeline);
