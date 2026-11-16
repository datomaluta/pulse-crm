import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  AsyncValidatorFn,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, first, map, of, switchMap, timer } from 'rxjs';
import { CustomersApi } from '../../core/api';
import { CanLeave } from '../../core/auth/guards';
import { errorMessage } from '../../core/http/http-error';
import { COUNTRIES, OWNERS, TAG_SUGGESTIONS } from '../../core/mock/mock-db';
import { CUSTOMER_STATUSES, CustomerInput, CustomerStatus } from '../../core/models';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast.service';

/** Paying customers (active / at risk) must have MRR above zero. */
const mrrMatchesStatus: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const status = group.get('status')?.value as CustomerStatus;
  const mrr = Number(group.get('mrr')?.value);
  return (status === 'active' || status === 'at-risk') && !(mrr > 0) ? { mrrRequired: true } : null;
};

const MESSAGES: Record<string, Record<string, string>> = {
  name: { required: 'Name is required.', minlength: 'Name must be at least 2 characters.' },
  email: {
    required: 'Email is required.',
    email: 'Enter a valid email address.',
    emailTaken: 'Another customer already uses this email.',
  },
  phone: { pattern: 'Use digits, spaces, +, - or parentheses.' },
  company: { required: 'Company is required.' },
  mrr: { min: 'MRR can’t be negative.', max: 'That looks too high. Max is $1,000,000.' },
  notes: { maxlength: 'Notes can be up to 500 characters.' },
};

type Field = keyof typeof MESSAGES;

