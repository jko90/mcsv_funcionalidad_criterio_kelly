import { inject } from '@angular/core';
import { signalStore } from '@ngrx/signals';
import { DataBaseWebService } from '../servicios/data-base-web.service';
import { conPinBloqueo } from './pin-bloqueo.feature';

export const DbPINWebStore = signalStore(
  { providedIn: 'root' },
  conPinBloqueo(() => inject(DataBaseWebService)),
);
