import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Customer,
  CustomerDetail,
  CustomerInput,
  CustomerPage,
  CustomerQuery,
  DashboardStats,
  Deal,
  DealStage,
} from './models';

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(HttpClient);

  list(query: CustomerQuery): Observable<CustomerPage> {
    return this.http.get<CustomerPage>('/api/customers', { params: { ...query } });
  }

  get(id: string): Observable<CustomerDetail> {
    return this.http.get<CustomerDetail>(`/api/customers/${id}`);
  }

  create(input: CustomerInput): Observable<Customer> {
    return this.http.post<Customer>('/api/customers', input);
  }

  update(id: string, input: CustomerInput): Observable<Customer> {
    return this.http.put<Customer>(`/api/customers/${id}`, input);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/customers/${id}`);
  }

  isEmailAvailable(email: string, excludeId?: string): Observable<{ available: boolean }> {
    const params: Record<string, string> = { email };
    if (excludeId) params['excludeId'] = excludeId;
    return this.http.get<{ available: boolean }>('/api/customers/check-email', { params });
  }
}

@Injectable({ providedIn: 'root' })
export class DealsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Deal[]> {
    return this.http.get<Deal[]>('/api/deals');
  }

  move(id: string, stage: DealStage): Observable<Deal> {
    return this.http.patch<Deal>(`/api/deals/${id}`, { stage });
  }
}

@Injectable({ providedIn: 'root' })
export class StatsApi {
  private readonly http = inject(HttpClient);

  get(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>('/api/stats');
  }
}
