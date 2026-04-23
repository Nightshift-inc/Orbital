// Types for the Orbital merchant dashboard.

export interface Subscription {
  id: string;
  tenant_id: string;
  tenant_name: string;
  plan_name: string;
  price_cents: number;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  current_period_start: string;
  current_period_end: string;
  seat_count: number;
  created_at: string;
}

export interface SubscriptionsResponse {
  subscriptions: Subscription[];
  total: number;
  showing: number;
}

export interface InvoiceSummary {
  id: string;
  tenant_name: string;
  total_cents: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'CAD';
  due_date: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  issued_at: string;
}

export interface Customer {
  id: string;
  name: string;
  contact_email: string;
  signed_up_at: string;
  plan: string;
  mrr_contribution_cents: number;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  region: string;
  seats: number;
}

export interface CustomersResponse {
  customers: Customer[];
  total: number;
}

export interface MRRPoint {
  month: string;
  mrr_cents: number;
}

export interface DashboardMetrics {
  mrr_cents: number;
  mrr_history: MRRPoint[];
  active_subscriptions: number;
  trial_subscriptions: number;
  failed_charges_last_7d: number;
  churn_rate_30d: number;
  new_signups_this_month: number;
  trial_conversion_rate_pct: number;
  as_of: string;
}

export interface ApiKey {
  id: string;
  prefix: string;
  masked_suffix: string;
  created_at: string;
  last_used_at: string;
  scopes: string[];
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'paused' | 'failing';
  created_at: string;
}

export interface TeamMember {
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
}

export interface Settings {
  tenant_id: string;
  company_name: string;
  billing_email: string;
  timezone: string;
  api_keys: ApiKey[];
  webhooks: WebhookConfig[];
  team_members: TeamMember[];
}

export interface FailedCharge {
  id: string;
  tenant: string;
  tenant_name: string;
  amount_cents: number;
  reason: string;
  occurred_at: string;
}

export interface LoginResponse {
  session_token: string;
  tenant_id: string;
  display_name: string;
}
