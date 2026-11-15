import { Injectable } from '@angular/core';

// Nombre de usuario de la sesión, solo en memoria (nunca en almacenamiento),
// para pedir la contraseña en el bloqueo cuando la cuenta no tiene PIN.
@Injectable({ providedIn: 'root' })
export class NombreUsuarioSesion {
  private nombre: string | null = null;

  guardar(nombre: string): void {
    this.nombre = nombre;
  }

  obtener(): string | null {
    return this.nombre;
  }

  olvidar(): void {
    this.nombre = null;
  }
}
