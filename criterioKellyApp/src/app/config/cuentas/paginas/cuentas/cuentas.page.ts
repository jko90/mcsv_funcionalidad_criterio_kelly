import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { AlertInput } from '@ionic/angular';
import {
  AlertaCkComponent,
  TipoAlertaCk,
  ValoresCamposAlerta,
} from 'src/app/compartidos/componentes/alerta-ck/alerta-ck.component';
import {
  ALERTA_AUMENTAR_CAPITAL,
  ALERTA_CREAR_CUENTA,
  ALERTA_EDITAR_CUENTA,
  ALERTA_ELIMINAR_CUENTA,
  ALERTA_REDUCIR_CAPITAL,
  TEXTO_CANCELAR_LARGO,
  TextoAlerta,
  mensajeEliminarCuenta,
} from 'src/app/compartidos/textos-alertas';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import {
  ActualizarNombreCuenta,
  CrearCuenta,
  CuentaResponse,
  EliminarCuenta,
} from '../../modelos/Cuentas.modelo';
import { CapitalModelo } from '../../modelos/Capital.modelo';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ServicioAutenticacion } from 'src/app/configuracion/seguridad/servicio/ServicioAutenticacion';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { CuentaStore } from '../../store/cuentaStore';
import { Capacitor } from '@capacitor/core';
import { AlertaLimitePlanComponent } from 'src/app/compartidos/componentes/alerta-limite-plan/alerta-limite-plan.component';
import { RUTA_PLANES } from '../../../../negocio/suscripcion/configuracion/permisos-plan.config';
import { PlanVigenteStore } from '../../../../negocio/suscripcion/store/plan-vigente.store';
import {
  haAlcanzadoTopeCuentas,
  textoTopeCuentas,
} from '../../../../negocio/suscripcion/configuracion/permisos-plan.config';
import { DBCriterioKellyWebStore } from 'src/app/configuracion/store/dbkelly-web.store';
import { DBCriterioKellyAppStore } from 'src/app/configuracion/store/dbkelly-app.store';

const MONTO_MINIMO = 0.01;
const MONTO_MAXIMO = 100000000;

type AlertaCapital = { tipo: 'aumentar' | 'reducir'; cuenta: CuentaResponse };
type AlertaCuenta =
  | { tipo: 'crear' }
  | { tipo: 'editar'; cuenta: CuentaResponse }
  | { tipo: 'eliminar'; cuenta: CuentaResponse }
  | AlertaCapital;

(pdfMake as any).vfs = (pdfFonts as any).vfs;

@Component({
  selector: 'app-cuentas',
  templateUrl: './cuentas.page.html',
  styleUrls: ['./cuentas.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    EncabezadoComponent,
    ReactiveFormsModule,
    AlertaLimitePlanComponent,
    AlertaCkComponent,
  ],
})
export class CuentasPage {
  private readonly cuentaStore = inject(CuentaStore);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(ServicioAutenticacion);
  private readonly dbKellyWebStore = inject(DBCriterioKellyWebStore);
  private readonly dbKellyAppStore = inject(DBCriterioKellyAppStore);
  private readonly planVigenteStore = inject(PlanVigenteStore);
  private readonly router = inject(Router);

  titulo = 'CONFIGURACIÓN';
  usuarioActual = signal(0);
  private isWeb = Capacitor.getPlatform() === 'web';

  isLoading = this.cuentaStore.isLoading;
  errorMessage = this.cuentaStore.errorMessage;
  listaCuentas = this.cuentaStore.listaCuentas;

  readonly mostrarModalPlan = signal(false);
  readonly mensajeTopeCuentas = computed(() =>
    textoTopeCuentas(this.planVigenteStore.limites()),
  );

  readonly textoCancelar = TEXTO_CANCELAR_LARGO;
  /** Una sola alerta por página: qué diálogo está abierto y sobre qué cuenta. */
  readonly alertaActiva = signal<AlertaCuenta | null>(null);

  readonly textosAlertaActiva = computed<TextoAlerta>(() => {
    const alerta = this.alertaActiva();
    switch (alerta?.tipo) {
      case 'editar':
        return ALERTA_EDITAR_CUENTA;
      case 'eliminar':
        return {
          ...ALERTA_ELIMINAR_CUENTA,
          mensaje: mensajeEliminarCuenta(alerta.cuenta.cue_nombre),
        };
      case 'aumentar':
        return ALERTA_AUMENTAR_CAPITAL;
      case 'reducir':
        return ALERTA_REDUCIR_CAPITAL;
      default:
        return ALERTA_CREAR_CUENTA;
    }
  });