@Component({
  selector: 'app-customer-form',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <a class="back" [routerLink]="id() ? ['/customers', id()] : '/customers'"
        ><app-icon name="arrow-left" [size]="16" /> Back</a
      >

      <header class="page-header">
        <div>
          <h1>{{ id() ? 'Edit customer' : 'New customer' }}</h1>
          <p>
            {{
              id()
                ? 'Update contact details, status and billing.'
                : 'Add a lead or a paying customer to your workspace.'
            }}
          </p>
        </div>
      </header>

      @if (loadError(); as e) {
        <div class="card state error">
          <span class="state-icon"><app-icon name="alert" /></span>
          <h3>Couldn’t load this customer</h3>
          <p>{{ e }}</p>
          <a class="btn btn-secondary" routerLink="/customers">Back to customers</a>
        </div>
      } @else {
        <form
          class="card"
          [formGroup]="form"
          (ngSubmit)="submit()"
          novalidate
          [class.busy]="!ready()"
        >
          <fieldset>
            <legend>Contact</legend>
            <div class="row">
              <div class="field">
                <label for="name">Full name *</label>
                <input
                  id="name"
                  class="input"
                  formControlName="name"
                  autocomplete="off"
                  [class.invalid]="!!error('name')"
                />
                @if (error('name'); as e) {
                  <p class="error-text">{{ e }}</p>
                }
              </div>
              <div class="field">
                <label for="email">Email *</label>
                <input
                  id="email"
                  class="input"
                  type="email"
                  formControlName="email"
                  autocomplete="off"
                  [class.invalid]="!!error('email')"
                />
                @if (error('email'); as e) {
                  <p class="error-text">{{ e }}</p>
                } @else if (form.controls.email.pending) {
                  <p class="hint">Checking availability…</p>
                }
              </div>
            </div>
            <div class="row">
              <div class="field">
                <label for="phone">Phone</label>
                <input
                  id="phone"
                  class="input"
                  type="tel"
                  formControlName="phone"
                  placeholder="+1 (555) 000-0000"
                  [class.invalid]="!!error('phone')"
                />
                @if (error('phone'); as e) {
                  <p class="error-text">{{ e }}</p>
                }
              </div>
              <div class="field">
                <label for="country">Country</label>
                <select id="country" class="select" formControlName="country">
                  @for (c of countries; track c) {
                    <option [value]="c">{{ c }}</option>
                  }
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Account</legend>
            <div class="row">
              <div class="field">
                <label for="company">Company *</label>
                <input
                  id="company"
                  class="input"
                  formControlName="company"
                  [class.invalid]="!!error('company')"
                />
                @if (error('company'); as e) {
                  <p class="error-text">{{ e }}</p>
                }
              </div>
              <div class="field">
                <label for="owner">Account owner</label>
                <select id="owner" class="select" formControlName="owner">
                  @for (o of owners; track o) {
                    <option [value]="o">{{ o }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="field">
              <span class="label">Status</span>
              <div class="status-pick" role="radiogroup" aria-label="Status">
                @for (s of statuses; track s.id) {
                  <label [class.on]="form.controls.status.value === s.id">
                    <input type="radio" formControlName="status" [value]="s.id" />
                    <i [class]="s.id"></i> {{ s.label }}
                  </label>
                }
              </div>
            </div>

            <div class="row">
              <div class="field">
                <label for="mrr">Monthly recurring revenue (USD)</label>
                <div class="money">
                  <span>$</span>
                  <input
                    id="mrr"
                    class="input"
                    type="number"
                    min="0"
                    step="10"
                    formControlName="mrr"
                    [class.invalid]="!!mrrError()"
                  />
                </div>
                @if (mrrError(); as e) {
                  <p class="error-text">{{ e }}</p>
                }
              </div>
              <div class="field">
                <label for="tag-input">Tags</label>
                <div class="tags-box" (click)="tagInput.focus()">
                  @for (t of form.controls.tags.value; track t; let i = $index) {
                    <span class="chip"
                      >{{ t }}
                      <button
                        type="button"
                        (click)="removeTag(i)"
                        [attr.aria-label]="'Remove ' + t"
                      >
                        <app-icon name="x" [size]="12" />
                      </button>
                    </span>
                  }
                  <input
                    #tagInput
                    id="tag-input"
                    placeholder="Add tag…"
                    (keydown)="onTagKey($event, tagInput)"
                    (blur)="addTag(tagInput)"
                  />
                </div>
                <div class="suggest">
                  @for (t of suggestions(); track t) {
                    <button type="button" class="chip" (click)="addTagValue(t)">+ {{ t }}</button>
                  }
                </div>
              </div>
            </div>

            <div class="field">
              <label for="notes">Notes</label>
              <textarea
                id="notes"
                class="textarea"
                formControlName="notes"
                rows="4"
                [class.invalid]="!!error('notes')"
              ></textarea>
              <div class="notes-foot">
                @if (error('notes'); as e) {
                  <p class="error-text">{{ e }}</p>
                } @else {
                  <span></span>
                }
                <span class="hint" [class.over]="notesLength() > 500">{{ notesLength() }}/500</span>
              </div>
            </div>
          </fieldset>

          <footer class="form-actions">
            <a class="btn btn-ghost" [routerLink]="id() ? ['/customers', id()] : '/customers'"
              >Cancel</a
            >
            <button class="btn btn-primary" type="submit" [disabled]="saving() || !ready()">
              @if (saving()) {
                <span class="spinner"></span> Saving…
              } @else {
                {{ id() ? 'Save changes' : 'Create customer' }}
              }
            </button>
          </footer>
        </form>
      }
    </div>
  `,
  styles: `
    .narrow {
      max-width: 860px;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 16px;
      color: var(--text-2);
      font-weight: 500;
    }
    form {
      padding: 8px 24px 0;
      transition: opacity 0.2s;
    }
    form.busy {
      opacity: 0.5;
      pointer-events: none;
    }
    fieldset {
      border: 0;
      margin: 0;
      padding: 20px 0;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    fieldset + fieldset {
      border-top: 1px solid var(--border);
    }
    legend {
      float: left;
      width: 100%;
      margin-bottom: 18px;
      font-size: 15px;
      font-weight: 600;
    }
    .row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }
    .label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-2);
    }

    .status-pick {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .status-pick label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 38px;
      padding: 0 14px;
      cursor: pointer;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-weight: 500;
      transition:
        border-color 0.15s,
        background 0.15s;
      &:hover {
        border-color: var(--text-3);
      }
      &.on {
        border-color: var(--primary);
        background: var(--primary-soft);
        color: var(--primary);
      }
      &:has(input:focus-visible) {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
      input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
      i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .active {
        background: var(--c-success);
      }
      .lead {
        background: var(--c-info);
      }
      .at-risk {
        background: var(--c-warning);
      }
      .churned {
        background: var(--c-muted);
      }
    }

    .money {
      position: relative;
    }
    .money span {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-3);
    }
    .money .input {
      padding-left: 26px;
    }

    .tags-box {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      min-height: 40px;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      cursor: text;
      &:focus-within {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-soft);
      }
      input {
        flex: 1;
        min-width: 80px;
        border: 0;
        outline: 0;
        background: transparent;
        padding: 2px 4px;
      }
      .chip {
        background: var(--primary-soft);
        color: var(--primary);
        padding-right: 4px;
      }
      .chip button {
        display: grid;
        place-items: center;
        width: 18px;
        height: 18px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: none;
        color: inherit;
        cursor: pointer;
      }
      .chip button:hover {
        background: rgb(0 0 0 / 0.08);
      }
    }
    .suggest {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .suggest .chip {
      border: 1px dashed var(--border);
      background: transparent;
      cursor: pointer;
      height: 24px;
      font-size: 12px;
    }
    .suggest .chip:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    .notes-foot {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .over {
      color: var(--danger);
    }

    .form-actions {
      position: sticky;
      bottom: 0;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin: 0 -24px;
      padding: 16px 24px;
      border-top: 1px solid var(--border);
      background: var(--surface);
      border-radius: 0 0 var(--radius) var(--radius);
    }

    @media (max-width: 640px) {
      form {
        padding: 4px 16px 0;
      }
      .row {
        grid-template-columns: minmax(0, 1fr);
      }
      .form-actions {
        margin: 0 -16px;
        padding: 12px 16px;
      }
      .form-actions .btn {
        flex: 1;
      }
    }
  `,
})
export class CustomerFormPage implements OnInit, CanLeave {
  private readonly api = inject(CustomersApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Route param; undefined on /customers/new. */
  readonly id = input<string>();

  protected readonly statuses = CUSTOMER_STATUSES;
  protected readonly countries = COUNTRIES;
  protected readonly owners = OWNERS;

  protected readonly form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: this.fb.control('', {
        validators: [Validators.required, Validators.email],
        asyncValidators: [this.uniqueEmail()],
        updateOn: 'blur',
      }),
      phone: ['', Validators.pattern(/^\+?[\d\s\-()]{7,20}$/)],
      company: ['', Validators.required],
      country: [COUNTRIES[0]],
      status: ['lead' as CustomerStatus],
      mrr: [0, [Validators.min(0), Validators.max(1_000_000)]],
      owner: [OWNERS[0]],
      tags: [[] as string[]],
      notes: ['', Validators.maxLength(500)],
    },
    { validators: mrrMatchesStatus },
  );

  /** Every form event bumps this signal so OnPush/zoneless templates re-render after async validation. */
  private readonly formEvents = toSignal(this.form.events);
  private readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly ready = signal(true);
  protected readonly loadError = signal<string | null>(null);
  private saved = false;

  protected readonly notesLength = computed(
    () => (this.formEvents(), this.form.controls.notes.value.length),
  );
  protected readonly suggestions = computed(() => {
    this.formEvents();
    const current = this.form.controls.tags.value;
    return TAG_SUGGESTIONS.filter((t) => !current.includes(t)).slice(0, 5);
  });

  ngOnInit(): void {
    const id = this.id();
    if (!id) return;
    this.ready.set(false);
    this.api.get(id).subscribe({
      next: ({ customer }) => {
        const { id: _id, createdAt: _createdAt, ...values } = customer;
        this.form.reset(values);
        this.ready.set(true);
      },
      error: (err) => this.loadError.set(errorMessage(err)),
    });
  }

  protected error(field: Field): string | null {
    this.formEvents();
    const control = this.form.get(field)!;
    if (!control.errors || !(control.touched || this.submitted())) return null;
    const key = Object.keys(control.errors)[0];
    return MESSAGES[field][key] ?? 'Invalid value.';
  }

  protected mrrError(): string | null {
    const own = this.error('mrr');
    if (own) return own;
    const touched =
      this.form.controls.mrr.touched || this.form.controls.status.dirty || this.submitted();
    return this.form.hasError('mrrRequired') && touched
      ? 'Active and at-risk customers need an MRR above $0.'
      : null;
  }

  protected onTagKey(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag(input);
    } else if (event.key === 'Backspace' && !input.value) {
      this.removeTag(this.form.controls.tags.value.length - 1);
    }
  }

  protected addTag(input: HTMLInputElement): void {
    this.addTagValue(input.value);
    input.value = '';
  }

  protected addTagValue(raw: string): void {
    const tag = raw.trim().replace(/,$/, '');
    const tags = this.form.controls.tags.value;
    if (!tag || tags.some((t) => t.toLowerCase() === tag.toLowerCase()) || tags.length >= 8) return;
    this.form.controls.tags.setValue([...tags, tag]);
    this.form.controls.tags.markAsDirty();
  }

  protected removeTag(index: number): void {
    if (index < 0) return;
    this.form.controls.tags.setValue(this.form.controls.tags.value.filter((_, i) => i !== index));
    this.form.controls.tags.markAsDirty();
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.pending) {
      // Wait for the email check to finish, then try again.
      this.form.statusChanges.pipe(first((s) => s !== 'PENDING')).subscribe(() => this.submit());
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      queueMicrotask(() => document.querySelector<HTMLElement>('form .invalid')?.focus());
      return;
    }

    const value = this.form.getRawValue();
    const input: CustomerInput = {
      ...value,
      mrr: Number(value.mrr) || 0,
      notes: value.notes.trim(),
    };
    const id = this.id();
    this.saving.set(true);
    (id ? this.api.update(id, input) : this.api.create(input)).subscribe({
      next: (customer) => {
        this.saved = true;
        this.toast.show('success', id ? 'Changes saved.' : `${customer.name} was added.`);
        this.router.navigate(['/customers', customer.id]);
      },
      error: () => this.saving.set(false),
    });
  }

  canLeave(): boolean | Promise<boolean> {
    if (this.saved || !this.form.dirty) return true;
    return this.confirm.ask({
      title: 'Discard changes?',
      message: 'You have unsaved changes on this form. If you leave now they’ll be lost.',
      confirmText: 'Discard',
      danger: true,
    });
  }

  /** Debounced server check that the email isn't used by another customer. */
  private uniqueEmail(): AsyncValidatorFn {
    return (control) => {
      const email = String(control.value ?? '').trim();
      if (!email || Validators.email(control)) return of(null);
      return timer(250).pipe(
        switchMap(() => this.api.isEmailAvailable(email, this.id())),
        map(({ available }) => (available ? null : { emailTaken: true })),
        catchError(() => of(null)),
      );
    };
  }
}
