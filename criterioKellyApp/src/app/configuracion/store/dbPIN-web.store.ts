import { inject } from '@angular/core';
import { signalStore } from '@ngrx/signals';
import { conPinBloqueo } from './pin-bloqueo.feature';
import { DataBaseWebService } from 'src/app/configuracion/base-datos/data-base-web.service';

export const DbPINWebStore = signalStore(
  { providedIn: 'root' },
  conPinBloqueo(() => inject(DataBaseWebService)),
);
