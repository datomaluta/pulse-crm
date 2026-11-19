import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  merge,
  switchMap,
  tap,
} from 'rxjs';
import { CustomersApi } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/http-error';
import {
  CUSTOMER_STATUSES,
  Customer,
  CustomerPage,
  CustomerQuery,
  SortField,
} from '../../core/models';
import { UsdPipe } from '../../shared/pipes/format.pipes';
import { Avatar } from '../../shared/ui/avatar';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ToastService } from '../../shared/ui/toast.service';

const DEFAULTS: CustomerQuery = {
  q: '',
  status: 'all',
  sort: 'createdAt',
  dir: 'desc',
  page: 1,
  pageSize: 10,
};
const SORTABLE: SortField[] = ['name', 'company', 'status', 'mrr', 'createdAt'];

/** Reads filters from the URL so every view (search, filter, sort, page) is shareable and survives reloads. */
function parseQuery(params: ParamMap): CustomerQuery {
  const status = params.get('status');
  const sort = params.get('sort') as SortField | null;
  return {
    q: params.get('q') ?? DEFAULTS.q,
    status: CUSTOMER_STATUSES.some((s) => s.id === status)
      ? (status as CustomerQuery['status'])
      : 'all',
    sort: sort && SORTABLE.includes(sort) ? sort : DEFAULTS.sort,
    dir: params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : DEFAULTS.dir,
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: [10, 25, 50].includes(Number(params.get('pageSize')))
      ? Number(params.get('pageSize'))
      : DEFAULTS.pageSize,
  };
}

