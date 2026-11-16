import { inject, Injectable } from '@angular/core';
import { Rol } from 'src/app/nucleo/modelo/Rol.modelo';
import { UsuarioApp } from 'src/app/funcionalidad/autenticacion/modelo/Login.modelo';
import { SesionStore } from 'src/app/nucleo/store/sesion.store';

const CLAVES_HEREDADAS = [
  'usuario',
  'roles',
  'autenticado',
  'planSeleccionado',
] as const;

@Injectable({ providedIn: 'root' })
export class ServicioAutenticacion {
  private readonly sesionStore = inject(SesionStore);

  constructor() {
    this.limpiarDatosHeredados();
  }

  estaAutenticado(): boolean {
    return this.sesionStore.estaAutenticado();
  }

  obtenerUsuarioActual(): UsuarioApp | null {
    return this.sesionStore.usuario();
  }

  obtenerRolesUsuario(): Rol[] {
    return this.sesionStore.roles();
  }

  rolEspecifico(roleId: number): boolean {
    return this.obtenerRolesUsuario().some((rol) => rol.rol_id === roleId);
  }

  otrosRoles(roleIds: number[]): boolean {
    return roleIds.some((roleId) => this.rolEspecifico(roleId));
  }

  todosLosRoles(roleIds: number[]): boolean {
    return roleIds.every((roleId) => this.rolEspecifico(roleId));
  }

  isSuperAdmin(): boolean {
    return this.rolEspecifico(1);
  }

  esAdministrador(): boolean {
    return this.otrosRoles([1, 2]);
  }

  private limpiarDatosHeredados(): void {
    CLAVES_HEREDADAS.forEach((clave) => localStorage.removeItem(clave));
  }
}
