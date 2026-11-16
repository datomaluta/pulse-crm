import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CUSTOMER_STATUSES, CustomerStatus } from '../../core/models';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge badge-' + status()"><i></i>{{ label() }}</span>`,
  styles: `
    .badge i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .badge-active {
      color: var(--success);
      background: var(--success-soft);
    }
    .badge-lead {
      color: var(--info);
      background: var(--info-soft);
    }
    .badge-at-risk {
      color: var(--warning);
      background: var(--warning-soft);
    }
    .badge-churned {
      color: var(--text-2);
      background: var(--surface-2);
    }
  `,
})
export class StatusBadge {
  readonly status = input.required<CustomerStatus>();
  protected readonly label = computed(
    () => CUSTOMER_STATUSES.find((s) => s.id === this.status())?.label ?? this.status(),
  );
}
