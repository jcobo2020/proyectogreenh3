import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { PendingChanges, pendingChangesGuard } from './pending-changes.guard';

describe('pendingChangesGuard', () => {
  it.each([true, false])('devuelve lo que decide la pantalla (%s)', (permite) => {
    const pantalla: PendingChanges = { canLeave: () => permite };
    const resultado = TestBed.runInInjectionContext(() =>
      pendingChangesGuard(
        pantalla,
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    expect(resultado).toBe(permite);
  });
});
