import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { DemoSettings } from '../../core/demo-settings.service';
import { DEMO_USERS, db } from '../../core/mock/mock-db';
import { ThemeService } from '../../core/theme.service';
import { Avatar } from '../../shared/ui/avatar';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-settings',
  imports: [Avatar, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <header class="page-header">
        <div>
          <h1>Settings</h1>
          <p>Workspace preferences. Only admins can see this page.</p>
        </div>
      </header>

      <section class="card">
        <div class="card-header"><h2>Appearance</h2></div>
        <div class="card-body">
          <div class="themes">
            <button
              type="button"
              class="theme-opt"
              [class.on]="theme.theme() === 'light'"
              (click)="theme.theme.set('light')"
            >
              <span class="preview light"><i></i><i></i></span>
              <span><app-icon name="sun" [size]="15" /> Light</span>
            </button>
            <button
              type="button"
              class="theme-opt"
              [class.on]="theme.theme() === 'dark'"
              (click)="theme.theme.set('dark')"
            >
              <span class="preview dark"><i></i><i></i></span>
              <span><app-icon name="moon" [size]="15" /> Dark</span>
            </button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Team</h2>
          <span class="muted">{{ team.length }} members</span>
        </div>
        <ul class="card-body team">
          @for (u of team; track u.id) {
            <li>
              <app-avatar [name]="u.name" [size]="36" />
              <div class="grow">
                <strong>{{ u.name }}</strong
                ><span>{{ u.email }}</span>
              </div>
              <span class="badge" [class.admin]="u.role === 'admin'">{{
                u.role === 'admin' ? 'Admin' : 'Sales rep'
              }}</span>
            </li>
          }
        </ul>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Demo API</h2>
          <span class="muted">Mock backend controls</span>
        </div>
        <div class="card-body rows">
          <div class="setting">
            <div>
              <strong>Network latency</strong>
              <p>Slow the fake API down to see loading states.</p>
            </div>
            <div class="range">
              <input
                type="range"
                min="0"
                max="2000"
                step="50"
                [value]="demo.latency()"
                (input)="demo.latency.set(+$any($event.target).value)"
                aria-label="Latency in milliseconds"
              />
              <output>{{ demo.latency() }} ms</output>
            </div>
          </div>
          <div class="setting">
            <div>
              <strong>Simulate server errors</strong>
              <p>About 30% of requests fail, so you can see error handling and retries.</p>
            </div>
            <button
              type="button"
              class="switch"
              role="switch"
              [attr.aria-checked]="demo.simulateErrors()"
              (click)="demo.simulateErrors.update((v) => !v)"
              aria-label="Simulate server errors"
            >
              <i></i>
            </button>
          </div>
          <div class="setting">
            <div>
              <strong>Reset demo data</strong>
              <p>Restore the original customers, deals and activity.</p>
            </div>
            <button type="button" class="btn btn-secondary" (click)="reset()">
              <app-icon name="refresh" [size]="16" /> Reset
            </button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: `
    .narrow {
      max-width: 860px;
    }
    .card + .card {
      margin-top: 16px;
    }

    .themes {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 180px));
      gap: 12px;
    }
    .theme-opt {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
      border: 2px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      cursor: pointer;
      text-align: left;
      font-weight: 500;
      &.on {
        border-color: var(--primary);
      }
      > span:last-child {
        display: flex;
        align-items: center;
        gap: 6px;
      }
    }
    .preview {
      display: flex;
      flex-direction: column;
      gap: 6px;
      height: 72px;
      padding: 10px;
      border-radius: 8px;
    }
    .preview i {
      height: 10px;
      border-radius: 4px;
    }
    .preview i:last-child {
      width: 60%;
    }
    .preview.light {
      background: #f5f6fa;
      border: 1px solid #e3e6ee;
    }
    .preview.light i {
      background: #dfe3ec;
    }
    .preview.dark {
      background: #0b0e17;
      border: 1px solid #242b3d;
    }
    .preview.dark i {
      background: #242b3d;
    }

    .team {
      list-style: none;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .team li {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .grow {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .grow span {
      font-size: 12.5px;
      color: var(--text-3);
    }
    .badge {
      background: var(--surface-2);
      color: var(--text-2);
    }
    .badge.admin {
      background: var(--primary-soft);
      color: var(--primary);
    }

    .rows {
      display: flex;
      flex-direction: column;
    }
    .setting {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 14px 0;
      flex-wrap: wrap;
    }
    .setting + .setting {
      border-top: 1px solid var(--border);
    }
    .setting p {
      margin: 2px 0 0;
      color: var(--text-3);
      font-size: 13px;
    }
    .range {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .range input {
      width: 180px;
      accent-color: var(--primary);
    }
    .range output {
      min-width: 64px;
      font-variant-numeric: tabular-nums;
      color: var(--text-2);
    }

    .switch {
      position: relative;
      width: 44px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: 99px;
      cursor: pointer;
      background: var(--border);
      transition: background 0.2s;
      i {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #fff;
        box-shadow: var(--shadow-sm);
        transition: transform 0.2s;
      }
      &[aria-checked='true'] {
        background: var(--primary);
      }
      &[aria-checked='true'] i {
        transform: translateX(20px);
      }
    }
  `,
})
export class SettingsPage {
  protected readonly theme = inject(ThemeService);
  protected readonly demo = inject(DemoSettings);
  protected readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly team = DEMO_USERS.map(({ password: _password, ...user }) => user);

  protected async reset(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Reset demo data?',
      message: 'All customers, deals and activity go back to their original state.',
      confirmText: 'Reset data',
      danger: true,
    });
    if (!ok) return;
    db.reset();
    this.toast.show('success', 'Demo data was reset.');
  }
}
