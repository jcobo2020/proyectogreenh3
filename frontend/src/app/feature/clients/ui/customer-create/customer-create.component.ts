import { Component, ElementRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { loginUrl } from '../../../../@core/guards/auth.guard';
import { NoticeService } from '../../../../@core/services/notice.service';
import {
  CreateCustomerUseCase,
  ListProvincesUseCase,
  ListTownsUseCase,
} from '../../application/customer.use-cases';
import {
  CustomerBusinessRuleError,
  CustomerSessionExpiredError,
  DuplicateCustomerEmailError,
  InvalidCustomerInputError,
} from '../../domain/errors/customer.errors';
import { NewCustomer, Province, Town } from '../../domain/models/customer.model';

type Campo = 'name' | 'email' | 'streetAddress' | 'provinceId' | 'townId' | 'status';

/** Mensajes literales de «obligatorio» de la spec. */
const OBLIGATORIO: Record<Campo, string> = {
  name: 'Nombre es obligatorio.',
  email: 'Email es obligatorio.',
  streetAddress: 'Dirección es obligatoria.',
  provinceId: 'Provincia es obligatoria.',
  townId: 'Población es obligatoria.',
  status: 'Estado es obligatorio.',
};

const ORDEN: Campo[] = ['name', 'email', 'streetAddress', 'provinceId', 'townId', 'status'];
const GENERIC_ERROR = 'No se pudo cargar. Vuelve a intentarlo.';

/** Aviso de un fallo: su texto y si pide volver a entrar. */
interface Aviso {
  texto: string;
  sesion: boolean;
}

function aviso(error: unknown): Aviso {
  if (error instanceof InvalidCustomerInputError) return { texto: 'Revisa los datos marcados.', sesion: false };
  if (error instanceof CustomerSessionExpiredError)
    return { texto: 'Tu sesión terminó: vuelve a entrar.', sesion: true };
  if (error instanceof DuplicateCustomerEmailError)
    return { texto: 'Ya existe otro con el mismo «Email».', sesion: false };
  if (error instanceof CustomerBusinessRuleError)
    return { texto: 'No se pudo por una regla del negocio.', sesion: false };
  return { texto: GENERIC_ERROR, sesion: false };
}

@Component({
  selector: 'app-customer-create',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './customer-create.component.html',
  styleUrl: './customer-create.component.css',
})
export class CustomerCreateComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notice = inject(NoticeService);
  private readonly listProvinces = inject(ListProvincesUseCase);
  private readonly listTowns = inject(ListTownsUseCase);
  private readonly createCustomer = inject(CreateCustomerUseCase);
  private townsSub?: Subscription;
  private townsRequest = 0;
  /** Idempotency-Key del intento de envío en curso, con el cuerpo al que pertenece. */
  private intento: { key: string; cuerpo: string } | null = null;

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true }),
    streetAddress: new FormControl('', { nonNullable: true }),
    provinceId: new FormControl('', { nonNullable: true }),
    townId: new FormControl({ value: '', disabled: true }, { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });

  protected readonly provinces = signal<Province[]>([]);
  protected readonly towns = signal<Town[]>([]);
  protected readonly loadingProvinces = signal(true);
  protected readonly loadingTowns = signal(false);
  protected readonly provincesError = signal<Aviso | null>(null);
  protected readonly townsError = signal<Aviso | null>(null);
  protected readonly submitted = signal(false);
  protected readonly sending = signal(false);
  protected readonly submitError = signal<Aviso | null>(null);
  protected readonly loginHref = loginUrl('/clientes/nuevo');
  protected readonly statuses = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
  ];

  ngOnInit(): void {
    this.loadProvinces();
    this.form.controls.provinceId.valueChanges.subscribe((provinceId) => this.onProvinceChange(provinceId));
  }

  ngOnDestroy(): void {
    this.townsSub?.unsubscribe();
  }

  /** «Crear cliente» no se pulsa mientras falle una carga de opciones, ni mientras envía. */
  protected get blocked(): boolean {
    return this.sending() || !!this.provincesError() || !!this.townsError();
  }

  protected loadProvinces(): void {
    this.loadingProvinces.set(true);
    this.provincesError.set(null);
    // Una vez, al entrar (sin caché): se pide al servidor.
    this.listProvinces.execute().subscribe({
      next: (provinces) => {
        this.provinces.set(provinces);
        this.loadingProvinces.set(false);
      },
      error: (error) => {
        this.loadingProvinces.set(false);
        this.provincesError.set(aviso(error));
      },
    });
  }

  protected loadTowns(): void {
    const provinceId = this.form.controls.provinceId.value;
    if (!provinceId) return;
    const request = ++this.townsRequest;
    this.townsSub?.unsubscribe();
    this.loadingTowns.set(true);
    this.townsError.set(null);
    this.townsSub = this.listTowns.execute(provinceId).subscribe({
      next: (towns) => {
        if (request !== this.townsRequest) return;
        this.towns.set(towns);
        this.loadingTowns.set(false);
      },
      error: (error) => {
        if (request !== this.townsRequest) return;
        this.loadingTowns.set(false);
        this.townsError.set(aviso(error));
      },
    });
  }

  /** Al cambiar «Provincia»: vacía «Población», la activa si hay valor y recarga sus opciones. */
  private onProvinceChange(provinceId: string): void {
    const town = this.form.controls.townId;
    town.reset('');
    this.towns.set([]);
    this.townsError.set(null);
    this.townsRequest++;
    this.townsSub?.unsubscribe();
    this.loadingTowns.set(false);
    if (provinceId) {
      town.enable({ emitEvent: false });
      this.loadTowns();
    } else {
      town.disable({ emitEvent: false });
    }
  }

  /** Mensaje de «obligatorio» del campo, solo tras intentar enviar. */
  protected fieldError(campo: Campo): string | null {
    if (!this.submitted()) return null;
    return this.form.getRawValue()[campo].trim() === '' ? OBLIGATORIO[campo] : null;
  }

  protected submit(): void {
    if (this.blocked) return;
    this.submitted.set(true);
    this.submitError.set(null);
    const valores = this.form.getRawValue();
    const invalido = ORDEN.find((campo) => valores[campo].trim() === '');
    if (invalido) {
      // Pinta los errores y lleva el foco al primer campo con error.
      queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const cuerpo: NewCustomer = {
      name: valores.name,
      email: valores.email,
      provinceId: valores.provinceId,
      townId: valores.townId,
      status: valores.status,
      streetAddress: valores.streetAddress,
    };
    const json = JSON.stringify(cuerpo);
    // Misma clave al reintentar el mismo envío; nueva si cambia lo escrito.
    if (!this.intento || this.intento.cuerpo !== json) this.intento = { key: crypto.randomUUID(), cuerpo: json };
    this.sending.set(true);
    this.createCustomer.execute(cuerpo, this.intento.key).subscribe({
      next: () => {
        this.sending.set(false);
        this.intento = null;
        this.notice.show('Cliente creado.');
        void this.router.navigate(['/clientes']);
      },
      error: (error) => {
        this.sending.set(false);
        this.submitError.set(aviso(error));
      },
    });
  }
}
