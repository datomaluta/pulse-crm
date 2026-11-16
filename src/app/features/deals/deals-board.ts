import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DealsApi } from '../../core/api';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/http-error';
import { DEAL_STAGES, Deal, DealStage } from '../../core/models';
import { RelativeTimePipe, UsdPipe } from '../../shared/pipes/format.pipes';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-deals-board',
  imports: [
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    DatePipe,
    Avatar,
    Icon,
    UsdPipe,
    RelativeTimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page wide">
      <header class="page-header">
        <div>
          <h1>Deals pipeline</h1>
          <p>Drag a card to move a deal between stages.</p>
        </div>
        <div class="filters">
          <div class="input-icon">
            <app-icon name="search" [size]="16" />
            <input
              class="input"
              type="search"
              placeholder="Filter deals"
              [value]="term()"
              (input)="term.set($any($event.target).value)"
              aria-label="Filter deals"
            />
          </div>
          <div class="segmented">
            <button type="button" [class.active]="!mineOnly()" (click)="mineOnly.set(false)">
              All deals
            </button>
            <button type="button" [class.active]="mineOnly()" (click)="mineOnly.set(true)">
              My deals
            </button>
          </div>
        </div>
      </header>

      @if (error(); as e) {
        <div class="card state error">
          <span class="state-icon"><app-icon name="alert" /></span>
          <h3>Couldn’t load deals</h3>
          <p>{{ e }}</p>
          <button class="btn btn-primary" type="button" (click)="load()">Try again</button>
        </div>
      } @else {
        <div class="board" cdkDropListGroup>
          @for (col of columns(); track col.id) {
            <section class="column" [class.won]="col.id === 'won'">
              <header>
                <div class="col-title">
                  <i [class]="col.id"></i>{{ col.label }}
                  <span class="count">{{ col.deals.length }}</span>
                </div>
                <strong>{{ col.total | usd: 'compact' }}</strong>
              </header>
              <div
                class="cards"
                cdkDropList
                [id]="col.id"
                [cdkDropListData]="col.deals"
                (cdkDropListDropped)="drop($event, col.id)"
                [attr.aria-label]="col.label + ' deals'"
              >
                @if (loading()) {
                  @for (i of [1, 2, 3]; track i) {
                    <div class="skeleton sk-card"></div>
                  }
                }
                @for (deal of col.deals; track deal.id) {
                  <article
                    class="deal"
                    cdkDrag
                    [cdkDragData]="deal"
                    [class.saving]="savingId() === deal.id"
                    (click)="openCustomer(deal)"
                    tabindex="0"
                    (keydown.enter)="openCustomer(deal)"
                  >
                    <div class="deal-placeholder" *cdkDragPlaceholder></div>
                    <div class="deal-top">
                      <span class="company">{{ deal.company }}</span>
                      <app-icon name="grip" [size]="16" class="grip" />
                    </div>
                    <h3>{{ deal.title }}</h3>
                    <div class="deal-foot">
                      <strong>{{ deal.amount | usd }}</strong>
                      <span class="date" [title]="deal.closeDate | date: 'mediumDate'">
                        <app-icon name="calendar" [size]="13" />
                        {{
                          deal.stage === 'won'
                            ? 'Closed ' + (deal.closeDate | relative)
                            : (deal.closeDate | relative)
                        }}
                      </span>
                      <app-avatar [name]="deal.owner" [size]="24" />
                    </div>
                  </article>
                } @empty {
                  @if (!loading()) {
                    <p class="empty">No deals here</p>
                  }
                }
              </div>
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .wide {
      max-width: none;
    }
    .filters {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .filters .input-icon {
      width: 220px;
    }

    .board {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(270px, 1fr);
      gap: 14px;
      overflow-x: auto;
      padding-bottom: 12px;
      align-items: start;
    }
    .column {
      display: flex;
      flex-direction: column;
      min-height: 420px;
      border-radius: var(--radius);
      background: var(--surface-2);
      border: 1px solid var(--border);
    }
    .column > header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 14px 10px;
      font-size: 13.5px;
    }
    .col-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    .col-title i {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .col-title .lead {
      background: var(--c-muted);
    }
    .col-title .qualified {
      background: var(--c-info);
    }
    .col-title .proposal {
      background: #8b5cf6;
    }
    .col-title .negotiation {
      background: var(--c-warning);
    }
    .col-title .won {
      background: var(--c-success);
    }
    .count {
      padding: 1px 7px;
      border-radius: 99px;
      background: var(--surface);
      color: var(--text-3);
      font-size: 12px;
      font-weight: 500;
    }
    .won > header strong {
      color: var(--success);
    }

    .cards {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 4px 10px 12px;
      min-height: 120px;
    }
    .deal {
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      cursor: grab;
      transition:
        box-shadow 0.15s,
        border-color 0.15s,
        opacity 0.15s;
      &:hover {
        border-color: color-mix(in srgb, var(--border), var(--primary) 35%);
        box-shadow: var(--shadow);
      }
      &:active {
        cursor: grabbing;
      }
      &.saving {
        opacity: 0.6;
      }
      h3 {
        margin: 4px 0 12px;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.35;
      }
    }
    .deal-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .company {
      font-size: 12px;
      color: var(--text-3);
      font-weight: 500;
    }
    .grip {
      color: var(--text-3);
      opacity: 0;
      transition: opacity 0.15s;
    }
    .deal:hover .grip {
      opacity: 1;
    }
    .deal-foot {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .deal-foot strong {
      font-size: 14px;
    }
    .date {
      flex: 1;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--text-3);
    }
    .empty {
      margin: 8px 0;
      padding: 20px;
      text-align: center;
      font-size: 13px;
      color: var(--text-3);
      border: 1px dashed var(--border);
      border-radius: var(--radius-sm);
    }
    .sk-card {
      height: 104px;
    }

    .deal-placeholder {
      min-height: 96px;
      border-radius: var(--radius-sm);
      border: 2px dashed color-mix(in srgb, var(--primary), transparent 50%);
      background: var(--primary-soft);
    }
    .cdk-drag-preview {
      box-shadow: var(--shadow-lg);
      transform: rotate(2deg);
    }
    .cdk-drag-animating {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
    .cards.cdk-drop-list-dragging .deal:not(.cdk-drag-placeholder) {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }

    @media (max-width: 720px) {
      .filters,
      .filters .input-icon {
        width: 100%;
      }
      .board {
        grid-auto-columns: 82%;
        scroll-snap-type: x mandatory;
      }
      .column {
        scroll-snap-align: start;
      }
    }
  `,
})
export class DealsBoardPage {
  private readonly api = inject(DealsApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private readonly deals = signal<Deal[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly savingId = signal<string | null>(null);
  protected readonly term = signal('');
  protected readonly mineOnly = signal(false);

  private readonly visible = computed(() => {
    const term = this.term().trim().toLowerCase();
    const me = this.auth.user()?.name;
    return this.deals().filter(
      (d) =>
        (!this.mineOnly() || d.owner === me) &&
        (!term || d.title.toLowerCase().includes(term) || d.company.toLowerCase().includes(term)),
    );
  });

  protected readonly columns = computed(() =>
    DEAL_STAGES.map((stage) => {
      const deals = this.visible().filter((d) => d.stage === stage.id);
      return { ...stage, deals, total: deals.reduce((s, d) => s + d.amount, 0) };
    }),
  );

  /** Prevents a click from firing right after a drag ends. */
  private justDragged = false;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({
      next: (deals) => {
        this.deals.set(deals);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** Optimistic update: move the card immediately, roll back if the API call fails. */
  protected drop(event: CdkDragDrop<Deal[]>, stage: DealStage): void {
    this.justDragged = true;
    setTimeout(() => (this.justDragged = false));
    const deal: Deal = event.item.data;
    if (event.previousContainer === event.container || deal.stage === stage) return;

    const previous = deal.stage;
    this.setStage(deal.id, stage);
    this.savingId.set(deal.id);

    this.api.move(deal.id, stage).subscribe({
      next: () => {
        this.savingId.set(null);
        if (stage === 'won')
          this.toast.show('success', `Nice! ${deal.company} deal marked as won.`);
      },
      error: () => {
        this.savingId.set(null);
        this.setStage(deal.id, previous);
      },
    });
  }

  protected openCustomer(deal: Deal): void {
    if (!this.justDragged) this.router.navigate(['/customers', deal.customerId]);
  }

  private setStage(id: string, stage: DealStage): void {
    this.deals.update((list) => list.map((d) => (d.id === id ? { ...d, stage } : d)));
  }
}
