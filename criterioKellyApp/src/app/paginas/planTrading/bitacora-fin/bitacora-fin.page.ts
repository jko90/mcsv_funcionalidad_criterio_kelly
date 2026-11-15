import {
  Component,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import {
  ActualizarBitacoraFinalModelo,
  BitacoraModelo,
} from '../modelos/Bitacora.modelo';
import { ComentarioModelo } from '../modelos/Comentario.modelo';
import { ServicioAutenticacion } from 'src/app/compartidos/seguridad/ServicioAutenticacion';
import { CuentaResponse } from '../../configuracion/modelos/Cuentas.modelo';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { ManejoImagenesService } from 'src/app/compartidos/servicios/manejo-imagenes.service';
import { BitacoraStore } from '../store/bitacoraStore';
import { CuentaStore } from '../../configuracion/store/cuentaStore';
import { ComentariosStore } from '../store/comentariosStore';
import { DBCriterioKellyWebStore } from 'src/app/compartidos/store/dbkelly-web.store';
import { Capacitor } from '@capacitor/core';
import { DBCriterioKellyAppStore } from 'src/app/compartidos/store/dbkelly-app.store';

@Component({
  selector: 'app-bitacora-fin',
  templateUrl: './bitacora-fin.page.html',
  styleUrls: ['./bitacora-fin.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicComponentes,
    EncabezadoComponent,
  ],
})
export class BitacoraFinPage implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(ServicioAutenticacion);
  private readonly manejoImagenes = inject(ManejoImagenesService);
  private readonly bitacoraStore = inject(BitacoraStore);
  private readonly cuentaStore = inject(CuentaStore);
  private readonly comentariosStore = inject(ComentariosStore);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly dbWebStore = inject(DBCriterioKellyWebStore);
  private readonly dbAppStore = inject(DBCriterioKellyAppStore);

  titulo = 'OPERACIÓN';
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  usuarioActual = signal(0);
  cargandoDatos = signal(false);
  habilitaEdicion = signal(false);

  cuentaSeleccionada = {} as CuentaResponse;
  objSeguimiento: BitacoraModelo | null = null;
  private isWeb = Capacitor.getPlatform() === 'web';

  bitacoraForm: FormGroup = this.fb.group({
    resultado: [''],
    monto: [''],
    reglas: [''],
    analisis: [''],
    lecciones: [''],
    urlImagen: [''],
  });

  listaObjCuentas = this.cuentaStore.listaCuentas;
  nuevaListaObjBitacora = this.bitacoraStore.listaBitacoraEnOperacion;

  ngOnInit() {
    this.usuarioActual.set(this.authService.obtenerUsuarioActual()?.id || 0);
    this.cargarCuentas();
  }

  async cargarCuentas() {
    if (this.usuarioActual() === 0) return;
    this.cuentaStore.cargarCuentas();
    await this.utilServicio.esperarCargaDeStore(() =>
      this.cuentaStore.isLoading(),
    );

    const cuentas = this.listaObjCuentas();
    if (cuentas?.length) {
      const cuentalocal = cuentas[0];
      this.cuentaSeleccionada = cuentalocal;
      this.bitacoraStore.cargarBitacoras({
        bit_cueIdCuentas: cuentalocal.cue_idCuentas,
      });
    }
  }

  cargarBitacoras() {
    if (!this.cuentaSeleccionada.cue_idCuentas) {
      this.utilServicio.mostrarToast('Debe seleccionar una cuenta', 'warning');
      return;
    }
    this.bitacoraStore.cargarBitacoras({
      bit_cueIdCuentas: this.cuentaSeleccionada.cue_idCuentas,
    });
  }

  async seleccionrCuenta(event: any) {
    this.cuentaSeleccionada = event.detail.value;
    this.cargarBitacoras();
    this.limpiarFormulario();
    this.habilitaEdicion.set(true);
  }

  seleccionarImagen(event: any): void {
    this.manejoImagenes.seleccionarImagen(event, (file, preview) => {
      this.selectedImage = file;
      this.imagePreview = preview;
    });
  }

  eliminarImagen(): void {
    this.manejoImagenes.eliminarImagen(this.fileInput, () => {
      this.selectedImage = null;
      this.imagePreview = null;
    });
  }

  async finalizarOperacionBitacora() {
    const { resultado, monto, reglas, analisis, lecciones, urlImagen } =
      this.bitacoraForm.value;

    if (!this.objSeguimiento) {
      this.utilServicio.mostrarToast('No hay bitácora seleccionada', 'danger');
      return;
    }
    const cuentaId = this.cuentaSeleccionada.cue_idCuentas ?? 0;
    if (this.isWeb) {
      this.dbWebStore.cargarDividendosKelly(cuentaId, this.usuarioActual());
      await this.utilServicio.esperarCargaDeStore(() =>
        this.dbWebStore.isLoading(),
      );
      var dividendosKelly = this.dbWebStore.listaDividendos();
    } else {
      this.dbAppStore.cargarDividendosKelly(cuentaId, this.usuarioActual());
      await this.utilServicio.esperarCargaDeStore(() =>
        this.dbAppStore.isLoading(),
      );
      var dividendosKelly = this.dbAppStore.listaDividendos();
    }
    if (!dividendosKelly || dividendosKelly.length === 0) {
      dividendosKelly = [{ agr_valor: 10 }];
    }

    const objActualizarFinal: ActualizarBitacoraFinalModelo = {
      bit_idbitacora: this.objSeguimiento?.bit_idbitacora ?? 0,
      bit_resultado:
        resultado != null && resultado !== ''
          ? resultado
          : (this.objSeguimiento?.bit_resultado ?? ''),
      bit_montoResult:
        monto != null && monto !== ''
          ? Number(monto)
          : (this.objSeguimiento?.bit_montoResult ?? 0),
      bit_respeReglas:
        reglas != null && reglas !== ''
          ? reglas
          : (this.objSeguimiento?.bit_respeReglas ?? ''),
      bit_situacion: 'F',
      bit_cueIdCuentas: this.cuentaSeleccionada.cue_idCuentas ?? 0,
      cke_numDivisor: dividendosKelly[0]?.agr_valor ?? 0,
    };

    const tieneContenidoValido = (campo: any): boolean => {
      return (
        campo !== null &&
        campo !== undefined &&
        campo !== '' &&
        campo.trim() !== ''
      );
    };

    const comentarios: ComentarioModelo[] = [];
    if (lecciones) {
      comentarios.push({
        obs_bitIdbitaco: this.objSeguimiento.bit_idbitacora ?? 0,
        obs_comentario: lecciones,
        obs_tipoObserva: 'L',
        obs_imagen: '--',
      });
    }
    if (analisis || !lecciones) {
      comentarios.push({
        obs_bitIdbitaco: this.objSeguimiento.bit_idbitacora ?? 0,
        obs_comentario: analisis,
        obs_tipoObserva: 'F',
        obs_imagen: urlImagen || this.imagePreview || '--',
      });
    }

    if (tieneContenidoValido(lecciones) && tieneContenidoValido(analisis)) {
      this.comentariosStore.guardarComentarios(comentarios);
      await this.utilServicio.mostrarToastOperacion(
        this.comentariosStore,
        'Comentario guardado exitosamente',
        undefined,
        'warning',
      );
    }

    if (objActualizarFinal.bit_idbitacora) {
      this.bitacoraStore.finalizaOperacionBitacora(objActualizarFinal);
      await this.utilServicio.mostrarToastOperacion(
        this.bitacoraStore,
        'Operación finalizada exitosamente',
      );
    }
    this.limpiarFormulario();
  }

  limpiarFormulario() {
    this.bitacoraForm.reset();
    this.eliminarImagen();
    this.objSeguimiento = null;
  }

  finalizarOperativa(item: BitacoraModelo) {
    this.objSeguimiento = item;
  }

  cancelarFormulario() {
    this.limpiarFormulario();
  }
}
