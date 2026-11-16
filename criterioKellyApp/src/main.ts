import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';
import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { inject, isDevMode, provideAppInitializer } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';
import { errorInterceptor } from './app/configuracion/seguridad/interceptores/error.interceptor';
import { autenticacionInterceptor } from './app/configuracion/seguridad/interceptores/autenticacion.interceptor';
import { ServicioAutenticacion } from './app/configuracion/seguridad/servicio/ServicioAutenticacion';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import * as allIcons from 'ionicons/icons';
import { addIcons } from 'ionicons';

import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';
import { SesionStore } from './app/configuracion/store/sesion.store';
jeepSqlite(window);

addIcons(allIcons);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(
      withInterceptorsFromDi(),
      withInterceptors([autenticacionInterceptor, errorInterceptor]),
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => {
      inject(ServicioAutenticacion);
      inject(SesionStore).restaurarSesion();
    }),
  ],
});
