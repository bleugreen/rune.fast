import costRaw from '../../data/cost-data.json';
import rolesRaw from '../../data/roles.json';
import summaryRaw from '../../data/summary.json';
import hourlyRaw from '../../data/hourly.json';
import billingRaw from '../../data/billing.json';
import eventsRaw from '../../data/swarm-events.json';
import activityRaw from '../../data/swarm-activity.json';
import type { CostInputs } from './costTypes';

/** In the site build, cost-data.json and roles.json are their public projections; vite.config.ts rewrites the imports. */
export const costInputs: CostInputs = {
  cost: costRaw as unknown as CostInputs['cost'],
  roles: rolesRaw as unknown as CostInputs['roles'],
  summary: summaryRaw as unknown as CostInputs['summary'],
  hourly: hourlyRaw as unknown as CostInputs['hourly'],
  billing: billingRaw as unknown as CostInputs['billing'],
  events: eventsRaw as unknown as CostInputs['events'],
  activity: activityRaw as unknown as CostInputs['activity'],
};
