import { CanDeactivateFn } from '@angular/router';

/** Pantallas que saben si tienen cambios sin guardar y preguntan si descartarlos. */
export interface PendingChanges {
  canLeave(): boolean;
}

export const pendingChangesGuard: CanDeactivateFn<PendingChanges> = (component) => component.canLeave();
