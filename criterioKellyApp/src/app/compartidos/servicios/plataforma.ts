import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';

export const ES_PLATAFORMA_NATIVA = new InjectionToken<boolean>(
  'ES_PLATAFORMA_NATIVA',
  {
    providedIn: 'root',
    factory: () => Capacitor.isNativePlatform(),
  },
);
