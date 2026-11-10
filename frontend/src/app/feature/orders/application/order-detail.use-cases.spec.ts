import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { createSpyObj } from '../../../../testing/spy-obj';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../domain/ports/order-repository.port';
import {
  CancelOrderUseCase,
  ConfirmOrderUseCase,
  DeliverOrderUseCase,
  GetOrderUseCase,
  ShipOrderUseCase,
} from './order.use-cases';

function preparar() {
  const repo = createSpyObj<OrderRepositoryPort>(['get', 'confirm', 'ship', 'cancel', 'deliver']);
  TestBed.configureTestingModule({
    providers: [
      { provide: ORDER_REPOSITORY, useValue: repo },
      GetOrderUseCase,
      ConfirmOrderUseCase,
      ShipOrderUseCase,
      CancelOrderUseCase,
      DeliverOrderUseCase,
    ],
  });
  return repo;
}

describe('casos de uso del detalle del pedido', () => {
  it('GetOrderUseCase delega en el puerto con el id', () => {
    const repo = preparar();
    const pedido = { id: 'o1', number: 'P-1', customerId: 'c1', customerName: 'Ana', date: '2026-11-01', amount: 5, status: 'pending' };
    repo.get.mockReturnValue(of(pedido));
    let resultado: unknown;
    TestBed.inject(GetOrderUseCase).execute('o1').subscribe((r) => (resultado = r));
    expect(repo.get).toHaveBeenCalledWith('o1');
    expect(resultado).toBe(pedido);
  });

  it('ConfirmOrderUseCase y DeliverOrderUseCase delegan con el id', () => {
    const repo = preparar();
    repo.confirm.mockReturnValue(of({ id: 'o1', status: 'confirmed' }));
    repo.deliver.mockReturnValue(of({ id: 'o1', status: 'delivered' }));
    TestBed.inject(ConfirmOrderUseCase).execute('o1').subscribe();
    TestBed.inject(DeliverOrderUseCase).execute('o1').subscribe();
    expect(repo.confirm).toHaveBeenCalledWith('o1');
    expect(repo.deliver).toHaveBeenCalledWith('o1');
  });

  it('ShipOrderUseCase delega con el id y el cuerpo', () => {
    const repo = preparar();
    repo.ship.mockReturnValue(of({ id: 'o1', status: 'shipped' }));
    TestBed.inject(ShipOrderUseCase).execute('o1', { carrier: 'DHL', shippingDate: '2026-11-02' }).subscribe();
    expect(repo.ship).toHaveBeenCalledWith('o1', { carrier: 'DHL', shippingDate: '2026-11-02' });
  });

  it('CancelOrderUseCase delega con el id y el motivo', () => {
    const repo = preparar();
    repo.cancel.mockReturnValue(of({ id: 'o1', status: 'cancelled' }));
    TestBed.inject(CancelOrderUseCase).execute('o1', { cancellationReason: 'Duplicado' }).subscribe();
    expect(repo.cancel).toHaveBeenCalledWith('o1', { cancellationReason: 'Duplicado' });
  });
});
