import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/http-error';
import { ThemeService } from '../../core/theme.service';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <section class="brand-panel">
        <div class="brand">
          <span class="logo"><app-icon name="pulse" [size]="20" [stroke]="2.6" /></span>
          Pulse CRM
        </div>
        <div class="pitch">
          <h1>Every customer, deal and number in one place.</h1>
          <ul>
            <li><app-icon name="check" /> Live revenue and pipeline analytics</li>
            <li><app-icon name="check" /> Drag-and-drop deal board</li>
            <li><app-icon name="check" /> Role-based access for admins and reps</li>
          </ul>
        </div>
        <p class="foot">Portfolio demo · Angular 21 · Signals · RxJS</p>
      </section>

      <section class="form-panel">
        <button
          class="btn-icon theme"
          type="button"
          (click)="theme.toggle()"
          aria-label="Toggle theme"
        >
          <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" />
        </button>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <h2>Welcome back</h2>
          <p class="muted">Sign in to your workspace</p>

          @if (error(); as e) {
            <div class="alert" role="alert"><app-icon name="alert" [size]="16" /> {{ e }}</div>
          }

          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              class="input"
              type="email"
              formControlName="email"
              autocomplete="username"
              [class.invalid]="showError('email')"
            />
            @if (showError('email')) {
              <p class="error-text">Enter a valid email address.</p>
            }
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              class="input"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              [class.invalid]="showError('password')"
            />
            @if (showError('password')) {
              <p class="error-text">Password is required.</p>
            }
          </div>

          <button class="btn btn-primary submit" type="submit" [disabled]="loading()">
            @if (loading()) {
              <span class="spinner"></span> Signing in…
            } @else {
              Sign in
            }
          </button>

          <div class="demo">
            <span>Try a demo account</span>
            <div>
              <button
                class="btn btn-secondary"
                type="button"
                (click)="useDemo('admin@pulsecrm.io')"
              >
                Admin
              </button>
              <button
                class="btn btn-secondary"
                type="button"
                (click)="useDemo('sales@pulsecrm.io')"
              >
                Sales rep
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      min-height: 100vh;
    }
    .brand-panel {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 48px;
      color: #fff;
      background:
        radial-gradient(800px 400px at 0% 0%, rgb(255 255 255 / 0.16), transparent 60%),
        radial-gradient(600px 500px at 100% 100%, rgb(236 72 153 / 0.35), transparent 60%),
        linear-gradient(135deg, #4338ca, #6d28d9);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 700;
    }
    .logo {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgb(255 255 255 / 0.18);
    }
    .pitch h1 {
      font-size: clamp(28px, 3.2vw, 40px);
      line-height: 1.15;
      max-width: 460px;
      margin-bottom: 24px;
    }
    .pitch ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 12px;
      font-size: 15px;
      opacity: 0.92;
    }
    .pitch li {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pitch li app-icon {
      padding: 3px;
      border-radius: 50%;
      background: rgb(255 255 255 / 0.2);
    }
    .foot {
      margin: 0;
      font-size: 13px;
      opacity: 0.7;
    }

    .form-panel {
      position: relative;
      display: grid;
      place-items: center;
      padding: 40px 24px;
    }
    .theme {
      position: absolute;
      top: 20px;
      right: 20px;
    }
    form {
      width: min(380px, 100%);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    h2 {
      font-size: 26px;
      font-weight: 700;
    }
    form > .muted {
      margin: -10px 0 8px;
    }
    .alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: var(--danger-soft);
      color: var(--danger);
      font-size: 13.5px;
    }
    .submit {
      height: 42px;
      margin-top: 4px;
    }
    .demo {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 8px;
      padding-top: 20px;
      border-top: 1px dashed var(--border);
      span {
        font-size: 12.5px;
        color: var(--text-3);
        text-align: center;
      }
      div {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
    }

    @media (max-width: 860px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .brand-panel {
        padding: 24px;
        gap: 32px;
      }
      .pitch ul,
      .foot {
        display: none;
      }
      .pitch h1 {
        margin: 0;
        font-size: 24px;
      }
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  /** Bound from the `?returnUrl=` query param by the router. */
  readonly returnUrl = input<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly submitted = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected showError(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  protected useDemo(email: string): void {
    this.form.setValue({ email, password: 'demo1234' });
    this.submit();
  }

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl() || '/dashboard'),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
