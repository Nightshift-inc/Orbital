// HTTP client for the Orbital dashboard. All outbound calls go to api-gateway.
// This file is the canonical evidence of the dashboard -> api-gateway edge
// for Mode 2's dependency extractor.

import {
  Subscription,
  SubscriptionsResponse,
  InvoiceSummary,
  Customer,
  CustomersResponse,
  DashboardMetrics,
  Settings,
  FailedCharge,
  LoginResponse,
} from './types';

const GATEWAY_BASE =
  process.env.ORBITAL_API_URL ??
  process.env.NEXT_PUBLIC_ORBITAL_API_URL ??
  'http://localhost:4000';

async function request<T>(
  path: string,
  init: RequestInit = {},
  sessionToken?: string,
): Promise<T> {
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Orbital API error (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function listSubscriptions(sessionToken: string): Promise<SubscriptionsResponse> {
  return request<SubscriptionsResponse>('/api/subscriptions', {}, sessionToken);
}

export async function listInvoices(sessionToken: string): Promise<InvoiceSummary[]> {
  return request<InvoiceSummary[]>('/api/invoices', {}, sessionToken);
}

export async function getInvoice(sessionToken: string, id: string): Promise<InvoiceSummary> {
  return request<InvoiceSummary>(`/api/invoices/${id}`, {}, sessionToken);
}

export async function listCustomers(sessionToken: string): Promise<CustomersResponse> {
  return request<CustomersResponse>('/api/customers', {}, sessionToken);
}

export async function getMetrics(sessionToken: string): Promise<DashboardMetrics> {
  return request<DashboardMetrics>('/api/metrics', {}, sessionToken);
}

export async function getSettings(sessionToken: string): Promise<Settings> {
  return request<Settings>('/api/settings', {}, sessionToken);
}

export async function listFailedCharges(sessionToken: string): Promise<FailedCharge[]> {
  return request<FailedCharge[]>('/api/failed-charges', {}, sessionToken);
}

export async function createInvoice(
  sessionToken: string,
  body: { tenant_id: string; amount_cents: number; currency: string; due_date: string },
): Promise<InvoiceSummary> {
  return request<InvoiceSummary>('/api/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
  }, sessionToken);
}

// Keep Subscription exported for consumers that import it from this module.
export type { Subscription };
