import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { delay, mergeMap, of, throwError, timer } from 'rxjs';
import {
  Customer,
  CustomerInput,
  CustomerPage,
  CustomerStatus,
  DEAL_STAGES,
  DashboardStats,
  Deal,
  DealStage,
  User,
} from '../models';
import { DemoSettings } from '../demo-settings.service';
import { DEMO_USERS, db } from './mock-db';

/**
 * A fake REST backend implemented as an HTTP interceptor.
 * The app talks to `/api/*` with a normal HttpClient, exactly as it would to a real server,
 * so swapping in a real API means removing this interceptor and nothing else.
 */
interface Result {
  status: number;
  body: unknown;
}

const ok = (body: unknown, status = 200): Result => ({ status, body });
const fail = (status: number, message: string): Result => ({ status, body: { message } });

export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);

  const settings = inject(DemoSettings);
  const latency = Math.round(settings.latency() * (0.7 + Math.random() * 0.6));

  let result: Result;
  if (settings.simulateErrors() && !req.url.includes('/auth/') && Math.random() < 0.3) {
    result = fail(503, 'Service temporarily unavailable (simulated error).');
  } else {
    try {
      result = handle(req);
    } catch (e) {
      console.error('[mock-backend]', e);
      result = fail(500, 'Unexpected server error.');
    }
  }

  if (result.status >= 400) {
    const error = new HttpErrorResponse({
      status: result.status,
      error: result.body,
      url: req.url,
    });
    return timer(latency).pipe(mergeMap(() => throwError(() => error)));
  }
  return of(new HttpResponse({ status: result.status, body: result.body, url: req.url })).pipe(
    delay(latency),
  );
};

