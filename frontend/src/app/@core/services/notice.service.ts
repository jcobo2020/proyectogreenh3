import { Injectable, signal } from '@angular/core';

/** Aviso breve que sobrevive a una navegación (p. ej. «Cliente eliminado.»). */
@Injectable({ providedIn: 'root' })
export class NoticeService {
  readonly message = signal<string | null>(null);

  show(message: string): void {
    this.message.set(message);
  }

  clear(): void {
    this.message.set(null);
  }
}
