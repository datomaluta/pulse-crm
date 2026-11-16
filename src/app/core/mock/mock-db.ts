import { Activity, Customer, CustomerStatus, Deal, DealStage, User } from '../models';
import { storage } from '../storage';

/** Deterministic PRNG so the demo data looks the same on every machine. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_USERS: (User & { password: string })[] = [
  {
    id: 'u1',
    name: 'Sarah Chen',
    email: 'admin@pulsecrm.io',
    password: 'demo1234',
    role: 'admin',
    title: 'Head of Sales',
  },
  {
    id: 'u2',
    name: 'Marcus Reid',
    email: 'sales@pulsecrm.io',
    password: 'demo1234',
    role: 'sales',
    title: 'Account Executive',
  },
];

export const OWNERS = ['Sarah Chen', 'Marcus Reid', 'Elena Petrova', 'James Okafor'];

export const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Germany',
  'Canada',
  'Netherlands',
  'Australia',
  'France',
  'Sweden',
  'Georgia',
  'Spain',
  'Japan',
  'Brazil',
];

export const TAG_SUGGESTIONS = [
  'Enterprise',
  'SMB',
  'Startup',
  'Partner',
  'Priority',
  'Trial',
  'Annual',
  'Monthly',
];

const FIRST = [
  'Olivia',
  'Liam',
  'Emma',
  'Noah',
  'Ava',
  'Lucas',
  'Mia',
  'Ethan',
  'Sofia',
  'Leo',
  'Isabella',
  'Mateo',
  'Chloe',
  'Daniel',
  'Zoe',
  'Adam',
  'Nora',
  'Henry',
  'Layla',
  'Oscar',
  'Elena',
  'Arjun',
  'Hana',
  'Felix',
];
const LAST = [
  'Walker',
  'Kim',
  'Novak',
  'Garcia',
  'Schmidt',
  'Patel',
  'Rossi',
  'Andersson',
  'Dubois',
  'Tanaka',
  'Silva',
  'Murphy',
  'Cohen',
  'Kowalski',
  'Haddad',
  'Jensen',
  'Okoro',
  'Lindqvist',
  'Moreau',
  'Becker',
];
const COMPANIES = [
  'Northwind Labs',
  'Brightpath',
  'Lumen Analytics',
  'Cobalt Systems',
  'Fernway',
  'Quantia',
  'Hearth & Co',
  'Skyline Logistics',
  'Vertex Health',
  'Bluebird Media',
  'Atlas Foods',
  'Copperleaf',
  'Orbit Retail',
  'Pinecrest Finance',
  'Riverstone',
  'Solace Travel',
  'Tidewater Energy',
  'Uplift Education',
  'Granite Works',
  'Nimbus Cloud',
  'Mosaic Studio',
  'Harbor Freight Co',
  'Kestrel Security',
  'Meridian Legal',
  'Polar Apparel',
  'Redwood Realty',
  'Signal Robotics',
  'Terra Farms',
  'Velocity Motors',
  'Willow Wellness',
];

const DEAL_TITLES = [
  'Annual license renewal',
  'Platform upgrade',
  'Team expansion (25 seats)',
  'Enterprise onboarding',
  'Analytics add-on',
  'Multi-region rollout',
  'Support plan upgrade',
  'API access tier',
  'Pilot program',
  'Data migration package',
];

export interface DbState {
  customers: Customer[];
  deals: Deal[];
  /** Relative revenue curve for the last 12 months (scaled to current MRR at read time). */
  revenueCurve: number[];
  activity: Activity[];
}

const DAY = 86_400_000;

function seed(): DbState {
  const rnd = mulberry32(20261116);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const now = Date.now();

  const customers: Customer[] = [];
  for (let i = 0; i < 124; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const company = pick(COMPANIES);
    const domain = company.toLowerCase().replace(/[^a-z]/g, '') + '.com';
    const r = rnd();
    const status: CustomerStatus =
      r < 0.5 ? 'active' : r < 0.7 ? 'lead' : r < 0.85 ? 'at-risk' : 'churned';
    const paying = status === 'active' || status === 'at-risk';
    const tags = TAG_SUGGESTIONS.filter(() => rnd() < 0.18).slice(0, 3);
    customers.push({
      id: `c${1000 + i}`,
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@${domain}`.toLowerCase(),
      phone: `+1 (${200 + Math.floor(rnd() * 700)}) 555-${String(1000 + Math.floor(rnd() * 8999)).slice(0, 4)}`,
      company,
      country: pick(COUNTRIES),
      status,
      mrr: paying ? Math.round((150 + rnd() ** 2 * 9000) / 10) * 10 : 0,
      owner: pick(OWNERS),
      createdAt: new Date(now - Math.floor(rnd() * 540) * DAY).toISOString(),
      tags,
      notes: '',
    });
  }

  const stages: DealStage[] = [
    'lead',
    'lead',
    'qualified',
    'qualified',
    'proposal',
    'proposal',
    'negotiation',
    'won',
    'won',
  ];
  const dealCustomers = customers.filter((c) => c.status !== 'churned');
  const deals: Deal[] = [];
  for (let i = 0; i < 42; i++) {
    const c = pick(dealCustomers);
    const stage = pick(stages);
    const offset = stage === 'won' ? -Math.floor(rnd() * 80) : 5 + Math.floor(rnd() * 85);
    deals.push({
      id: `d${500 + i}`,
      title: pick(DEAL_TITLES),
      customerId: c.id,
      company: c.company,
      amount: Math.round((2000 + rnd() ** 2 * 110_000) / 100) * 100,
      stage,
      owner: c.owner,
      closeDate: new Date(now + offset * DAY).toISOString(),
    });
  }

  const revenueCurve = Array.from(
    { length: 12 },
    (_, i) => (1 + i * 0.065) * (0.94 + rnd() * 0.12),
  );

  const activity: Activity[] = [
    ...deals
      .filter((d) => d.stage === 'won')
      .filter((d, i, won) => won.findIndex((x) => x.company === d.company) === i)
      .slice(0, 4)
      .map((d, i) => ({
        id: `a${i}`,
        type: 'deal-won' as const,
        text: `Closed “${d.title}” with ${d.company}`,
        who: d.owner,
        at: new Date(now - (i * 7 + 2) * 3_600_000).toISOString(),
      })),
    ...customers.slice(0, 4).map((c, i) => ({
      id: `a${10 + i}`,
      type: 'customer-created' as const,
      text: `Added ${c.name} from ${c.company}`,
      who: c.owner,
      at: new Date(now - (i * 9 + 5) * 3_600_000).toISOString(),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return { customers, deals, revenueCurve, activity };
}

const KEY = 'pulse-crm.db.v1';

/** In-memory "database" persisted to localStorage so demo edits survive a reload. */
export class MockDb {
  state: DbState = storage.get<DbState | null>(KEY, null) ?? seed();

  save(): void {
    storage.set(KEY, this.state);
  }

  reset(): void {
    this.state = seed();
    this.save();
  }

  log(type: Activity['type'], text: string, who: string): void {
    this.state.activity.unshift({
      id: crypto.randomUUID(),
      type,
      text,
      who,
      at: new Date().toISOString(),
    });
    this.state.activity = this.state.activity.slice(0, 30);
  }
}

export const db = new MockDb();
