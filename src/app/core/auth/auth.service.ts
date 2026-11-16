import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { Role, User } from '../models';
import { storage } from '../storage';

const TOKEN_KEY = 'pulse-crm.token';
const USER_KEY = 'pulse-crm.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(storage.get<User | null>(USER_KEY, null));
  private _token: string | null = storage.get<string | null>(TOKEN_KEY, null);

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  token(): string | null {
    return this._token;
  }

  hasRole(role: Role): boolean {
    return this._user()?.role === role;
  }

  login(email: string, password: string): Observable<User> {
    return this.http
      .post<{ token: string; user: User }>('/api/auth/login', { email, password })
      .pipe(
        tap(({ token, user }) => {
          this._token = token;
          storage.set(TOKEN_KEY, token);
          storage.set(USER_KEY, user);
          this._user.set(user);
        }),
        map(({ user }) => user),
      );
  }

  logout(): void {
    this._token = null;
    storage.remove(TOKEN_KEY);
    storage.remove(USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }
}
