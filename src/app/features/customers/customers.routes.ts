import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/auth/guards';

export const CUSTOMER_ROUTES: Routes = [
  {
    path: '',
    title: 'Customers · Pulse CRM',
    loadComponent: () => import('./customers-list').then((m) => m.CustomersListPage),
  },
  {
    path: 'new',
    title: 'New customer · Pulse CRM',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./customer-form').then((m) => m.CustomerFormPage),
  },
  {
    path: ':id',
    title: 'Customer · Pulse CRM',
    loadComponent: () => import('./customer-detail').then((m) => m.CustomerDetailPage),
  },
  {
    path: ':id/edit',
    title: 'Edit customer · Pulse CRM',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./customer-form').then((m) => m.CustomerFormPage),
  },
];
