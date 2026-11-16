import { CommonModule } from '@angular/common';
import {
  Component,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { ModalBuscaDivisaComponent } from '../../componentes/modal-busca-divisa/modal-busca-divisa.component';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import {
  ActualizarTPSLBEComentarios,
  BitacoraModelo,
  RegistroBitacoraModelo,
} from '../../modelos/Bitacora.modelo';
import { listDivisas } from '../../modelos/listaDivisas';
import { DivisasModelo } from '../../modelos/Divisas.modelo';
import { ComentarioModelo } from '../../modelos/Comentario.modelo';
import { AlertaCkComponent } from 'src/app/compartidos/componentes/alerta-ck/alerta-ck.component';
import { ALERTA_ELIMINAR_REGISTRO } from 'src/app/compartidos/textos-alertas';
import { CuentasModelo } from '../../../../configuracion/cuentas/modelos/Cuentas.modelo';
import { ServicioAutenticacion } from 'src/app/nucleo/seguridad/servicio/ServicioAutenticacion';
import { BitacoraStore } from '../../store/bitacoraStore';
import { CuentaStore } from '../../../../configuracion/cuentas/store/cuentaStore';
import { ComentariosStore } from '../../store/comentariosStore';
import { ManejoImagenesService } from 'src/app/compartidos/servicios/manejo-imagenes.service';

@Component({
  selector: 'app-bitacora',
  templateUrl: './bitacora.page.html',
  styleUrls: ['./bitacora.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    EncabezadoComponent,
    ModalBuscaDivisaComponent,
    ReactiveFormsModule,
    AlertaCkComponent,
  ],
})
export class BitacoraPage implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly modalPreciosAbierto = signal(false);
  readonly idRegistroAEliminar = signal<number | null>(null);
  readonly alertaEliminar = ALERTA_ELIMINAR_REGISTRO;

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(ServicioAutenticacion);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly bitacoraStore = inject(BitacoraStore);
  private readonly cuentaStore = inject(CuentaStore);
  private readonly comentariosStore = inject(ComentariosStore);
  private readonly manejoImagenes = inject(ManejoImagenesService);

  titulo = 'OPERACIÓN';
  divisaSeleccionado: string = 'seleccionar';
  segmentoSeleccionado: string = 'forex';
  usuarioActual = signal(0);
  cargandoDatos = signal(false);
  habilitaEdicion = signal(false);

  tipoOperacion: string = '';
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  objDivisaSelecionado: DivisasModelo | null = null;

  objCometarioBitacora = {} as ComentarioModelo;
  cuentaSeleccionada = {} as CuentasModelo;
  objBitacoraActualizar = {} as BitacoraModelo;

  listaObjDivisas: DivisasModelo[] = [];

  bitacoraForm: FormGroup = this.fb.group({
    precioEntrada: [''],
    precioStopLost: [''],
    precioTakeProfit: [''],
    descripcion: [''],
    urlImagen: [''],
  });

  // Signals del store
  isLoading = this.bitacoraStore.isLoading;
  errorMessage = this.bitacoraStore.errorMessage;
  listaBitacoras = this.bitacoraStore.listaBitacoras;
  nuevaListaObjBitacora = this.bitacoraStore.listaBitacoraEnOperacion;
  listaObjCuentas = this.cuentaStore.listaCuentas;

  constructor() {
    effect(() => {
      const error = this.bitacoraStore.errorMessage();
      if (error) {
        this.utilServicio.mostrarToast(error, 'danger');
      }
    });

    effect(() => {
      const ultima = this.bitacoraStore.ultimaBitacora();
      if (ultima) {
        this.utilServicio.mostrarToast(
          'Bitácora guardada exitosamente',
          'success',
        );
        this.limpiarCamposGuardar();
        this.limpiarCampos();
      }
    });

    effect(() => {
      if (this.bitacoraStore.eliminacionExitosa()) {
        this.utilServicio.mostrarToast(
          'Bitácora eliminada exitosamente',
          'success',
        );
      }
    });
  }

  ngOnInit() {
    this.usuarioActual.set(this.authService.obtenerUsuarioActual()?.id || 0);
    this.listaObjDivisas = listDivisas;
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

  guardarBitacora() {
    if (this.divisaSeleccionado == 'seleccionar') {
      this.utilServicio.mostrarToast('Debe seleccionar una divisa', 'danger');
      return;
    }
    const {
      precioEntrada,
      precioStopLost,
      precioTakeProfit,
      descripcion,
      urlImagen,
    } = this.bitacoraForm.value;

    const objBitacoraGuardar: RegistroBitacoraModelo = {
      bit_numeroBitac: 0,
      bit_cueIdCuentas: this.cuentaSeleccionada.cue_idCuentas || 0,
      bit_divisa: this.divisaSeleccionado,
      bit_tipoOperaci: this.tipoOperacion,
      bit_precioEntra: precioEntrada || 0,
      bit_precioSL: precioStopLost || 0,
      bit_precioTP: precioTakeProfit || 0,
      bit_fechaCrea: new Date().toISOString(),
      obs_comentario: descripcion,
      obs_tipoObserva: 'I',
      obs_imagen: urlImagen || this.imagePreview || null,
    };
    this.bitacoraStore.guardarBitacora(objBitacoraGuardar);
  }

  async seleccionrCuenta(event: any) {
    this.habilitaEdicion.set(true);
    this.cuentaSeleccionada = event.detail.value;
    this.limpiarCampos();
    this.segmentoSeleccionado = 'forex';
    this.divisaSeleccionado = 'seleccionar';
    this.limpiarCamposGuardar();
    this.cargarBitacoras();
  }

  cambioSegmento(event: any) {
    this.segmentoSeleccionado = event.detail.value;
    this.limpiarCampos();
    this.divisaSeleccionado = 'seleccionar';
    this.limpiarCamposGuardar();
  }

  seleccionaTipoOperacion(event: any) {
    this.tipoOperacion = event.detail.value;
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

  cambiarSeleccionDivisa(divisaValue: DivisasModelo) {
    this.objDivisaSelecionado = divisaValue;
    this.divisaSeleccionado = divisaValue ? divisaValue.text : 'seleccionar';
    this.limpiarCampos();
    this.limpiarCamposGuardar();
  }

  limpiarCampos() {
    this.selectedImage = null;
    this.imagePreview = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    if (this.bitacoraForm) {
      this.bitacoraForm.reset();
    }
  }

  limpiarCamposGuardar() {
    this.tipoOperacion = '';
    this.objDivisaSelecionado = null;
  }

  solicitarEliminarRegistro(id: number | undefined): void {
    if (id === undefined) return;
    this.idRegistroAEliminar.set(id);
  }

  confirmarEliminarRegistro(): void {
    const id = this.idRegistroAEliminar();
    this.idRegistroAEliminar.set(null);
    if (id !== null) this.bitacoraStore.eliminarBitacora(id);
  }

  cancelarEliminarRegistro(): void {
    this.idRegistroAEliminar.set(null);
    this.utilServicio.mostrarToast('Eliminación cancelada', 'danger');
  }

  async editarPrecios(objBitacora: BitacoraModelo) {
    this.objBitacoraActualizar = objBitacora;
    this.limpiarCampos();

    this.cargandoDatos.set(true);
    const loading = await this.utilServicio.mostrarCargando(
      'Cargando observaciones...',
    );

    this.comentariosStore.cargarComentarios(objBitacora.bit_idbitacora || 0);
    await this.utilServicio.esperarCargaDeStore(() =>
      this.comentariosStore.isLoading(),
    );
    await loading.dismiss();

    const comentarios = this.comentariosStore.listaComentarios();
    this.objCometarioBitacora =
      comentarios.find((c) => c.obs_tipoObserva === 'I') ??
      ({} as ComentarioModelo);

    this.bitacoraForm.patchValue({
      precioEntrada: objBitacora.bit_precioEntra || '',
      precioStopLost: objBitacora.bit_precioSL || '',
      precioTakeProfit: objBitacora.bit_precioTP || '',
      descripcion: this.objCometarioBitacora.obs_comentario || '',
      urlImagen:
        this.objCometarioBitacora.obs_imagen &&
        typeof this.objCometarioBitacora.obs_imagen === 'string' &&
        !this.objCometarioBitacora.obs_imagen.startsWith('data:')
          ? this.objCometarioBitacora.obs_imagen
          : '',
    });

    this.imagePreview =
      this.objCometarioBitacora.obs_imagen &&
      typeof this.objCometarioBitacora.obs_imagen === 'string' &&
      this.objCometarioBitacora.obs_imagen.startsWith('data:')
        ? this.objCometarioBitacora.obs_imagen
        : null;

    this.selectedImage = null;

    this.cargandoDatos.set(false);
    this.modalPreciosAbierto.set(true);
  }

  async ActualizarPreciosGuardado() {
    const form = this.bitacoraForm.value;

    let imagenFinal: string | ArrayBuffer | null = '';
    if (form.urlImagen && form.urlImagen.trim() !== '') {
      imagenFinal = form.urlImagen;
    } else if (this.imagePreview) {
      imagenFinal = this.imagePreview;
    } else if (
      this.objCometarioBitacora &&
      this.objCometarioBitacora.obs_imagen
    ) {
      imagenFinal = this.objCometarioBitacora.obs_imagen;
    } else {
      imagenFinal = null;
    }

    const actualizarBitacoraComentario: ActualizarTPSLBEComentarios = {
      bit_precioEntra:
        form.precioEntrada !== '' &&
        form.precioEntrada !== null &&
        form.precioEntrada !== undefined
          ? Number(form.precioEntrada)
          : (this.objBitacoraActualizar.bit_precioEntra ?? 0),
      bit_precioSL:
        form.precioStopLost !== '' &&
        form.precioStopLost !== null &&
        form.precioStopLost !== undefined
          ? Number(form.precioStopLost)
          : (this.objBitacoraActualizar.bit_precioSL ?? 0),
      bit_precioTP:
        form.precioTakeProfit !== '' &&
        form.precioTakeProfit !== null &&
        form.precioTakeProfit !== undefined
          ? Number(form.precioTakeProfit)
          : (this.objBitacoraActualizar.bit_precioTP ?? 0),
      bit_idbitacora: this.objBitacoraActualizar.bit_idbitacora || 0,
      obs_idObserva: this.objCometarioBitacora.obs_idObserva || 0,
      obs_imagen: imagenFinal,
      obs_comentario:
        form.descripcion !== undefined && form.descripcion !== null
          ? form.descripcion
          : this.objCometarioBitacora.obs_comentario || '',
    };

    this.cargandoDatos.set(true);
    const loading = await this.utilServicio.mostrarCargando(
      'Actualizando bitácora...',
    );

    this.comentariosStore.actualizarComentarioBitacora(
      actualizarBitacoraComentario,
    );

    await this.utilServicio.esperarCargaDeStore(() =>
      this.comentariosStore.isLoading(),
    );
    await loading.dismiss();

    if (!this.comentariosStore.errorMessage()) {
      const lista = [...this.nuevaListaObjBitacora()];
      const index = lista.findIndex(
        (bitacora) =>
          bitacora.bit_idbitacora ===
          actualizarBitacoraComentario.bit_idbitacora,
      );
      if (index !== -1) {
        lista[index] = {
          ...lista[index],
          bit_precioEntra: actualizarBitacoraComentario.bit_precioEntra,
          bit_precioSL: actualizarBitacoraComentario.bit_precioSL,
          bit_precioTP: actualizarBitacoraComentario.bit_precioTP,
        };
        this.bitacoraStore.setBitacoras(lista);
      }

      this.limpiarCampos();
      this.objCometarioBitacora = {} as ComentarioModelo;
      this.objBitacoraActualizar = {} as BitacoraModelo;
      this.modalPreciosAbierto.set(false);
      await this.utilServicio.mostrarToast(
        'Bitácora actualizada exitosamente',
        'success',
      );
    } else {
      await this.utilServicio.mostrarToast(
        this.comentariosStore.errorMessage() ||
          'Error al actualizar la bitácora',
        'danger',
      );
    }
    this.cargandoDatos.set(false);
  }
}
