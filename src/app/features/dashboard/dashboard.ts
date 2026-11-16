import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { StatsApi } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/http-error';
import { ActivityType } from '../../core/models';
import { AreaChart } from '../../shared/charts/area-chart';
import { DonutChart } from '../../shared/charts/donut-chart';
import { RelativeTimePipe, UsdPipe } from '../../shared/pipes/format.pipes';
import { Avatar } from '../../shared/ui/avatar';
import { Icon, IconName } from '../../shared/ui/icon';

const ACTIVITY_ICON: Record<ActivityType, IconName> = {
  'deal-won': 'trophy',
  'deal-moved': 'kanban',
  'customer-created': 'plus',
  'customer-updated': 'pencil',
  'customer-deleted': 'trash',
};

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, AreaChart, DonutChart, Avatar, Icon, UsdPipe, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>{{ greeting() }}, {{ firstName() }}</h1>
          <p>Here’s what’s happening with your pipeline today.</p>
        </div>
        <button
          class="btn btn-secondary"
          type="button"
          (click)="stats.reload()"
          [disabled]="stats.isLoading()"
        >
          <app-icon name="refresh" [size]="16" [class.spin]="stats.isLoading()" /> Refresh
        </button>
      </header>

      @if (stats.hasValue()) {
        @let s = stats.value();
        <section class="kpis" [class.reloading]="stats.isLoading()">
          <article class="card kpi">
            <div class="kpi-top">
              <span>Monthly recurring revenue</span
              ><i class="ic violet"><app-icon name="dollar" [size]="16" /></i>
            </div>
            <strong>{{ s.kpis.mrr | usd }}</strong>
            <span class="delta" [class.down]="s.kpis.mrrDelta < 0">
              <app-icon
                [name]="s.kpis.mrrDelta < 0 ? 'trending-down' : 'trending-up'"
                [size]="14"
              />
              {{ abs(s.kpis.mrrDelta).toFixed(1) }}% <em>vs last month</em>
            </span>
          </article>
          <article class="card kpi">
            <div class="kpi-top">
              <span>Paying customers</span
              ><i class="ic sky"><app-icon name="users" [size]="16" /></i>
            </div>
            <strong>{{ s.kpis.activeCustomers }}</strong>
            <span class="delta">
              <app-icon name="trending-up" [size]="14" />
              +{{ s.kpis.newCustomers30d }} <em>new in the last 30 days</em>
            </span>
          </article>
          <article class="card kpi">
            <div class="kpi-top">
              <span>Open pipeline</span
              ><i class="ic amber"><app-icon name="target" [size]="16" /></i>
            </div>
            <strong>{{ s.kpis.pipeline | usd: 'compact' }}</strong>
            <span class="delta neutral">{{ s.kpis.pipelineDeals }} <em>open deals</em></span>
          </article>
          <article class="card kpi">
            <div class="kpi-top">
              <span>Won this quarter</span
              ><i class="ic green"><app-icon name="trophy" [size]="16" /></i>
            </div>
            <strong>{{ s.kpis.wonQuarter | usd: 'compact' }}</strong>
            <span class="delta neutral">{{ s.kpis.wonDeals }} <em>deals closed</em></span>
          </article>
        </section>

        <section class="grid">
          <article class="card revenue">
            <div class="card-header">
              <h2>Revenue</h2>
              <span class="muted">Last 12 months</span>
            </div>
            <div class="card-body">
              <app-area-chart
                [data]="s.revenueByMonth"
                [height]="330"
                ariaLabel="Monthly revenue for the last 12 months"
              />
            </div>
          </article>

          <article class="card">
            <div class="card-header">
              <h2>Customers by status</h2>
              <a routerLink="/customers" class="link">View all</a>
            </div>
            <div class="card-body donut-body">
              <app-donut-chart [data]="s.customersByStatus" />
            </div>
          </article>

          <article class="card">
            <div class="card-header">
              <h2>Pipeline by stage</h2>
              <a routerLink="/deals" class="link">Open board</a>
            </div>
            <div class="card-body stages">
              @for (stage of s.pipelineByStage; track stage.label) {
                <div class="stage">
                  <div class="stage-row">
                    <span
                      >{{ stage.label }} <em>· {{ stage.count }}</em></span
                    >
                    <strong>{{ stage.value | usd: 'compact' }}</strong>
                  </div>
                  <div class="bar"><i [style.width.%]="(stage.value / maxStage()) * 100"></i></div>
                </div>
              }
            </div>
          </article>

          <article class="card">
            <div class="card-header">
              <h2>Biggest open deals</h2>
            </div>
            <ul class="card-body list">
              @for (deal of s.topDeals; track deal.id) {
                <li>
                  <a [routerLink]="['/customers', deal.customerId]">
                    <app-avatar [name]="deal.company" [size]="34" />
                    <div class="grow">
                      <strong>{{ deal.company }}</strong>
                      <span>{{ deal.title }}</span>
                    </div>
                    <strong class="amount">{{ deal.amount | usd }}</strong>
                  </a>
                </li>
              }
            </ul>
          </article>

          <article class="card">
            <div class="card-header">
              <h2>Recent activity</h2>
            </div>
            <ul class="card-body feed">
              @for (a of s.activity; track a.id) {
                <li>
                  <i class="feed-ic" [class]="a.type"
                    ><app-icon [name]="activityIcon[a.type]" [size]="14"
                  /></i>
                  <div>
                    <p>{{ a.text }}</p>
                    <span>{{ a.who }} · {{ a.at | relative }}</span>
                  </div>
                </li>
              } @empty {
                <li class="muted">No activity yet.</li>
              }
            </ul>
          </article>
        </section>
      } @else if (stats.isLoading()) {
        <section class="kpis">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card kpi">
              <div class="skeleton" style="height: 14px; width: 60%"></div>
              <div class="skeleton" style="height: 28px; width: 45%"></div>
              <div class="skeleton" style="height: 12px; width: 50%"></div>
            </div>
          }
        </section>
        <section class="grid">
          <div class="card revenue skeleton-card">
            <div class="skeleton" style="height: 100%"></div>
          </div>
          <div class="card skeleton-card"><div class="skeleton" style="height: 100%"></div></div>
        </section>
      } @else if (stats.error(); as err) {
        <div class="card state error">
          <span class="state-icon"><app-icon name="alert" /></span>
          <h3>Couldn’t load the dashboard</h3>
          <p>{{ message(err) }}</p>
          <button class="btn btn-primary" type="button" (click)="stats.reload()">Try again</button>
        </div>
      }
    </div>
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 16px;
      transition: opacity 0.2s;
    }
    .reloading {
      opacity: 0.6;
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 18px 20px;
    }
    .kpi-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--text-2);
      font-size: 13px;
      font-weight: 500;
    }
    .kpi strong {
      font-size: 27px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .ic {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 9px;
    }
    .violet {
      background: var(--primary-soft);
      color: var(--primary);
    }
    .sky {
      background: var(--info-soft);
      color: var(--info);
    }
    .amber {
      background: var(--warning-soft);
      color: var(--warning);
    }
    .green {
      background: var(--success-soft);
      color: var(--success);
    }
    .delta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--success);
      em {
        font-style: normal;
        font-weight: 400;
        color: var(--text-3);
      }
      &.down {
        color: var(--danger);
      }
      &.neutral {
        color: var(--text);
      }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
    .revenue {
      grid-column: span 2;
    }
    .link {
      font-size: 13px;
      font-weight: 500;
    }
    .donut-body {
      display: grid;
      place-items: center;
      min-height: 260px;
    }

    .stages {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .stage-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .stage-row em {
      font-style: normal;
      color: var(--text-3);
    }
    .bar {
      height: 8px;
      border-radius: 99px;
      background: var(--surface-2);
      overflow: hidden;
    }
    .bar i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      transition: width 0.5s ease;
    }

    .list,
    .feed {
      list-style: none;
      margin: 0;
      display: flex;
      flex-direction: column;
    }
    .list a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 8px;
      margin: 0 -8px;
      border-radius: var(--radius-sm);
      color: inherit;
    }
    .list a:hover {
      background: var(--surface-2);
    }
    .grow {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .grow strong {
      font-size: 13.5px;
    }
    .grow span {
      font-size: 12.5px;
      color: var(--text-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .amount {
      font-size: 13.5px;
    }

    .feed {
      gap: 14px;
    }
    .feed li {
      display: flex;
      gap: 12px;
    }
    .feed p {
      margin: 0;
      font-size: 13.5px;
    }
    .feed span {
      font-size: 12px;
      color: var(--text-3);
    }
    .feed-ic {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--surface-2);
      color: var(--text-2);
    }
    .feed-ic.deal-won {
      background: var(--success-soft);
      color: var(--success);
    }
    .feed-ic.customer-created {
      background: var(--primary-soft);
      color: var(--primary);
    }
    .feed-ic.customer-deleted {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .skeleton-card {
      height: 340px;
      padding: 20px;
    }
    .kpi .skeleton {
      border-radius: 6px;
    }
    .spin {
      animation: spin 0.8s linear infinite;
    }

    @media (max-width: 1200px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 720px) {
      .kpis {
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
      }
      .grid {
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
      }
      .revenue {
        grid-column: auto;
      }
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(StatsApi);
  private readonly auth = inject(AuthService);

  protected readonly stats = rxResource({ stream: () => this.api.get() });
  protected readonly activityIcon = ACTIVITY_ICON;
  protected readonly abs = Math.abs;
  protected readonly message = errorMessage;

  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  });
  protected readonly maxStage = computed(() =>
    this.stats.hasValue()
      ? Math.max(1, ...this.stats.value().pipelineByStage.map((s) => s.value))
      : 1,
  );
}
