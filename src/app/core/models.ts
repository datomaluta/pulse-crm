export type Role = 'admin' | 'sales';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
}

export type CustomerStatus = 'lead' | 'active' | 'at-risk' | 'churned';

export const CUSTOMER_STATUSES: { id: CustomerStatus; label: string }[] = [
  { id: 'lead', label: 'Lead' },
  { id: 'active', label: 'Active' },
  { id: 'at-risk', label: 'At risk' },
  { id: 'churned', label: 'Churned' },
];

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  status: CustomerStatus;
  /** Monthly recurring revenue in USD */
  mrr: number;
  owner: string;
  createdAt: string;
  tags: string[];
  notes: string;
}

export type CustomerInput = Omit<Customer, 'id' | 'createdAt'>;

export type SortField = 'name' | 'company' | 'status' | 'mrr' | 'createdAt';
export type SortDir = 'asc' | 'desc';

export interface CustomerQuery {
  q: string;
  status: CustomerStatus | 'all';
  sort: SortField;
  dir: SortDir;
  page: number;
  pageSize: number;
}

export interface CustomerPage {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<CustomerStatus | 'all', number>;
}

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won';

export const DEAL_STAGES: { id: DealStage; label: string }[] = [
  { id: 'lead', label: 'New lead' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won' },
];

export interface Deal {
  id: string;
  title: string;
  customerId: string;
  company: string;
  amount: number;
  stage: DealStage;
  owner: string;
  closeDate: string;
}

export type ActivityType =
  'deal-won' | 'deal-moved' | 'customer-created' | 'customer-updated' | 'customer-deleted';

export interface Activity {
  id: string;
  type: ActivityType;
  text: string;
  who: string;
  at: string;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface DashboardStats {
  kpis: {
    mrr: number;
    mrrDelta: number;
    activeCustomers: number;
    newCustomers30d: number;
    pipeline: number;
    pipelineDeals: number;
    wonQuarter: number;
    wonDeals: number;
  };
  revenueByMonth: ChartPoint[];
  pipelineByStage: (ChartPoint & { count: number })[];
  customersByStatus: ChartPoint[];
  topDeals: Deal[];
  activity: Activity[];
}

export interface CustomerDetail {
  customer: Customer;
  deals: Deal[];
}
