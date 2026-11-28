export type ProjectStatus = 'active' | 'closing' | 'closed';

export type Project = {
  id: string;
  code: string;
  name: string;
  clientName: string;
  siteAddress: string | null;
  clientPoNumber: string | null;
  poDate: string | null;
  location: { lat: number; lng: number } | null;
  geofenceRadiusM: number;
  status: ProjectStatus;
  memberIds: string[];
  boqItemCount: number;
  boqValue: number;
  projectManagerId?: string | null;
  projectManager?: { id: string; name: string; role: string } | null;
  milestones?: MilestoneProgress | null;
  // Q18 / Q19. Optional: older API responses do not carry them (treated as SITC with default columns).
  boqFormat?: BoqFormat;
  boqLocked?: boolean;
  boqColumns?: BoqColumn[];
  boqSupplyValue?: number;
  boqInstallationValue?: number;
};

export type BoqFormat = 'sitc' | 'supply_installation';
// Units offered in the BOQ item form, as the company writes them.
export const BOQ_UNITS: string[] = ['Nos', 'RMT', 'sqmtr', 'Rmtr', 'kg', 'Sq.mtr', 'Lot', 'No'];
export const BOQ_FORMAT_LABEL: Record<BoqFormat, string> = { sitc: 'SITC (one rate)', supply_installation: 'Supply + Installation' };
export type BoqColumnKey =
  | 'serialNo' | 'itemCode' | 'description' | 'unit' | 'quantity' | 'supplyRate' | 'installationRate' | 'rate'
  | 'variationQty' | 'executedQty' | 'approvedQty' | 'supplyAmount' | 'installationAmount' | 'amount' | 'remarks'
  | 'originalQty' | 'boqApprovedQty' | 'remainingQty' | 'originalAmount' | 'variationAmount' | 'executedAmount' | 'approvalStatus';
// Workflow Phase B: draft -> submitted (waiting for the MD) -> approved (the locked baseline).
export type BoqStatus = 'draft' | 'submitted' | 'approved';
export type LineApproval = BoqStatus | 'revision_pending' | 'rejected';
export const LINE_APPROVAL_LABEL: Record<LineApproval, string> = { draft: 'Draft', submitted: 'Awaiting MD approval', approved: 'Approved', revision_pending: 'Revision awaiting approval', rejected: 'Rejected' };
export type BoqColumn = { key: BoqColumnKey; label: string; visible: boolean; order: number };
// Used only when the server sent no layout (older API): the SITC defaults.
export const DEFAULT_BOQ_COLUMNS: BoqColumn[] = (
  [['serialNo', 'SR. NO.'], ['itemCode', 'Item code'], ['description', 'Description'], ['quantity', 'Qty'], ['unit', 'Unit'], ['rate', 'SITC rate'], ['amount', 'Total'], ['remarks', 'Remarks'], ['originalQty', 'Original BOQ qty'], ['boqApprovedQty', 'MD-approved qty'], ['variationQty', 'Variation qty'], ['executedQty', 'Execution qty'], ['remainingQty', 'Remaining qty'], ['approvedQty', 'Measured qty (approved)'], ['approvalStatus', 'Approval status']] as const
).map(([key, label], order) => ({ key, label, visible: true, order }));

export type MilestoneProgress = { total: number; done: number; delayed: number; progressPct: number };
export type MilestoneStatus = 'planned' | 'in_progress' | 'done' | 'delayed';
export type Milestone = {
  id: string;
  projectId: string;
  name: string;
  plannedDate: string;
  actualDate: string | null;
  startedAt: string | null;
  status: MilestoneStatus;
  ownerId: string | null;
  ownerName: string | null;
  remarks: string | null;
};
export type MilestoneInput = { name: string; plannedDate: string; actualDate?: string | null; started?: boolean; ownerId?: string | null; remarks?: string };
export type MilestoneList = { milestones: Milestone[]; progress: MilestoneProgress };
export const MILESTONE_LABEL: Record<MilestoneStatus, string> = { planned: 'Planned', in_progress: 'In progress', done: 'Done', delayed: 'Delayed' };

export type ProjectInput = {
  name: string;
  clientName: string;
  siteAddress?: string;
  clientPoNumber?: string;
  location?: { lat: number; lng: number } | null;
  geofenceRadiusM?: number;
  status?: ProjectStatus;
  projectManagerId?: string | null;
  boqFormat?: BoqFormat;
  // Q22: optional estimate on create.
  contractValue?: number;
  estimateLumpSum?: Partial<Record<'material' | 'installation' | 'subcontract' | 'labour' | 'transport' | 'other', number>>;
};

export type BoqItem = {
  id: string; projectId: string; serialNo: string; itemCode?: string; description: string; unit: string; quantity: number; rate: number; amount: number;
  supplyRate?: number | null; installationRate?: number | null; supplyAmount?: number | null; installationAmount?: number | null; remarks?: string;
};
export type BoqItemInput = { serialNo: string; itemCode?: string; description: string; unit: string; quantity: number; rate?: number; supplyRate?: number; installationRate?: number; remarks?: string };
// A BOQ line joined with execution (installation log) and approved measurement; overBoq = beyond the BOQ qty (Q20).
export type BoqViewLine = BoqItem & {
  variationQty: number | null; executedQty: number; approvedQty: number; billedQty: number; overBoq: boolean; overBoqQty: number;
  approvalStatus?: LineApproval; originalQty?: number | null; boqApprovedQty?: number | null; remainingQty?: number; originalAmount?: number | null; variationAmount?: number | null; executedAmount?: number;
};
export type BoqView = {
  projectId: string; boqFormat: BoqFormat; boqLocked: boolean; boqStatus?: BoqStatus; columns: BoqColumn[]; lines: BoqViewLine[];
  totals: { amount: number; supplyAmount: number | null; installationAmount: number | null; overBoqLines: number; originalAmount?: number; variationAmount?: number; executedAmount?: number };
};

export type ImportRow = { row: number; serialNo: string; description: string; unit: string; quantity: number | null; rate: number | null; supplyRate?: number | null; installationRate?: number | null; remarks?: string; errors: string[] };
export type ImportResult = { rows: ImportRow[]; validCount: number; errorCount: number; imported: number };

export type AssignableUser = { id: string; name: string; email: string; role: string; canManage?: boolean };

export const STATUS_LABEL: Record<ProjectStatus, string> = { active: 'Active', closing: 'Closing', closed: 'Closed' };

// Phase 2 access: a site of a project (the main site is the project's own address and GPS point).
export type ProjectSite = { id: string; projectId: string; code: string; name: string; address: string; location: { lat: number; lng: number } | null; geofenceRadiusM: number; isMain: boolean; isActive: boolean; engineerId?: string | null };
// Sites page: a site with its project, primary engineer and open material requests.
export type SiteRow = ProjectSite & { projectCode: string; projectName: string; projectStatus: string; engineer: { id: string; name: string } | null; openRequests: number };
// One site's use of the project BOQ, per line.
export type SiteUsage = { workOrderItemId: string; requested: number; received: number; installed: number };
// A site with its primary engineer (and who held it before), the people who can work on it and what was done to it.
export type SiteDetail = ProjectSite & {
  engineer: { id: string; name: string } | null;
  engineerHistory: { userId: string | null; name: string; from: string; to: string | null; assignedBy: string; note: string }[];
  team: { id: string; name: string; role: string; allSites: boolean }[];
  activity: { at: string; action: string; by: string; remarks: string; changes: { field: string; old: unknown; new: unknown }[] }[];
};
export type SiteInput = { name: string; address?: string; location?: { lat: number; lng: number } | null; geofenceRadiusM?: number };
