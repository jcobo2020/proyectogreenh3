import { lacksPermission, sessionPermissions } from './permissions';

const token = (claims: object) => `x.${btoa(JSON.stringify(claims))}.y`;

describe('permissions', () => {
  afterEach(() => sessionStorage.clear());

  it('sin token no se sabe: null y no falta ninguno', () => {
    expect(sessionPermissions()).toBeNull();
    expect(lacksPermission('a')).toBe(false);
  });

  it('lee el claim permissions', () => {
    sessionStorage.setItem('token', token({ permissions: ['a', 3, 'b'] }));
    expect(sessionPermissions()).toEqual(['a', 'b']);
    expect(lacksPermission('a')).toBe(false);
    expect(lacksPermission('c')).toBe(true);
  });

  it('un token sin el claim o ilegible no se sabe: decide la API', () => {
    sessionStorage.setItem('token', token({ sub: '1' }));
    expect(lacksPermission('a')).toBe(false);
    sessionStorage.setItem('token', 'basura');
    expect(sessionPermissions()).toBeNull();
  });
});
