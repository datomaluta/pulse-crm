import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme.service';
import { ConfirmDialog } from './shared/ui/confirm-dialog';
import { Toaster } from './shared/ui/toaster';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toaster, ConfirmDialog],
  template: `
    <router-outlet />
    <app-toaster />
    <app-confirm-dialog />
  `,
})
export class App {
  constructor() {
    inject(ThemeService); // applies the saved theme on startup
  }
}
