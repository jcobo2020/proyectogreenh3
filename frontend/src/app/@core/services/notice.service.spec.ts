import { TestBed } from '@angular/core/testing';
import { NoticeService } from './notice.service';

describe('NoticeService', () => {
  it('guarda el aviso y lo limpia', () => {
    const servicio = TestBed.inject(NoticeService);
    expect(servicio.message()).toBeNull();
    servicio.show('Cliente eliminado.');
    expect(servicio.message()).toBe('Cliente eliminado.');
    servicio.clear();
    expect(servicio.message()).toBeNull();
  });
});
