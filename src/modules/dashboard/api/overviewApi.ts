import { api } from '../../../shared/api/apiClient';

export type OverviewProject = {
  id: string; code: string; name: string; clientName: string; status: string;
  boqValue: number; suppliedValue: number; installedValue: number; installedPct: number; localPurchaseValue: number;
  itemsPending: number; itemsOverBoq: number; lotsInTransit: number; lotsOverdue: number; openRequests: number;
};
export type Overview = {
  asOf: string;
  projects: { active: number; closing: number; closed: number };
  month: { purchaseValue: number; purchaseOrders: number; localPurchaseValue: number; localPurchases: number };
  material: { requestsAwaitingPo: number; requestsOverBoq: number; lotsInTransit: number; lotsLate: number; returnsPending: number; stockShortValue30d: number };
  totals: { boqValue: number; suppliedValue: number; installedValue: number };
  projectRows: OverviewProject[];
  attention: { kind: string; title: string; link: string }[];
};

export const overviewApi = { get: () => api<Overview>('/dashboard/overview') };