  readonly tipoAlertaActiva = computed<TipoAlertaCk>(() => {
    const tipo = this.alertaActiva()?.tipo;
    return tipo === 'eliminar' || tipo === 'reducir'
      ? 'destructiva'
      : 'confirmacion';
  });

  readonly camposAlertaActiva = computed<AlertInput[] | undefined>(() => {
    const alerta = this.alertaActiva();
    switch (alerta?.tipo) {
      case 'crear':
        return [
          { name: 'cue_nombre', type: 'text', placeholder: 'Nombre' },
          {
            name: 'monto',
            type: 'number',
            placeholder: 'Monto (0.00)',
            min: MONTO_MINIMO,
            max: MONTO_MAXIMO,
          },
        ];
      case 'editar':
        return [
          {
            name: 'cue_nombre',
            type: 'text',
            placeholder: 'Nombre de la cuenta',
            value: alerta.cuenta.cue_nombre,
          },
        ];
      case 'aumentar':
      case 'reducir':
        return [
          {
            name: 'monto',
            type: 'number',
            placeholder: 'Monto',
            min: MONTO_MINIMO,
          },
        ];
      default:
        return undefined;
    }
  });

  formCuenta: FormGroup = this.fb.group({});

  constructor() {
    this.usuarioActual.set(this.authService.obtenerUsuarioActual()?.id || 0);
    this.formCuenta = this.fb.group({
      cue_nombre: ['', Validators.required],
      monto: [null, [Validators.required, Validators.min(0.01)]],
    });
    this.cargarDatos();

    effect(() => {
      const error = this.cuentaStore.errorMessage();
      if (error) {
        this.utilServicio.mostrarToast(error, 'danger');
      }
    });

    effect(() => {
      const cuenta = this.cuentaStore.ultimaCuenta();
      if (cuenta) {
        this.utilServicio.mostrarToast('Cuenta creada exitosamente', 'success');
        this.cargarDatos();
      }
    });

    effect(() => {
      if (this.cuentaStore.cuentaEliminada()) {
        this.utilServicio.mostrarToast(
          'Cuenta eliminada exitosamente',
          'success',
        );
      }
    });

    effect(() => {
      if (this.cuentaStore.capitalActualizado()) {
        this.utilServicio.mostrarToast(
          'Capital actualizado exitosamente',
          'success',
        );
      }
    });
  }

  cargarDatos() {
    if (this.usuarioActual() === 0) return;
    this.cuentaStore.cargarCuentas();
  }

  crearCuenta(): void {
    const limites = this.planVigenteStore.limites();
    if (haAlcanzadoTopeCuentas(limites, this.listaCuentas().length)) {
      this.mostrarModalPlan.set(true);
      return;
    }
    this.alertaActiva.set({ tipo: 'crear' });
  }

  cerrarModalPlan(): void {
    this.mostrarModalPlan.set(false);
  }

  alVerPlanes(): void {
    this.cerrarModalPlan();
    this.router.navigate([RUTA_PLANES]);
  }

  actualizarCuenta(cuenta: CuentaResponse): void {
    this.alertaActiva.set({ tipo: 'editar', cuenta });
  }

  eliminarCuenta(cuenta: CuentaResponse): void {
    this.alertaActiva.set({ tipo: 'eliminar', cuenta });
  }

  abrirModalCapital(
    cuenta: CuentaResponse,
    accion: 'aumentar' | 'reducir',
  ): void {
    this.alertaActiva.set({ tipo: accion, cuenta });
  }

  /** Devolver false mantiene la alerta abierta para corregir los datos. */
  readonly validarAlertaActiva = (valores: ValoresCamposAlerta): boolean => {
    const alerta = this.alertaActiva();
    if (alerta === null) return true;
    switch (alerta.tipo) {
      case 'crear':
        return this.validarNuevaCuenta(valores);
      case 'editar':
        return this.validarNombreEditado(valores);
      case 'aumentar':
      case 'reducir':
        return this.validarCapital(valores, alerta);
      default:
        return true;
    }
  };

