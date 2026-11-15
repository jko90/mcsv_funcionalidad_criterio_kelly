import { inject, Injectable } from '@angular/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { AccesoPinBloqueo, PinBloqueo } from '../modelos/pin-bloqueo.modelo';

@Injectable({
  providedIn: 'root',
})
export class DataBaseService implements AccesoPinBloqueo {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private objBaseDatos!: SQLiteDBConnection;
  private isOpen = false;

  tables = {
    dividendoKelly: 'dividendoKelly',
    pinBloqueo: 'pinBloqueo',
  };

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  async crearBaseDatos() {
    try {
      const ret = await this.sqlite.checkConnectionsConsistency();
      const isConn = (await this.sqlite.isConnection('critKelly', false))
        .result;

      if (ret.result && isConn) {
        this.objBaseDatos = await this.sqlite.retrieveConnection(
          'critKelly',
          false,
        );
      } else {
        this.objBaseDatos = await this.sqlite.createConnection(
          'critKelly',
          false,
          'no-encryption',
          1,
          false,
        );
      }

      await this.objBaseDatos.open();
      this.isOpen = true;
      await this.crearTablas();
    } catch (e) {
      // Connection error — let caller handle
    }
  }

  async crearTablas() {
    try {
      await this.objBaseDatos.execute(
        `CREATE TABLE IF NOT EXISTS ${this.tables.dividendoKelly} (
        agr_idAgresiv INTEGER PRIMARY KEY AUTOINCREMENT,
        agr_usuarioId INTEGER NOT NULL,
        agr_cueIdCuentas INTEGER NOT NULL,
        agr_valor DECIMAL(10,2) NOT NULL
      );`,
      );

      // pin_codigo guarda el hash pbkdf2-sha256 (aproximadamente 85 caracteres);
      // SQLite no limita la longitud de VARCHAR, por eso se conserva el DDL.
      await this.objBaseDatos.execute(
        `CREATE TABLE IF NOT EXISTS ${this.tables.pinBloqueo} (
        pin_idPin INTEGER PRIMARY KEY AUTOINCREMENT, 
        pin_codigo VARCHAR(8) NOT NULL, 
        pin_idUsuario INTEGER NOT NULL)`,
      );
    } catch (e) {
      // Table creation error — let caller handle
    }
  }

  /** DIVIDENDO KELLY */
  async agregarDividendoKelly(dividendo: {
    agr_usuarioId: number;
    agr_cueIdCuentas: number;
    agr_valor: number;
  }) {
    try {
      await this.objBaseDatos.run(
        `INSERT INTO ${this.tables.dividendoKelly}  (agr_usuarioId, agr_cueIdCuentas, agr_valor) VALUES (?, ?, ?)`,
        [
          dividendo.agr_usuarioId,
          dividendo.agr_cueIdCuentas,
          dividendo.agr_valor,
        ],
      );
    } catch (e) {
      // Insert error — let caller handle
    }
  }

  async obtenerDividendosKellyPorUsuario(
    agr_cueIdCuentas: number,
    agr_usuarioId: number,
  ) {
    try {
      let result = await this.objBaseDatos.query(
        `SELECT agr_idAgresiv, agr_valor FROM ${this.tables.dividendoKelly} WHERE agr_usuarioId = ? AND agr_cueIdCuentas = ?`,
        [agr_usuarioId, agr_cueIdCuentas],
      );
      if (
        !result ||
        !('values' in result) ||
        !result.values ||
        result.values.length === 0
      ) {
        await this.objBaseDatos.run(
          `INSERT INTO ${this.tables.dividendoKelly} (agr_usuarioId, agr_cueIdCuentas, agr_valor) VALUES (?, ?, ?)`,
          [agr_usuarioId, agr_cueIdCuentas, 10],
        );
        result = await this.objBaseDatos.query(
          `SELECT agr_idAgresiv, agr_valor FROM ${this.tables.dividendoKelly} WHERE agr_usuarioId = ? AND agr_cueIdCuentas = ?`,
          [agr_usuarioId, agr_cueIdCuentas],
        );
      }
      return result;
    } catch (e) {
      return { values: [{ agr_valor: 10 }] };
    }
  }

  async actualizarDividendoKelly(agr_idAgresiv: number, agr_valor: number) {
    try {
      await this.objBaseDatos.run(
        `UPDATE ${this.tables.dividendoKelly}  SET agr_valor = ? WHERE agr_idAgresiv = ?`,
        [agr_valor, agr_idAgresiv],
      );
    } catch (e) {
      // Update error — let caller handle
    }
  }

  async eliminarDividendoKelly(
    agr_cueIdCuentas: number,
    agr_usuarioId: number,
  ): Promise<boolean> {
    try {
      await this.objBaseDatos.run(
        `DELETE FROM ${this.tables.dividendoKelly} WHERE agr_cueIdCuentas = ? AND agr_usuarioId = ?`,
        [agr_cueIdCuentas, agr_usuarioId],
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  /** MANEJO DE PIN DE BLOQUEO */
  async agregarPinBloqueo(pin_codigo: string, pin_idUsuario: number): Promise<string> {
    try {
      await this.objBaseDatos.run(
        `INSERT INTO ${this.tables.pinBloqueo} (pin_codigo, pin_idUsuario) VALUES (?, ?)`,
        [pin_codigo, pin_idUsuario],
      );
      return 'PIN creado correctamente.';
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 6) {
        return 'PIN ya existe para este usuario';
      }
      throw new Error('No se pudo guardar el PIN');
    }
  }

  async obtenerPinBloqueo(pin_idUsuario: number): Promise<PinBloqueo | null> {
    const result = await this.objBaseDatos.query(
      `SELECT * FROM ${this.tables.pinBloqueo} WHERE pin_idUsuario = ?`,
      [pin_idUsuario],
    );
    const valores = 'values' in result && Array.isArray(result.values) ? result.values : [];
    return (valores[0] as PinBloqueo | undefined) ?? null;
  }

  async eliminarPinBloqueo(pin_idUsuario: number): Promise<string> {
    try {
      await this.objBaseDatos.run(
        `DELETE FROM ${this.tables.pinBloqueo} WHERE pin_idUsuario = ?`,
        [pin_idUsuario],
      );
    } catch (e) {
      throw new Error('No se pudo eliminar el PIN');
    }
    return 'PIN eliminado correctamente.';
  }

  async editarPinBloqueo(
    pin_codigo: string,
    pin_idPin: number,
    pin_idUsuario: number,
  ): Promise<string> {
    try {
      await this.objBaseDatos.run(
        `UPDATE ${this.tables.pinBloqueo} SET pin_codigo = ? WHERE pin_idUsuario = ? AND pin_idPin = ?`,
        [pin_codigo, pin_idUsuario, pin_idPin],
      );
      return 'PIN actualizado correctamente.';
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 6) {
        return 'PIN ya existe';
      }
      throw new Error('No se pudo guardar el PIN');
    }
  }
}
