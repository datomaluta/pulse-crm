import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ChartPoint } from '../../core/models';

const COLORS = ['var(--c-success)', 'var(--c-info)', 'var(--c-warning)', 'var(--c-muted)'];
const R = 52;
const CIRC = 2 * Math.PI * R;

@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <svg viewBox="0 0 140 140" role="img" [attr.aria-label]="'Total ' + total()">
        <circle cx="70" cy="70" [attr.r]="r" class="track" />
        @for (s of segments(); track s.label) {
          <circle
            cx="70"
            cy="70"
            [attr.r]="r"
            class="seg"
            [class.dim]="hover() !== null && hover() !== $index"
            [attr.stroke]="s.color"
            [attr.stroke-dasharray]="s.dash + ' ' + (circ - s.dash)"
            [attr.stroke-dashoffset]="-s.offset"
            (pointerenter)="hover.set($index)"
            (pointerleave)="hover.set(null)"
          />
        }
      </svg>
      <div class="center">
        <strong>{{ centerValue() }}</strong>
        <span>{{ centerLabel() }}</span>
      </div>
    </div>
    <ul class="legend">
      @for (s of segments(); track s.label) {
        <li
          [class.dim]="hover() !== null && hover() !== $index"
          (pointerenter)="hover.set($index)"
          (pointerleave)="hover.set(null)"
        >
          <i [style.background]="s.color"></i>
          <span>{{ s.label }}</span>
          <strong>{{ s.value }}</strong>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .wrap {
      position: relative;
      width: 168px;
      aspect-ratio: 1;
    }
    svg {
      width: 100%;
      transform: rotate(-90deg);
    }
    .track {
      fill: none;
      stroke: var(--surface-2);
      stroke-width: 16;
    }
    .seg {
      fill: none;
      stroke-width: 16;
      transition: opacity 0.15s;
      cursor: pointer;
    }
    .dim {
      opacity: 0.3;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      strong {
        font-size: 26px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      span {
        font-size: 12px;
        color: var(--text-3);
      }
    }
    .legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
      min-width: 150px;
      font-size: 13px;
      li {
        display: flex;
        align-items: center;
        gap: 8px;
        transition: opacity 0.15s;
        cursor: default;
      }
      i {
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }
      span {
        flex: 1;
        color: var(--text-2);
      }
    }
  `,
})
export class DonutChart {
  readonly data = input.required<ChartPoint[]>();
  protected readonly r = R;
  protected readonly circ = CIRC;
  protected readonly hover = signal<number | null>(null);

  protected readonly total = computed(() => this.data().reduce((s, d) => s + d.value, 0));

  protected readonly segments = computed(() => {
    const total = this.total() || 1;
    let offset = 0;
    return this.data().map((d, i) => {
      const dash = (d.value / total) * CIRC;
      const seg = { ...d, color: COLORS[i % COLORS.length], dash, offset };
      offset += dash;
      return seg;
    });
  });

  protected readonly centerValue = computed(() => {
    const i = this.hover();
    return i === null ? this.total() : this.data()[i].value;
  });
  protected readonly centerLabel = computed(() => {
    const i = this.hover();
    return i === null ? 'Total' : this.data()[i].label;
  });
}
