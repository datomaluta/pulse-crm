import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { Role } from '../models';
import { ToastService } from '../../shared/ui/toast.service';
import { AuthService } from './auth.service';

/** Only signed-in users; remembers where they were going. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (
    auth.isLoggedIn() || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })
  );
};

/** Keeps signed-in users away from the login page. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return !auth.isLoggedIn() || router.createUrlTree(['/dashboard']);
};

/** Role-based access, e.g. `canActivate: [roleGuard('admin')]`. */
export const roleGuard =
  (role: Role): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const toast = inject(ToastService);
    if (auth.hasRole(role)) return true;
    toast.show('error', 'You don’t have access to that page.');
    return router.createUrlTree(['/dashboard']);
  };

export interface CanLeave {
  canLeave(): boolean | Promise<boolean>;
}

/** Asks before leaving a form with unsaved changes. */
export const unsavedChangesGuard: CanDeactivateFn<CanLeave> = (component) => component.canLeave();
