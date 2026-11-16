import { inject } from '@angular/core';
import { signalStore } from '@ngrx/signals';
import { conPinBloqueo } from './pin-bloqueo.feature';
import { DataBaseService } from 'src/app/configuracion/base-datos/data-base.service';

export const DbPINAppStore = signalStore(
  { providedIn: 'root' },
  conPinBloqueo(() => inject(DataBaseService)),
);
