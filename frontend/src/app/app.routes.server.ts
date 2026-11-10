import { RenderMode, ServerRoute } from '@angular/ssr';

// Todas las rutas están protegidas por authGuard (sesión en sessionStorage): se pintan en el cliente.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