function handle(req: HttpRequest<unknown>): Result {
  const url = new URL(req.urlWithParams, 'http://mock.local');
  const [resource, ...rest] = url.pathname
    .replace(/^\/api\//, '')
    .split('/')
    .filter(Boolean);

  if (resource === 'auth' && rest[0] === 'login' && req.method === 'POST') {
    return login(req.body as { email?: string; password?: string });
  }

  const user = userFromToken(req.headers.get('Authorization'));
  if (!user) return fail(401, 'Your session has expired. Please sign in again.');

  switch (resource) {
    case 'stats':
      return ok(stats());
    case 'customers':
      return customers(req, rest, url.searchParams, user);
    case 'deals':
      return deals(req, rest, user);
    default:
      return fail(404, 'Not found.');
  }
}

/* ---------------------------------- auth --------------------------------- */

function login(body: { email?: string; password?: string } | null): Result {
  const match = DEMO_USERS.find(
    (u) =>
      u.email.toLowerCase() === body?.email?.trim().toLowerCase() && u.password === body?.password,
  );
  if (!match) return fail(401, 'Invalid email or password.');
  const { password: _password, ...user } = match;
  return ok({ token: `mock.${btoa(user.id)}`, user });
}

function userFromToken(header: string | null): User | null {
  const token = header?.replace(/^Bearer\s+/i, '');
  if (!token?.startsWith('mock.')) return null;
  try {
    const id = atob(token.slice(5));
    const found = DEMO_USERS.find((u) => u.id === id);
    if (!found) return null;
    const { password: _password, ...user } = found;
    return user;
  } catch {
    return null;
  }
}

/* --------------------------------- stats --------------------------------- */

function stats(): DashboardStats {
  const { customers, deals, revenueCurve, activity } = db.state;
  const paying = customers.filter((c) => c.status === 'active' || c.status === 'at-risk');
  const mrr = paying.reduce((s, c) => s + c.mrr, 0);
  const scale = mrr / revenueCurve[revenueCurve.length - 1];
  const now = new Date();
  const revenueByMonth = revenueCurve.map((v, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return { label: d.toLocaleString('en-US', { month: 'short' }), value: Math.round(v * scale) };
  });
  const prev = revenueByMonth[10].value;

  const monthAgo = Date.now() - 30 * 86_400_000;
  const newCustomers30d = customers.filter((c) => Date.parse(c.createdAt) > monthAgo).length;

  const open = deals.filter((d) => d.stage !== 'won');
  const won = deals.filter((d) => d.stage === 'won');

  const count = (s: CustomerStatus) => customers.filter((c) => c.status === s).length;

  return {
    kpis: {
      mrr,
      mrrDelta: prev ? ((mrr - prev) / prev) * 100 : 0,
      activeCustomers: paying.length,
      newCustomers30d,
      pipeline: open.reduce((s, d) => s + d.amount, 0),
      pipelineDeals: open.length,
      wonQuarter: won.reduce((s, d) => s + d.amount, 0),
      wonDeals: won.length,
    },
    revenueByMonth,
    pipelineByStage: DEAL_STAGES.filter((s) => s.id !== 'won').map((s) => {
      const inStage = open.filter((d) => d.stage === s.id);
      return {
        label: s.label,
        value: inStage.reduce((sum, d) => sum + d.amount, 0),
        count: inStage.length,
      };
    }),
    customersByStatus: [
      { label: 'Active', value: count('active') },
      { label: 'Lead', value: count('lead') },
      { label: 'At risk', value: count('at-risk') },
      { label: 'Churned', value: count('churned') },
    ],
    topDeals: [...open].sort((a, b) => b.amount - a.amount).slice(0, 5),
    activity: activity.slice(0, 7),
  };
}

/* ------------------------------- customers ------------------------------- */

function customers(
  req: HttpRequest<unknown>,
  rest: string[],
  params: URLSearchParams,
  user: User,
): Result {
  const [id] = rest;
  const all = db.state.customers;

  if (req.method === 'GET' && !id) return ok(listCustomers(params));

  if (req.method === 'GET' && id === 'check-email') {
    const email = (params.get('email') ?? '').trim().toLowerCase();
    const exclude = params.get('excludeId');
    return ok({ available: !all.some((c) => c.email === email && c.id !== exclude) });
  }

  if (req.method === 'POST' && !id) {
    const input = req.body as CustomerInput;
    const invalid = validate(input);
    if (invalid) return invalid;
    const customer: Customer = {
      ...input,
      email: input.email.trim().toLowerCase(),
      id: `c${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    all.unshift(customer);
    db.log('customer-created', `Added ${customer.name} from ${customer.company}`, user.name);
    db.save();
    return ok(customer, 201);
  }

  const index = all.findIndex((c) => c.id === id);
  if (index === -1) return fail(404, 'Customer not found.');

  if (req.method === 'GET') {
    return ok({ customer: all[index], deals: db.state.deals.filter((d) => d.customerId === id) });
  }

  if (req.method === 'PUT') {
    const input = req.body as CustomerInput;
    const invalid = validate(input, id);
    if (invalid) return invalid;
    all[index] = { ...all[index], ...input, email: input.email.trim().toLowerCase() };
    db.log('customer-updated', `Updated ${all[index].name}`, user.name);
    db.save();
    return ok(all[index]);
  }

  if (req.method === 'DELETE') {
    if (user.role !== 'admin') return fail(403, 'Only admins can delete customers.');
    const [removed] = all.splice(index, 1);
    db.state.deals = db.state.deals.filter((d) => d.customerId !== id);
    db.log('customer-deleted', `Removed ${removed.name} (${removed.company})`, user.name);
    db.save();
    return ok(null, 204);
  }

  return fail(405, 'Method not allowed.');
}

function validate(input: CustomerInput | null, selfId?: string): Result | null {
  if (!input?.name?.trim() || !input.email?.trim() || !input.company?.trim()) {
    return fail(422, 'Name, email and company are required.');
  }
  const email = input.email.trim().toLowerCase();
  if (db.state.customers.some((c) => c.email === email && c.id !== selfId)) {
    return fail(409, 'A customer with this email already exists.');
  }
  return null;
}

function listCustomers(params: URLSearchParams): CustomerPage {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const status = (params.get('status') ?? 'all') as CustomerStatus | 'all';
  const sort = (params.get('sort') ?? 'createdAt') as keyof Customer;
  const dir = params.get('dir') === 'asc' ? 1 : -1;
  const pageSize = Math.min(50, Math.max(5, Number(params.get('pageSize')) || 10));

  const matches = db.state.customers.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.email.includes(q) ||
      c.company.toLowerCase().includes(q),
  );
  const counts = { all: matches.length, lead: 0, active: 0, 'at-risk': 0, churned: 0 };
  for (const c of matches) counts[c.status]++;

  const rows = (status === 'all' ? matches : matches.filter((c) => c.status === status)).sort(
    (a, b) => {
      const x = a[sort];
      const y = b[sort];
      const cmp =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return cmp * dir;
    },
  );

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number(params.get('page')) || 1));
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
    counts,
  };
}

/* ---------------------------------- deals -------------------------------- */

function deals(req: HttpRequest<unknown>, rest: string[], user: User): Result {
  const [id] = rest;
  if (req.method === 'GET' && !id) return ok(db.state.deals);

  const deal = db.state.deals.find((d) => d.id === id);
  if (!deal) return fail(404, 'Deal not found.');

  if (req.method === 'PATCH') {
    const { stage } = req.body as { stage: DealStage };
    const label = DEAL_STAGES.find((s) => s.id === stage)?.label;
    if (!label) return fail(422, 'Unknown stage.');
    deal.stage = stage;
    if (stage === 'won') {
      deal.closeDate = new Date().toISOString();
      db.log('deal-won', `Closed “${deal.title}” with ${deal.company}`, user.name);
    } else {
      db.log('deal-moved', `Moved “${deal.title}” (${deal.company}) to ${label}`, user.name);
    }
    db.save();
    return ok(deal satisfies Deal);
  }

  return fail(405, 'Method not allowed.');
}
