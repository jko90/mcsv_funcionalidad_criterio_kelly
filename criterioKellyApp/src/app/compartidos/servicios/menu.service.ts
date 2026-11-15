import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Menu } from '../modelos/menu';

@Injectable({
  providedIn: 'root',
})
export class MenuService {
  private readonly http = inject(HttpClient);

  opcionMenu() {
    return this.http.get<Menu[]>('/assets/datos/menu.json');
  }
}
