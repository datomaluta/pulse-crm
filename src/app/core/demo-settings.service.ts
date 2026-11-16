import { Injectable, effect, signal } from '@angular/core';
import { storage } from './storage';

const KEY = 'pulse-crm.demo-settings';

/** Knobs for the fake backend, so reviewers can see loading and error states on purpose. */
@Injectable({ providedIn: 'root' })
export class DemoSettings {
  private readonly saved = storage.get(KEY, { latency: 450, simulateErrors: false });

  readonly latency = signal<number>(this.saved.latency);
  readonly simulateErrors = signal<boolean>(this.saved.simulateErrors);

  constructor() {
    effect(() =>
      storage.set(KEY, { latency: this.latency(), simulateErrors: this.simulateErrors() }),
    );
  }
}
