import { Injectable } from '@angular/core';
import {
  AccesoPinBloqueo,
  PinBloqueo,
} from '../../funcionalidad/autenticacion/modelo/pin-bloqueo.modelo';

@Injectable({ providedIn: 'root' })
export class DataBaseWebService implements AccesoPinBloqueo {
  private readonly dbName = 'CriterioKellyDB';
  private readonly dbVersion = 1;
  private db!: IDBDatabase;

  private readonly table = 'dividendoKelly';
  private readonly pinTable = 'pinBloqueo';

  async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.table)) {
          db.createObjectStore(this.table, {
            keyPath: 'agr_idAgresiv',
            autoIncrement: true,
          });
        }
        if (!db.objectStoreNames.contains(this.pinTable)) {
          db.createObjectStore(this.pinTable, {
            keyPath: 'pin_idPin',
            autoIncrement: true,
          });
        }
      };
      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };
      request.onerror = () => reject('Error abriendo IndexedDB');
    });
  }

  /** DIVIDENDO KELLY */
  async agregarDividendoKelly(dividendo: {
    agr_usuarioId: number;
    agr_cueIdCuentas: number;
    agr_valor: number;
  }) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.table, 'readwrite');
      const store = tx.objectStore(this.table);
      const request = store.add(dividendo);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject('Error al agregar dividendo');
    });
  }

  async obtenerDividendosKellyPorUsuario(
    agr_cueIdCuentas: number,
    agr_usuarioId: number,
  ) {
    const db = await this.openDB();
    return new Promise<{ values: any[] }>((resolve) => {
      const tx = db.transaction(this.table, 'readwrite');
      const store = tx.objectStore(this.table);
      const result: any[] = [];
      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          const value = cursor.value;
          if (
            value.agr_usuarioId === agr_usuarioId &&
            value.agr_cueIdCuentas === agr_cueIdCuentas
          ) {
            result.push({
              agr_idAgresiv: value.agr_idAgresiv,
              agr_valor: value.agr_valor,
            });
          }
          cursor.continue();
        } else {
          if (result.length === 0) {
            // No existe, agregamos con valor 10
            const addReq = store.add({
              agr_usuarioId,
              agr_cueIdCuentas,
              agr_valor: 10,
            });
            addReq.onsuccess = (ev: any) => {
              resolve({
                values: [
                  {
                    agr_idAgresiv: addReq.result,
                    agr_valor: 10,
                  },
                ],
              });
            };
            addReq.onerror = () => resolve({ values: [{ agr_valor: 10 }] });
          } else {
            resolve({ values: result });
          }
        }
      };
      request.onerror = () => resolve({ values: [{ agr_valor: 10 }] });
    });
  }

  async actualizarDividendoKelly(agr_idAgresiv: number, agr_valor: number) {
    if (agr_idAgresiv === undefined || agr_idAgresiv === null) {
      return Promise.reject('ID de dividendo inválido');
    }
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.table, 'readwrite');
      const store = tx.objectStore(this.table);
      const getReq = store.get(agr_idAgresiv);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          data.agr_valor = agr_valor;
          const putReq = store.put(data);
          putReq.onsuccess = () => resolve(true);
          putReq.onerror = () => reject('Error al actualizar dividendo');
        } else {
          reject('Registro no encontrado');
        }
      };
      getReq.onerror = () => reject('Error al buscar dividendo');
    });
  }

  async eliminarDividendoKelly(
    agr_cueIdCuentas: number,
    agr_usuarioId: number,
  ): Promise<boolean> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.table, 'readwrite');
      const store = tx.objectStore(this.table);
      const cursorReq = store.openCursor();
      let eliminado = false;
      cursorReq.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          const value = cursor.value;
          if (
            value.agr_cueIdCuentas === agr_cueIdCuentas &&
            value.agr_usuarioId === agr_usuarioId
          ) {
            const deleteReq = store.delete(cursor.primaryKey);
            deleteReq.onsuccess = () => {
              eliminado = true;
              resolve(true);
            };
            deleteReq.onerror = () => reject('Error al eliminar dividendo');
            return;
          }
          cursor.continue();
        } else {
          if (!eliminado) resolve(false);
        }
      };
      cursorReq.onerror = () => reject('Error al buscar dividendo');
    });
  }

  /** MANEJO DE PIN DE BLOQUEO */
  async agregarPinBloqueo(
    pin_codigo: string,
    pin_idUsuario: number,
  ): Promise<string> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.pinTable, 'readwrite');
      const store = tx.objectStore(this.pinTable);
      const cursorReq = store.openCursor();
      let exists = false;
      cursorReq.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
          .result;
        if (cursor) {
          if (cursor.value.pin_idUsuario === pin_idUsuario) {
            exists = true;
            resolve('PIN ya existe para este usuario');
            return;
          }
          cursor.continue();
        } else {
          if (!exists) {
            const req = store.add({ pin_codigo, pin_idUsuario });
            req.onsuccess = () => resolve('PIN creado correctamente.');
            req.onerror = () => {
              if (req.error?.name === 'ConstraintError') {
                resolve('PIN ya existe para este usuario');
              } else {
                reject(new Error('No se pudo guardar el PIN'));
              }
            };
          }
        }
      };
      cursorReq.onerror = () => reject(new Error('No se pudo guardar el PIN'));
    });
  }

  async obtenerPinBloqueo(pin_idUsuario: number): Promise<PinBloqueo | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.pinTable, 'readonly');
      const store = tx.objectStore(this.pinTable);

      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
          .result;
        if (cursor) {
          if (cursor.value.pin_idUsuario === pin_idUsuario) {
            resolve(cursor.value as PinBloqueo);
            return;
          }
          cursor.continue();
        } else {
          resolve(null);
        }
      };
      cursorReq.onerror = () =>
        reject(new Error('No se pudo consultar el PIN'));
    });
  }

  async eliminarPinBloqueo(pin_idUsuario: number): Promise<string> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.pinTable, 'readwrite');
      const store = tx.objectStore(this.pinTable);

      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
          .result;
        if (cursor) {
          if (cursor.value.pin_idUsuario === pin_idUsuario) {
            const delReq = store.delete(cursor.primaryKey);
            delReq.onsuccess = () => resolve('PIN eliminado correctamente.');
            delReq.onerror = () =>
              reject(new Error('No se pudo eliminar el PIN'));
            return;
          }
          cursor.continue();
        } else {
          resolve('No existe PIN para este usuario');
        }
      };
      cursorReq.onerror = () => reject(new Error('No se pudo eliminar el PIN'));
    });
  }

  async editarPinBloqueo(
    pin_codigo: string,
    pin_idPin: number,
    pin_idUsuario: number,
  ): Promise<string> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.pinTable, 'readwrite');
      const store = tx.objectStore(this.pinTable);
      const getReq = store.get(pin_idPin);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data && data.pin_idUsuario === pin_idUsuario) {
          data.pin_codigo = pin_codigo;
          const putReq = store.put(data);
          putReq.onsuccess = () => resolve('PIN actualizado correctamente.');
          putReq.onerror = () => {
            if (putReq.error?.name === 'ConstraintError') {
              resolve('PIN ya existe');
            } else {
              reject(new Error('No se pudo guardar el PIN'));
            }
          };
        } else {
          resolve('Registro no encontrado');
        }
      };
      getReq.onerror = () => reject(new Error('No se pudo guardar el PIN'));
    });
  }
}
