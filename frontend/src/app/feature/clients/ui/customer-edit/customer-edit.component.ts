import { Component, ElementRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { loginUrl } from '../../../../@core/guards/auth.guard';
import { PendingChanges } from '../../../../@core/guards/pending-changes.guard';
import { NoticeService } from '../../../../@core/services/notice.service';
import {
  GetCustomerForEditUseCase,
  ListProvincesUseCase,
  ListTownsUseCase,
  UpdateCustomerUseCase,
} from '../../application/customer.use-cases';
import {
  CustomerChangedError,
  CustomerNotFoundError,
  CustomerPreconditionRequiredError,
  CustomerSessionExpiredError,
  DuplicateCustomerEmailError,
  InvalidCustomerInputError,
} from '../../domain/errors/customer.errors';
import { CustomerDetail, NewCustomer, Province, Town } from '../../domain/models/customer.model';

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
  if (error instanceof CustomerNotFoundError) return { texto: 'No se encontró lo que buscas.', sesion: false };
  if (error instanceof DuplicateCustomerEmailError)
    return { texto: 'Ya existe otro con el mismo «Email».', sesion: false };
  if (error instanceof CustomerChangedError)
    return {
      texto:
        'Otra persona cambió este cliente mientras lo editabas: se ha cargado lo de ahora; revísalo y vuelve a guardar.',
      sesion: false,
    };
  if (error instanceof CustomerPreconditionRequiredError)
    return { texto: 'Algo falló. Vuelve a intentarlo.', sesion: false };
  return { texto: GENERIC_ERROR, sesion: false };
}

@Component({
  selector: 'app-customer-edit',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './customer-edit.component.html',
  styleUrl: './customer-edit.component.css',
})
export class CustomerEditComponent implements OnInit, OnDestroy, PendingChanges {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notice = inject(NoticeService);
  private readonly listProvinces = inject(ListProvincesUseCase);
  private readonly listTowns = inject(ListTownsUseCase);
  private readonly getCustomer = inject(GetCustomerForEditUseCase);
  private readonly updateCustomer = inject(UpdateCustomerUseCase);
  private townsSub?: Subscription;
  private customerSub?: Subscription;
  private townsRequest = 0;
  private customerRequest = 0;
  /** ETag de «Cargar el elemento» (se envía en If-Match; no se enseña). */
  private etag = '';
  /** Lo último cargado o guardado: con él se sabe si algo cambió. */
  private base = '';

  /** El `:id` de la ruta, leído al abrir. */
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';

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
  protected readonly loading = signal(true);
  protected readonly loaded = signal(false);
  protected readonly loadError = signal<Aviso | null>(null);
  protected readonly loadingProvinces = signal(true);
  protected readonly loadingTowns = signal(false);
  protected readonly provincesError = signal<Aviso | null>(null);
  protected readonly townsError = signal<Aviso | null>(null);
  protected readonly submitted = signal(false);
  protected readonly sending = signal(false);
  protected readonly submitError = signal<Aviso | null>(null);
  protected readonly changed = signal(false);
  protected readonly loginHref = loginUrl(`/clientes/${this.id}/editar`);
  protected readonly statuses = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
  ];

  ngOnInit(): void {
    // Una vez, al entrar y a la vez: las provincias y el registro.
    this.loadProvinces();
    this.loadCustomer();
    this.form.controls.provinceId.valueChanges.subscribe((provinceId) => this.onProvinceChange(provinceId));
    this.form.valueChanges.subscribe(() => this.changed.set(this.snapshot() !== this.base));
  }

  ngOnDestroy(): void {
    this.townsSub?.unsubscribe();
    this.customerSub?.unsubscribe();
  }

  /** Al salir con cambios sin guardar, pregunta si descartarlos. */
  canLeave(): boolean {
    if (!this.changed()) return true;
    return typeof window !== 'undefined' && window.confirm('Hay cambios sin guardar. ¿Descartarlos?');
  }

  /** «Guardar cambios» no se pulsa mientras carga, envía o falle una carga de opciones. */
  protected get blocked(): boolean {
    return (
      this.sending() || this.loading() || !this.loaded() || !!this.provincesError() || !!this.townsError()
    );
  }

  private snapshot(): string {
    return JSON.stringify(this.form.getRawValue());
  }

  protected loadProvinces(): void {
    this.loadingProvinces.set(true);
    this.provincesError.set(null);
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

  /** «Cargar el elemento»: rellena el formulario sin vaciar lo que depende de «Provincia». */
  protected loadCustomer(): void {
    const request = ++this.customerRequest;
    this.customerSub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.customerSub = this.getCustomer.execute(this.id).subscribe({
      next: ({ customer, etag }) => {
        if (request !== this.customerRequest) return;
        this.etag = etag;
        this.fill(customer);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: (error) => {
        if (request !== this.customerRequest) return;
        this.loading.set(false);
        this.loaded.set(false);
        this.loadError.set(aviso(error));
      },
    });
  }

  /** Lo que llega del registro entra sin emitir cambios: no vacía «Población». */
  private fill(customer: CustomerDetail): void {
    this.form.patchValue(
      {
        name: customer.name,
        email: customer.email,
        streetAddress: customer.streetAddress,
        provinceId: customer.provinceId,
        townId: customer.townId,
        status: customer.status,
      },
      { emitEvent: false },
    );
    this.submitted.set(false);
    // R4-ARQ-3: la regla de «Provincia» también vale al rellenar.
    if (customer.provinceId) {
      this.form.controls.townId.enable({ emitEvent: false });
      this.loadTowns();
    } else {
      this.form.controls.townId.disable({ emitEvent: false });
    }
    this.base = this.snapshot();
    this.changed.set(false);
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

  /** Cuando la persona cambia «Provincia»: vacía «Población», la activa si hay valor y recarga sus opciones. */
  private onProvinceChange(provinceId: string): void {
    const town = this.form.controls.townId;
    town.reset('', { emitEvent: false });
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
    this.changed.set(this.snapshot() !== this.base);
  }

  /** Mensaje de «obligatorio» del campo, solo tras intentar enviar. */
  protected fieldError(campo: Campo): string | null {
    if (!this.submitted()) return null;
    return this.form.getRawValue()[campo].trim() === '' ? OBLIGATORIO[campo] : null;
  }

  protected submit(): void {
    if (this.blocked || !this.changed()) return;
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
    this.sending.set(true);
    this.updateCustomer.execute(this.id, cuerpo, this.etag).subscribe({
      next: ({ etag }) => {
        this.sending.set(false);
        // Tras guardar bien se usa el ETag nuevo; ya no hay cambios pendientes.
        this.etag = etag;
        this.base = this.snapshot();
        this.changed.set(false);
        this.notice.show('Se guardó correctamente.');
        void this.router.navigate(['/clientes', this.id]);
      },
      error: (error) => {
        this.sending.set(false);
        this.submitError.set(aviso(error));
        // 412: otra persona lo cambió; se vuelve a cargar lo de ahora.
        if (error instanceof CustomerChangedError) this.loadCustomer();
      },
    });
  }
}
