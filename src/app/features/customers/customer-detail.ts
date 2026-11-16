import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { CustomersApi } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/http-error';
import { Customer, DEAL_STAGES, DealStage } from '../../core/models';
import { UsdPipe } from '../../shared/pipes/format.pipes';
import { Avatar } from '../../shared/ui/avatar';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-customer-detail',
  imports: [RouterLink, DatePipe, Avatar, Icon, StatusBadge, UsdPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a class="back" routerLink="/customers"
        ><app-icon name="arrow-left" [size]="16" /> Customers</a
      >

      @if (detail.hasValue()) {
        @let c = detail.value().customer;
        <header class="hero card">
          <app-avatar [name]="c.name" [size]="64" />
          <div class="hero-info">
            <div class="title-row">
              <h1>{{ c.name }}</h1>
              <app-status-badge [status]="c.status" />
            </div>
            <p>{{ c.company }} · {{ c.country }}</p>
            @if (c.tags.length) {
              <div class="tags">
                @for (t of c.tags; track t) {
                  <span class="chip"><app-icon name="tag" [size]="12" /> {{ t }}</span>
                }
              </div>
            }
          </div>
          <div class="hero-actions">
            <a class="btn btn-secondary" [routerLink]="['edit']"
              ><app-icon name="pencil" [size]="16" /> Edit</a
            >
            @if (auth.isAdmin()) {
              <button class="btn btn-ghost danger" type="button" (click)="remove(c)">
                <app-icon name="trash" [size]="16" /> Delete
              </button>
            }
          </div>
        </header>

        <div class="grid">
          <section class="card">
            <div class="card-header"><h2>Details</h2></div>
            <dl class="card-body facts">
              <div>
                <dt><app-icon name="mail" [size]="15" /> Email</dt>
                <dd>
                  <a [href]="'mailto:' + c.email">{{ c.email }}</a>
                </dd>
              </div>
              <div>
                <dt><app-icon name="phone" [size]="15" /> Phone</dt>
                <dd>{{ c.phone || '—' }}</dd>
              </div>
              <div>
                <dt><app-icon name="building" [size]="15" /> Company</dt>
                <dd>{{ c.company }}</dd>
              </div>
              <div>
                <dt><app-icon name="globe" [size]="15" /> Country</dt>
                <dd>{{ c.country }}</dd>
              </div>
              <div>
                <dt><app-icon name="users" [size]="15" /> Account owner</dt>
                <dd>{{ c.owner }}</dd>
              </div>
              <div>
                <dt><app-icon name="calendar" [size]="15" /> Customer since</dt>
                <dd>{{ c.createdAt | date: 'MMMM d, y' }}</dd>
              </div>
            </dl>
          </section>

          <div class="side">
            <section class="card stat-row">
              <div>
                <span>MRR</span><strong>{{ c.mrr | usd }}</strong>
              </div>
              <div>
                <span>Open deals</span><strong>{{ openDeals() }}</strong>
              </div>
              <div>
                <span>Lifetime won</span><strong>{{ wonTotal() | usd: 'compact' }}</strong>
              </div>
            </section>

            <section class="card">
              <div class="card-header">
                <h2>Deals</h2>
                <a routerLink="/deals" class="link">Pipeline</a>
              </div>
              <ul class="card-body deals">
                @for (d of detail.value().deals; track d.id) {
                  <li>
                    <div>
                      <strong>{{ d.title }}</strong>
                      <span>{{ stageLabel(d.stage) }} · {{ d.closeDate | date: 'MMM d' }}</span>
                    </div>
                    <strong [class.won]="d.stage === 'won'">{{ d.amount | usd }}</strong>
                  </li>
                } @empty {
                  <li class="muted">No deals yet.</li>
                }
              </ul>
            </section>

            @if (c.notes) {
              <section class="card">
                <div class="card-header"><h2>Notes</h2></div>
                <p class="card-body notes">{{ c.notes }}</p>
              </section>
            }
          </div>
        </div>
      } @else if (detail.isLoading()) {
        <div class="card hero">
          <div class="skeleton" style="width: 64px; height: 64px; border-radius: 50%"></div>
          <div class="hero-info">
            <div class="skeleton" style="height: 24px; width: 240px"></div>
            <div class="skeleton" style="height: 14px; width: 160px; margin-top: 10px"></div>
          </div>
        </div>
      } @else if (detail.error(); as err) {
        <div class="card state error">
          <span class="state-icon"><app-icon name="alert" /></span>
          <h3>Couldn’t load this customer</h3>
          <p>{{ message(err) }}</p>
          <button class="btn btn-primary" type="button" (click)="detail.reload()">Try again</button>
        </div>
      }
    </div>
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 16px;
      color: var(--text-2);
      font-weight: 500;
    }
    .back:hover {
      color: var(--text);
    }
    .hero {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      padding: 24px;
      margin-bottom: 16px;
    }
    .hero-info {
      flex: 1;
      min-width: 200px;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    h1 {
      font-size: 24px;
    }
    .hero-info p {
      margin: 4px 0 0;
      color: var(--text-2);
    }
    .tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .hero-actions {
      display: flex;
      gap: 8px;
    }
    .danger {
      color: var(--danger);
    }
    .danger:hover {
      background: var(--danger-soft) !important;
      color: var(--danger) !important;
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .facts {
      margin: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
    }
    .facts dt {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: var(--text-3);
      margin-bottom: 4px;
    }
    .facts dd {
      margin: 0;
      font-weight: 500;
      overflow-wrap: anywhere;
    }

    .stat-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .stat-row div {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat-row div + div {
      border-left: 1px solid var(--border);
    }
    .stat-row span {
      font-size: 12.5px;
      color: var(--text-3);
    }
    .stat-row strong {
      font-size: 20px;
      letter-spacing: -0.02em;
    }

    .link {
      font-size: 13px;
      font-weight: 500;
    }
    .deals {
      list-style: none;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .deals li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .deals li div {
      display: flex;
      flex-direction: column;
    }
    .deals span {
      font-size: 12.5px;
      color: var(--text-3);
    }
    .won {
      color: var(--success);
    }
    .notes {
      margin: 0;
      white-space: pre-line;
      color: var(--text-2);
      line-height: 1.6;
    }

    @media (max-width: 960px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 520px) {
      .facts {
        grid-template-columns: minmax(0, 1fr);
      }
      .stat-row div {
        padding: 14px;
      }
      .stat-row strong {
        font-size: 17px;
      }
    }
  `,
})
export class CustomerDetailPage {
  private readonly api = inject(CustomersApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  protected readonly detail = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.api.get(id),
  });
  protected readonly message = errorMessage;

  protected readonly openDeals = computed(() =>
    this.detail.hasValue() ? this.detail.value().deals.filter((d) => d.stage !== 'won').length : 0,
  );
  protected readonly wonTotal = computed(() =>
    this.detail.hasValue()
      ? this.detail
          .value()
          .deals.filter((d) => d.stage === 'won')
          .reduce((s, d) => s + d.amount, 0)
      : 0,
  );

  protected stageLabel(stage: DealStage): string {
    return DEAL_STAGES.find((s) => s.id === stage)?.label ?? stage;
  }

  protected async remove(c: Customer): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete ${c.name}?`,
      message: 'This removes the customer and all of their deals. This can’t be undone.',
      confirmText: 'Delete customer',
      danger: true,
    });
    if (!ok) return;
    this.api.remove(c.id).subscribe(() => {
      this.toast.show('success', `${c.name} was deleted.`);
      this.router.navigate(['/customers']);
    });
  }
}
