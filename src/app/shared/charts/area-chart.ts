import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { ChartPoint } from '../../core/models';
import { UsdPipe } from '../pipes/format.pipes';

const PAD = { top: 12, right: 12, bottom: 28, left: 52 };

/** Responsive SVG area chart with hover tooltip. Re-measures itself with a ResizeObserver. */
@Component({
  selector: 'app-area-chart',
  imports: [UsdPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" role="img" [attr.aria-label]="ariaLabel()">
      <defs>
        <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--primary)" stop-opacity=".28" />
          <stop offset="100%" stop-color="var(--primary)" stop-opacity="0" />
        </linearGradient>
      </defs>

      @for (t of ticks(); track t.value) {
        <line
          class="grid"
          [attr.x1]="pad.left"
          [attr.x2]="width() - pad.right"
          [attr.y1]="t.y"
          [attr.y2]="t.y"
        />
        <text
          class="axis"
          [attr.x]="pad.left - 10"
          [attr.y]="t.y"
          text-anchor="end"
          dominant-baseline="middle"
        >
          {{ t.value | usd: 'compact' }}
        </text>
      }
      @for (p of points(); track p.label; let i = $index) {
        @if (showLabel(i)) {
          <text class="axis" [attr.x]="p.x" [attr.y]="height() - 8" text-anchor="middle">
            {{ p.label }}
          </text>
        }
      }

      <path [attr.d]="areaPath()" fill="url(#area-fill)" />
      <path [attr.d]="linePath()" class="line" />

      @if (active(); as a) {
        <line
          class="cursor"
          [attr.x1]="a.x"
          [attr.x2]="a.x"
          [attr.y1]="pad.top"
          [attr.y2]="height() - pad.bottom"
        />
        <circle class="dot" [attr.cx]="a.x" [attr.cy]="a.y" r="5" />
      }

      <rect
        class="hit"
        [attr.x]="pad.left"
        [attr.y]="pad.top"
        [attr.width]="plotWidth()"
        [attr.height]="plotHeight()"
        (pointermove)="onMove($event)"
        (pointerleave)="hover.set(null)"
      />
    </svg>

    @if (active(); as a) {
      <div class="tooltip" [style.left.px]="a.x" [style.top.px]="a.y">
        <span>{{ a.label }}</span>
        <strong>{{ a.value | usd }}</strong>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
    }
    svg {
      display: block;
      overflow: visible;
    }
    .grid {
      stroke: var(--border);
      stroke-dasharray: 3 4;
    }
    .axis {
      fill: var(--text-3);
      font-size: 11px;
    }
    .line {
      fill: none;
      stroke: var(--primary);
      stroke-width: 2.5;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .cursor {
      stroke: var(--text-3);
      stroke-dasharray: 3 3;
    }
    .dot {
      fill: var(--surface);
      stroke: var(--primary);
      stroke-width: 2.5;
    }
    .hit {
      fill: transparent;
      cursor: crosshair;
    }
    .tooltip {
      position: absolute;
      pointer-events: none;
      transform: translate(-50%, calc(-100% - 14px));
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 10px;
      white-space: nowrap;
      background: var(--text);
      color: var(--bg);
      border-radius: 8px;
      font-size: 12px;
      box-shadow: var(--shadow);
      span {
        opacity: 0.7;
      }
    }
  `,
})
export class AreaChart {
  readonly data = input.required<ChartPoint[]>();
  readonly height = input(260);
  readonly ariaLabel = input('Chart');

  protected readonly pad = PAD;
  protected readonly width = signal(600);
  protected readonly hover = signal<number | null>(null);

  protected readonly plotWidth = computed(() => Math.max(0, this.width() - PAD.left - PAD.right));
  protected readonly plotHeight = computed(() => this.height() - PAD.top - PAD.bottom);

  private readonly maxY = computed(() => niceCeil(Math.max(1, ...this.data().map((d) => d.value))));

  protected readonly points = computed(() => {
    const data = this.data();
    const step = data.length > 1 ? this.plotWidth() / (data.length - 1) : 0;
    return data.map((d, i) => ({
      ...d,
      x: PAD.left + i * step,
      y: PAD.top + this.plotHeight() * (1 - d.value / this.maxY()),
    }));
  });

  protected readonly ticks = computed(() =>
    [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      value: this.maxY() * f,
      y: PAD.top + this.plotHeight() * (1 - f),
    })),
  );

  protected readonly linePath = computed(() =>
    this.points()
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' '),
  );

  protected readonly areaPath = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    const base = PAD.top + this.plotHeight();
    return `${this.linePath()} L${pts.at(-1)!.x},${base} L${pts[0].x},${base} Z`;
  });

  protected readonly active = computed(() => {
    const i = this.hover();
    return i === null ? null : (this.points()[i] ?? null);
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) =>
        this.width.set(Math.round(entry.contentRect.width)),
      );
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** Thin out x-axis labels on narrow screens so they never overlap. */
  protected showLabel(i: number): boolean {
    const every = Math.ceil(this.data().length / Math.max(1, Math.floor(this.plotWidth() / 48)));
    return i % every === 0 || i === this.data().length - 1;
  }

  protected onMove(event: PointerEvent): void {
    const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect();
    const n = this.data().length;
    const ratio = (event.clientX - rect.left) / rect.width;
    this.hover.set(Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1)))));
  }
}

function niceCeil(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const n = value / magnitude;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * magnitude;
}
