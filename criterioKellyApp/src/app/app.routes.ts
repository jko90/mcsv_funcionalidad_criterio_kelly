import { Routes } from '@angular/router';
import { GuardAutenticacion } from './compartidos/seguridad/guardas/GuardAutenticacion';
import { planGuard } from './compartidos/seguridad/guardas/plan.guard';
import { GuardRoles } from './compartidos/seguridad/guardas/GuardRoles';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./paginas/util/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'recuperar-clave',
    loadComponent: () =>
      import('./paginas/util/recuperar-clave/recuperar-clave.page').then(
        (m) => m.RecuperarClavePage,
      ),
  },
  {
    path: 'verificar-correo',
    loadComponent: () =>
      import('./paginas/util/verificar-correo/verificar-correo.page').then(
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
      import('./paginas/inicio/inicio.page').then((m) => m.InicioPage),
    canActivate: [GuardAutenticacion],
  },
  {
    path: 'bitacora',
    loadComponent: () =>
      import('./paginas/planTrading/bitacora/bitacora.page').then(
        (m) => m.BitacoraPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'operativas',
    loadComponent: () =>
      import('./paginas/reportes/operativas/operativas.page').then(
        (m) => m.OperativasPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'ayuda',
    loadComponent: () =>
      import('./paginas/util/ayuda/ayuda.page').then((m) => m.AyudaPage),
  },
  {
    path: 'acerca-d',
    loadComponent: () =>
      import('./paginas/util/acerca-d/acerca-d.page').then(
        (m) => m.AcercaDPage,
      ),
  },
  { path: 'busca-divisa', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'bitacora-seguimiento',
    loadComponent: () =>
      import('./paginas/planTrading/bitacora-seguimiento/bitacora-seguimiento.page').then(
        (m) => m.BitacoraSeguimientoPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'bitacora-fin',
    loadComponent: () =>
      import('./paginas/planTrading/bitacora-fin/bitacora-fin.page').then(
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
      import('./paginas/suscripcion/registro/registro.page').then(
        (m) => m.RegistroPage,
      ),
  },
  {
    path: 'mostrar-criterio-kelly',
    loadComponent: () =>
      import('./paginas/criterioKelly/mostrar-criterio-kelly/mostrar-criterio-kelly.page').then(
        (m) => m.MostrarCriterioKellyPage,
      ),
    canActivate: [GuardAutenticacion],
  },
  { path: 'grafico-stadistico', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'analisis',
    loadComponent: () =>
      import('./paginas/reportes/analisis/analisis.page').then(
        (m) => m.AnalisisPage,
      ),
    canActivate: [GuardAutenticacion, planGuard],
  },
  {
    path: 'comprobante',
    loadComponent: () =>
      import('./paginas/suscripcion/comprobante/comprobante.page').then(
        (m) => m.ComprobantePage,
      ),
    canActivate: [GuardAutenticacion],
  },
  {
    path: 'planes',
    loadComponent: () =>
      import('./paginas/suscripcion/planes/planes.page').then(
        (m) => m.PlanesPage,
      ),
  },

  {
    path: 'validar-pagos',
    loadComponent: () =>
      import('./paginas/administracion/validar-pagos/validar-pagos.page').then(
        (m) => m.ValidarPagosPage,
      ),
    canActivate: [GuardAutenticacion, GuardRoles],
    data: { roles: [1, 2], requireAll: false },
  },
  {
    path: 'datos-pago',
    loadComponent: () =>
      import('./paginas/administracion/datos-pago/datos-pago-admin.page').then(
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