  alConfirmarAlerta(valores: ValoresCamposAlerta | void): void {
    const alerta = this.alertaActiva();
    this.alertaActiva.set(null);
    if (alerta === null) return;
    const datos = valores ?? {};
    switch (alerta.tipo) {
      case 'crear':
        this.guardarNuevaCuenta(datos);
        break;
      case 'editar':
        this.guardarNombreEditado(datos, alerta.cuenta);
        break;
      case 'eliminar':
        this.borrarCuenta(alerta.cuenta);
        break;
      default:
        this.guardarCapital(datos, alerta);
    }
  }

  alDescartarAlerta(): void {
    this.alertaActiva.set(null);
  }

  private validarNuevaCuenta(valores: ValoresCamposAlerta): boolean {
    const nombre = String(valores['cue_nombre'] ?? '').trim();
    const monto = Number(valores['monto']);
    if (!nombre || isNaN(monto) || monto < MONTO_MINIMO) {
      this.utilServicio.mostrarToast('Datos inválidos', 'danger');
      return false;
    }
    return true;
  }

  private guardarNuevaCuenta(valores: ValoresCamposAlerta): void {
    const nuevaCuenta: CrearCuenta = {
      cue_nombre: String(valores['cue_nombre'] ?? '').trim(),
      valor_cuenta: Number(valores['monto']),
      fecha_valor: new Date().toISOString().slice(0, 10),
    };
    this.cuentaStore.crearCuenta(nuevaCuenta);
  }

  private validarNombreEditado(valores: ValoresCamposAlerta): boolean {
    if (String(valores['cue_nombre'] ?? '').trim()) return true;
    this.utilServicio.mostrarToast('El nombre no puede estar vacío', 'danger');
    return false;
  }

  private guardarNombreEditado(
    valores: ValoresCamposAlerta,
    cuenta: CuentaResponse,
  ): void {
    const request: ActualizarNombreCuenta = {
      cue_idCuenta: cuenta.cue_idCuentas,
      cue_nombre: String(valores['cue_nombre'] ?? '').trim(),
    };
    this.cuentaStore.actualizarNombreCuenta(request);
  }

  private borrarCuenta(cuenta: CuentaResponse): void {
    const request: EliminarCuenta = { cue_idCuenta: cuenta.cue_idCuentas };
    this.cuentaStore.eliminarCuenta(request);
    const dbKelly = this.isWeb ? this.dbKellyWebStore : this.dbKellyAppStore;
    dbKelly.eliminarDividendoKelly(request.cue_idCuenta, this.usuarioActual());
  }

  private calcularNuevoCapital(monto: number, alerta: AlertaCapital): number {
    const capitalActual = alerta.cuenta.valor_cuenta || 0;
    return alerta.tipo === 'aumentar'
      ? capitalActual + monto
      : capitalActual - monto;
  }

  private validarCapital(
    valores: ValoresCamposAlerta,
    alerta: AlertaCapital,
  ): boolean {
    const monto = Number(valores['monto']);
    if (isNaN(monto) || monto <= 0) {
      this.utilServicio.mostrarToast('Monto inválido', 'danger');
      return false;
    }
    if (this.calcularNuevoCapital(monto, alerta) < 0) {
      this.utilServicio.mostrarToast(
        'El capital no puede ser negativo',
        'danger',
      );
      return false;
    }
    return true;
  }

  private guardarCapital(
    valores: ValoresCamposAlerta,
    alerta: AlertaCapital,
  ): void {
    const monto = Number(valores['monto']);
    const nuevoCapital: CapitalModelo = {
      cap_idCapital: 0,
      cap_cueIdCuentas: alerta.cuenta.cue_idCuentas,
      cap_monto: monto,
      cap_capital: this.calcularNuevoCapital(monto, alerta),
      cap_tipoMovimie: alerta.tipo === 'aumentar' ? 'D' : 'R',
    };
    this.cuentaStore.agregarCapital(nuevoCapital);
  }

  generarPDF() {
    const body: any[][] = [
      [
        { text: 'Cuenta', bold: true },
        { text: 'Capital', bold: true },
      ],
    ];
    this.listaCuentas().forEach((cuenta: CuentaResponse) => {
      body.push([
        { text: cuenta.cue_nombre, bold: false },
        {
          text: cuenta.valor_cuenta.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
          }),
          bold: false,
        },
      ]);
    });

    const docDefinition = {
      content: [
        { text: 'Reporte de Cuentas y Capitales', style: 'header' },
        {
          table: {
            widths: ['*', '*'],
            body,
          },
        },
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10] as [number, number, number, number],
        },
      },
    };
    pdfMake.createPdf(docDefinition).open();
  }
}
