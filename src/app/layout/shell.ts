import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/theme.service';
import { Avatar } from '../shared/ui/avatar';
import { Icon, IconName } from '../shared/ui/icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar" [class.open]="menuOpen()">
      <a class="brand" routerLink="/dashboard">
        <span class="logo"><app-icon name="pulse" [size]="18" [stroke]="2.6" /></span>
        Pulse CRM
      </a>

      <nav aria-label="Main">
        <span class="nav-label">Workspace</span>
        @for (item of nav; track item.path) {
          @if (!item.adminOnly || auth.isAdmin()) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              #rla="routerLinkActive"
              [attr.aria-current]="rla.isActive ? 'page' : null"
            >
              <app-icon [name]="item.icon" />
              {{ item.label }}
            </a>
          }
        }
      </nav>

      @if (auth.user(); as user) {
        <div class="profile">
          <app-avatar [name]="user.name" [size]="36" />
          <div class="who">
            <strong>{{ user.name }}</strong>
            <span>{{ user.role === 'admin' ? 'Admin' : 'Sales rep' }}</span>
          </div>
          <button
            class="btn-icon"
            type="button"
            (click)="auth.logout()"
            aria-label="Sign out"
            title="Sign out"
          >
            <app-icon name="logout" />
          </button>
        </div>
      }
    </aside>

    @if (menuOpen()) {
      <div class="scrim" (click)="menuOpen.set(false)"></div>
    }

    <div class="main">
      <header class="topbar">
        <button
          class="btn-icon menu"
          type="button"
          (click)="menuOpen.set(true)"
          aria-label="Open menu"
        >
          <app-icon name="menu" />
        </button>

        <form class="search input-icon" role="search" (submit)="search($event, q.value)">
          <app-icon name="search" [size]="16" />
          <input
            #q
            class="input"
            type="search"
            placeholder="Search customers…"
            aria-label="Search customers"
          />
          <kbd>/</kbd>
        </form>

        <div class="spacer"></div>

        <button
          class="btn-icon"
          type="button"
          (click)="theme.toggle()"
          [attr.aria-label]="'Switch to ' + (theme.theme() === 'dark' ? 'light' : 'dark') + ' mode'"
        >
          <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" />
        </button>
        @if (auth.user(); as user) {
          <app-avatar class="top-avatar" [name]="user.name" [size]="34" />
        }
      </header>

      <main>
        <router-outlet />
      </main>
    </div>
  `,
  host: { '(document:keydown)': 'onKey($event)' },
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }

    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 30;
      width: var(--sidebar-w);
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 18px 14px;
      background: var(--surface);
      border-right: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 8px 18px;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }
    .logo {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 9px;
      color: #fff;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      box-shadow: 0 4px 12px -2px rgb(99 102 241 / 0.5);
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }
    .nav-label {
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-3);
    }
    nav a {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 40px;
      padding: 0 12px;
      border-radius: var(--radius-sm);
      color: var(--text-2);
      font-weight: 500;
      transition:
        background 0.15s,
        color 0.15s;
      &:hover {
        background: var(--surface-2);
        color: var(--text);
      }
      &.active {
        background: var(--primary-soft);
        color: var(--primary);
      }
    }
    .profile {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 8px 4px;
      border-top: 1px solid var(--border);
      .who {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      strong {
        font-size: 13.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      span {
        font-size: 12px;
        color: var(--text-3);
      }
    }

    .main {
      margin-left: var(--sidebar-w);
      min-width: 0;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 8px;
      height: var(--topbar-h);
      padding: 0 24px;
      background: color-mix(in srgb, var(--bg) 82%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
    }
    .search {
      width: min(380px, 100%);
    }
    .search .input {
      height: 38px;
      background: var(--surface);
      padding-right: 36px;
    }
    .search kbd {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      padding: 1px 6px;
      border: 1px solid var(--border);
      border-radius: 5px;
      font: 11px/1.4 inherit;
      color: var(--text-3);
    }
    .spacer {
      flex: 1;
    }
    .menu {
      display: none;
    }
    .top-avatar {
      margin-left: 4px;
    }
    .scrim {
      display: none;
    }

    @media (max-width: 960px) {
      .sidebar {
        transform: translateX(-100%);
        transition: transform 0.22s ease;
        box-shadow: var(--shadow-lg);
      }
      .sidebar.open {
        transform: none;
      }
      .scrim {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 25;
        background: rgb(8 12 24 / 0.45);
      }
      .main {
        margin-left: 0;
      }
      .menu {
        display: inline-grid;
      }
      .topbar {
        padding: 0 16px;
      }
      .search kbd {
        display: none;
      }
    }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/customers', label: 'Customers', icon: 'users' },
    { path: '/deals', label: 'Deals pipeline', icon: 'kanban' },
    { path: '/settings', label: 'Settings', icon: 'settings', adminOnly: true },
  ];

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected search(event: Event, value: string): void {
    event.preventDefault();
    this.router.navigate(['/customers'], { queryParams: { q: value.trim() || null } });
  }

  /** "/" focuses search, Escape closes the mobile menu. */
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const typing =
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    if (event.key === '/' && !typing) {
      event.preventDefault();
      document.querySelector<HTMLInputElement>('.topbar input[type=search]')?.focus();
    }
    if (event.key === 'Escape') this.menuOpen.set(false);
  }
}