@Component({
  selector: 'app-customers-list',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, Avatar, Icon, StatusBadge, UsdPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Customers</h1>
          <p>{{ page()?.counts?.all ?? '…' }} customers across all stages</p>
        </div>
        <a class="btn btn-primary" routerLink="new"
          ><app-icon name="plus" [size]="16" /> Add customer</a
        >
      </header>

      <div class="card">
        <div class="toolbar">
          <div class="input-icon search">
            <app-icon name="search" [size]="16" />
            <input
              class="input"
              type="search"
              placeholder="Search by name, email or company"
              [formControl]="search"
              aria-label="Search customers"
            />
          </div>
          <div class="segmented" role="tablist" aria-label="Filter by status">
            <button
              type="button"
              role="tab"
              [class.active]="query().status === 'all'"
              [attr.aria-selected]="query().status === 'all'"
              (click)="update({ status: 'all', page: 1 })"
            >
              All <span class="count">{{ page()?.counts?.all ?? '' }}</span>
            </button>
            @for (s of statuses; track s.id) {
              <button
                type="button"
                role="tab"
                [class.active]="query().status === s.id"
                [attr.aria-selected]="query().status === s.id"
                (click)="update({ status: s.id, page: 1 })"
              >
                {{ s.label }} <span class="count">{{ page()?.counts?.[s.id] ?? '' }}</span>
              </button>
            }
          </div>
        </div>

        @if (error(); as e) {
          <div class="state error">
            <span class="state-icon"><app-icon name="alert" /></span>
            <h3>Couldn’t load customers</h3>
            <p>{{ e }}</p>
            <button class="btn btn-primary" type="button" (click)="reload$.next()">
              Try again
            </button>
          </div>
        } @else {
          <div class="table-wrap" [class.loading]="loading() && page()">
            <table>
              <thead>
                <tr>
                  @for (col of columns; track col.field) {
                    <th
                      [class]="col.cls"
                      [attr.aria-sort]="
                        query().sort === col.field
                          ? query().dir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : null
                      "
                    >
                      <button type="button" class="sort" (click)="sortBy(col.field)">
                        {{ col.label }}
                        <app-icon
                          [name]="
                            query().sort === col.field
                              ? query().dir === 'asc'
                                ? 'arrow-up'
                                : 'arrow-down'
                              : 'sort'
                          "
                          [size]="13"
                          [class.on]="query().sort === col.field"
                        />
                      </button>
                    </th>
                  }
                  <th class="hide-md">Owner</th>
                  <th class="actions"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @if (!page() && loading()) {
                  @for (i of skeletonRows; track i) {
                    <tr class="sk">
                      <td colspan="7"><div class="skeleton"></div></td>
                    </tr>
                  }
                }
                @for (c of page()?.items ?? []; track c.id) {
                  <tr (click)="open(c)" tabindex="0" (keydown.enter)="open(c)">
                    <td>
                      <div class="person">
                        <app-avatar [name]="c.name" [size]="34" />
                        <div>
                          <strong>{{ c.name }}</strong>
                          <span>{{ c.email }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="hide-sm">{{ c.company }}</td>
                    <td><app-status-badge [status]="c.status" /></td>
                    <td class="num">{{ c.mrr ? (c.mrr | usd) : '—' }}</td>
                    <td class="hide-md muted">{{ c.createdAt | date: 'MMM d, y' }}</td>
                    <td class="hide-md">{{ c.owner }}</td>
                    <td class="actions" (click)="$event.stopPropagation()">
                      <div class="row-actions">
                        <a
                          class="btn-icon"
                          [routerLink]="[c.id, 'edit']"
                          aria-label="Edit {{ c.name }}"
                          title="Edit"
                          ><app-icon name="pencil" [size]="16"
                        /></a>
                        <button
                          class="btn-icon danger"
                          type="button"
                          (click)="remove(c)"
                          [disabled]="!auth.isAdmin()"
                          [attr.title]="auth.isAdmin() ? 'Delete' : 'Only admins can delete'"
                          [attr.aria-label]="'Delete ' + c.name"
                        >
                          <app-icon name="trash" [size]="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            @if (page()?.items?.length === 0) {
              <div class="state">
                <span class="state-icon"><app-icon name="inbox" /></span>
                <h3>No customers found</h3>
                <p>Try a different search term or status filter.</p>
                <button class="btn btn-secondary" type="button" (click)="clearFilters()">
                  Clear filters
                </button>
              </div>
            }
          </div>

          @if (page(); as p) {
            @if (p.total > 0) {
              <footer class="pager">
                <span class="muted">
                  Showing
                  <strong
                    >{{ (p.page - 1) * p.pageSize + 1 }}–{{
                      min(p.page * p.pageSize, p.total)
                    }}</strong
                  >
                  of <strong>{{ p.total }}</strong>
                </span>
                <div class="pager-controls">
                  <select
                    class="select page-size"
                    (change)="update({ pageSize: +$any($event.target).value, page: 1 })"
                    aria-label="Rows per page"
                  >
                    @for (size of pageSizes; track size) {
                      <option [value]="size" [selected]="size === p.pageSize">
                        {{ size }} / page
                      </option>
                    }
                  </select>
                  <button
                    class="btn-icon"
                    type="button"
                    [disabled]="p.page <= 1"
                    (click)="update({ page: p.page - 1 })"
                    aria-label="Previous page"
                  >
                    <app-icon name="chevron-left" />
                  </button>
                  @for (n of pageNumbers(); track $index) {
                    @if (n === null) {
                      <span class="gap">…</span>
                    } @else {
                      <button
                        class="page-btn"
                        type="button"
                        [class.active]="n === p.page"
                        (click)="update({ page: n })"
                        [attr.aria-current]="n === p.page ? 'page' : null"
                      >
                        {{ n }}
                      </button>
                    }
                  }
                  <button
                    class="btn-icon"
                    type="button"
                    [disabled]="p.page >= totalPages()"
                    (click)="update({ page: p.page + 1 })"
                    aria-label="Next page"
                  >
                    <app-icon name="chevron-right" />
                  </button>
                </div>
              </footer>
            }
          }
        }
      </div>
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 16px;
      border-bottom: 1px solid var(--border);
    }
    .search {
      flex: 1 1 280px;
      max-width: 360px;
    }

    .table-wrap {
      position: relative;
      overflow-x: auto;
      transition: opacity 0.15s;
    }
    .table-wrap.loading {
      opacity: 0.55;
      pointer-events: none;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      padding: 10px 16px;
      text-align: left;
      white-space: nowrap;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: var(--surface-2);
    }
    .sort {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      color: inherit;
      text-transform: inherit;
      letter-spacing: inherit;
      cursor: pointer;
      &:hover {
        color: var(--text);
      }
      app-icon {
        opacity: 0.5;
      }
      app-icon.on {
        opacity: 1;
        color: var(--primary);
      }
    }
    td {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      white-space: nowrap;
    }
    tbody tr {
      cursor: pointer;
      transition: background 0.12s;
    }
    tbody tr:hover,
    tbody tr:focus-visible {
      background: var(--surface-2);
      outline: none;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }
    th.num {
      text-align: right;
    }
    th.num .sort {
      flex-direction: row-reverse;
    }
    .person {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .person div {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .person strong {
      font-weight: 600;
    }
    .person span {
      font-size: 12.5px;
      color: var(--text-3);
    }
    .actions {
      width: 1%;
      text-align: right;
      padding-left: 8px;
    }
    .row-actions {
      display: flex;
      gap: 2px;
      justify-content: flex-end;
    }
    .sk td {
      padding: 14px 16px;
    }
    .sk .skeleton {
      height: 34px;
    }

    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      font-size: 13px;
    }
    .pager strong {
      color: var(--text);
      font-weight: 600;
    }
    .pager-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .page-size {
      width: auto;
      height: 34px;
      margin-right: 8px;
      font-size: 13px;
    }
    .page-btn {
      min-width: 34px;
      height: 34px;
      padding: 0 6px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-2);
      font-weight: 500;
      cursor: pointer;
      &:hover {
        background: var(--surface-2);
      }
      &.active {
        background: var(--primary);
        color: var(--primary-contrast);
      }
    }
    .gap {
      padding: 0 4px;
      color: var(--text-3);
    }

    @media (max-width: 1100px) {
      .hide-md {
        display: none;
      }
    }
    @media (max-width: 640px) {
      .hide-sm {
        display: none;
      }
      .search {
        max-width: none;
      }
      .page-btn,
      .gap {
        display: none;
      }
      .page-btn.active {
        display: inline-block;
      }
    }
  `,
})
export class CustomersListPage {
  private readonly api = inject(CustomersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthService);

  protected readonly statuses = CUSTOMER_STATUSES;
  protected readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);
  protected readonly min = Math.min;
  protected readonly pageSizes = [10, 25, 50];
  protected readonly columns: { field: SortField; label: string; cls?: string }[] = [
    { field: 'name', label: 'Customer' },
    { field: 'company', label: 'Company', cls: 'hide-sm' },
    { field: 'status', label: 'Status' },
    { field: 'mrr', label: 'MRR', cls: 'num' },
    { field: 'createdAt', label: 'Added', cls: 'hide-md' },
  ];

  private readonly query$ = this.route.queryParamMap.pipe(map(parseQuery));
  protected readonly query = toSignal(this.query$, { initialValue: DEFAULTS });
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly reload$ = new Subject<void>();

  protected readonly page = signal<CustomerPage | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly totalPages = computed(() => {
    const p = this.page();
    return p ? Math.max(1, Math.ceil(p.total / p.pageSize)) : 1;
  });

  /** Compact pagination: 1 … 4 5 6 … 13 */
  protected readonly pageNumbers = computed<(number | null)[]>(() => {
    const total = this.totalPages();
    const current = this.page()?.page ?? 1;
    const wanted = new Set(
      [1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total),
    );
    const sorted = [...wanted].sort((a, b) => a - b);
    return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? [null, n] : [n]));
  });

  constructor() {
    // Load whenever the URL query changes or a retry is requested; switchMap cancels stale requests.
    merge(this.query$, this.reload$.pipe(map(() => this.query())))
      .pipe(
        tap((q) => {
          if (this.search.value !== q.q) this.search.setValue(q.q, { emitEvent: false });
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((q) =>
          this.api.list(q).pipe(
            catchError((err) => {
              this.error.set(errorMessage(err));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.page.set(page);
        this.loading.set(false);
      });

    // Debounced search box → URL
    this.search.valueChanges
      .pipe(
        map((v) => v.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((q) => this.update({ q, page: 1 }));
  }

  protected update(patch: Partial<CustomerQuery>): void {
    const next = { ...this.query(), ...patch };
    const queryParams = Object.fromEntries(
      Object.entries(next).map(([k, v]) => [
        k,
        v === DEFAULTS[k as keyof CustomerQuery] ? null : v,
      ]),
    );
    this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }

  protected sortBy(field: SortField): void {
    const { sort, dir } = this.query();
    const nextDir =
      sort === field
        ? dir === 'asc'
          ? 'desc'
          : 'asc'
        : field === 'name' || field === 'company'
          ? 'asc'
          : 'desc';
    this.update({ sort: field, dir: nextDir, page: 1 });
  }

  protected clearFilters(): void {
    this.search.setValue('', { emitEvent: false });
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  protected open(c: Customer): void {
    this.router.navigate([c.id], { relativeTo: this.route });
  }

  protected async remove(c: Customer): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete ${c.name}?`,
      message: `This removes the customer and their ${c.company} deals. This can’t be undone.`,
      confirmText: 'Delete customer',
      danger: true,
    });
    if (!ok) return;
    this.api.remove(c.id).subscribe(() => {
      this.toast.show('success', `${c.name} was deleted.`);
      this.reload$.next();
    });
  }
}
