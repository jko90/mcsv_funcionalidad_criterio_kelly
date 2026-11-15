import { inject } from '@angular/core';
import { signalStore } from '@ngrx/signals';
import { DataBaseService } from '../servicios/data-base.service';
import { conPinBloqueo } from './pin-bloqueo.feature';

export const DbPINAppStore = signalStore(
  { providedIn: 'root' },
  conPinBloqueo(() => inject(DataBaseService)),
);
