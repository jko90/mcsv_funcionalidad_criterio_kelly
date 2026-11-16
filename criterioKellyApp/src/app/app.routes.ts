import { Routes } from '@angular/router';
import { GuardAutenticacion } from './nucleo/seguridad/guardas/GuardAutenticacion';
import { planGuard } from './nucleo/seguridad/guardas/plan.guard';
import { GuardRoles } from './nucleo/seguridad/guardas/GuardRoles';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./funcionalidad/autenticacion/pagina/login/login.page').then(
        (m) => m.LoginPage,
      ),
  },
  {
    path: 'recuperar-clave',
    loadComponent: () =>
      import('./funcionalidad/autenticacion/pagina/recuperar-clave/recuperar-clave.page').then(
        (m) => m.RecuperarClavePage,
      ),
  },
  {
    path: 'verificar-correo',
    loadComponent: () =>
      import('./funcionalidad/autenticacion/pagina/verificar-correo/verificar-correo.page').then(
        (m) => m.VerificarCorreoPage,
      ),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'inicio',
    loadComponent: () =>
      import('./funcionalidad/inicio/inicio.page').then((m) => m.InicioPage),
    canActivate: [GuardAutenticacion],
  },
  {
    path: 'bitacora',
    loadComponent: () =>
      import('./negocio/bitacora/paginas/bitacora/bitacora.page').then(
        (m) => m.BitacoraPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'operativas',
    loadComponent: () =>
      import('./reportes/operativas/paginas/operativas/operativas.page').then(
        (m) => m.OperativasPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'ayuda',
    loadComponent: () =>
      import('./funcionalidad/soporte/ayuda/ayuda.page').then(
        (m) => m.AyudaPage,
      ),
  },
  {
    path: 'acerca-d',
    loadComponent: () =>
      import('./funcionalidad/soporte/acerca-d/acerca-d.page').then(
        (m) => m.AcercaDPage,
      ),
  },
  { path: 'busca-divisa', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'bitacora-seguimiento',
    loadComponent: () =>
      import('./negocio/bitacora/paginas/bitacora-seguimiento/bitacora-seguimiento.page').then(
        (m) => m.BitacoraSeguimientoPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'bitacora-fin',
    loadComponent: () =>
      import('./negocio/bitacora/paginas/bitacora-fin/bitacora-fin.page').then(
        (m) => m.BitacoraFinPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'cuentas',
    loadComponent: () =>
      import('./configuracion/cuentas/paginas/cuentas/cuentas.page').then(
        (m) => m.CuentasPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'perfil',
    loadComponent: () =>
      import('./configuracion/perfil/paginas/perfil/perfil.page').then(
        (m) => m.PerfilPage,
      ),
    canActivate: [GuardAutenticacion],
  },
  {
    path: 'operativa-kelly',
    loadComponent: () =>
      import('./configuracion/operativa-kelly/paginas/operativa-kelly/operativa-kelly.page').then(
        (m) => m.OperativaKellyPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'cambiar-pin',
    loadComponent: () =>
      import('./configuracion/bloqueo-pin/paginas/cambiar-pin/cambiar-pin.page').then(
        (m) => m.CambiarPinPage,
      ),
    canActivate: [GuardAutenticacion],
  },
  {
    path: 'bloqueo',
    loadComponent: () =>
      import('./configuracion/bloqueo-pin/paginas/bloqueo/bloqueo.page').then(
        (m) => m.BloqueoPage,
      ),
    canActivate: [GuardAutenticacion],
  },
  { path: 'modal-pin', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'registro',
    loadComponent: () =>
      import('./funcionalidad/autenticacion/pagina/registro/registro.page').then(
        (m) => m.RegistroPage,
      ),
  },
  {
    path: 'mostrar-criterio-kelly',
    loadComponent: () =>
      import('./negocio/criterio-kelly/paginas/mostrar-criterio-kelly/mostrar-criterio-kelly.page').then(
        (m) => m.MostrarCriterioKellyPage,
      ),
    canActivate: [GuardAutenticacion],
  },
  { path: 'grafico-stadistico', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'analisis',
    loadComponent: () =>
      import('./reportes/analisis/paginas/analisis/analisis.page').then(
        (m) => m.AnalisisPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'comprobante',
    loadComponent: () =>
      import('./negocio/suscripcion/paginas/comprobante/comprobante.page').then(
        (m) => m.ComprobantePage,
      ),
    canActivate: [GuardAutenticacion],
  },
  {
    path: 'planes',
    loadComponent: () =>
      import('./negocio/suscripcion/paginas/planes/planes.page').then(
        (m) => m.PlanesPage,
      ),
  },

  {
    path: 'validar-pagos',
    loadComponent: () =>
      import('./administracion/pagos/paginas/validar-pagos/validar-pagos.page').then(
        (m) => m.ValidarPagosPage,
      ),
    canActivate: [GuardAutenticacion, GuardRoles],
    data: { roles: [1, 2], requireAll: false },
  },
  {
    path: 'datos-pago',
    loadComponent: () =>
      import('./administracion/datos-pago/paginas/datos-pago/datos-pago-admin.page').then(
        (m) => m.DatosPagoAdminPage,
      ),
    canActivate: [GuardAutenticacion, GuardRoles],
    data: { roles: [1, 2], requireAll: false },
  },

  // Rutas con restricciones de roles
  /* {
     path: 'administracion',
     loadComponent: () => import('./paginas/administracion/administracion.page').then(m => m.AdministracionPage),
     canActivate: [GuardRoles],
     data: { 
       roles: [1, 2], // IDs de roles: Super Admin y Admin
       requireAll: false // Solo necesita uno de los roles
     }
   },
   {
     path: 'super-admin',
     loadComponent: () => import('./paginas/super-admin/super-admin.page').then(m => m.SuperAdminPage),
     canActivate: [GuardRoles],
     data: { 
       roles: [1], // Solo Super Administrador
       requireAll: true
     }
   },
   {
     path: 'acceso-denegado',
     loadComponent: () => import('./paginas/util/acceso-denegado/acceso-denegado.page').then(m => m.AccesoDenegadoPage)
   }
   */
];
