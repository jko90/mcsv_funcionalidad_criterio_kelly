import {
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BitacoraModelo } from '../../modelos/Bitacora.modelo';
import { ComentarioModelo } from '../../modelos/Comentario.modelo';
import { CuentasModelo } from '../../../../config/cuentas/modelos/Cuentas.modelo';
import { ServicioAutenticacion } from 'src/app/nucleo/seguridad/servicio/ServicioAutenticacion';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { ManejoImagenesService } from 'src/app/compartidos/servicios/manejo-imagenes.service';
import { BitacoraStore } from '../../store/bitacoraStore';
import { CuentaStore } from '../../../../config/cuentas/store/cuentaStore';
import { ComentariosStore } from '../../store/comentariosStore';

@Component({
  selector: 'app-bitacora-seguimiento',
  templateUrl: './bitacora-seguimiento.page.html',
  styleUrls: ['./bitacora-seguimiento.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    EncabezadoComponent,
    ReactiveFormsModule,
  ],
})
export class BitacoraSeguimientoPage implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly authService = inject(ServicioAutenticacion);
  private readonly manejoImagenes = inject(ManejoImagenesService);
  private readonly bitacoraStore = inject(BitacoraStore);
  private readonly cuentaStore = inject(CuentaStore);
  private readonly comentariosStore = inject(ComentariosStore);

  titulo = 'OPERACIÓN';
  cargandoDatos = signal(false);
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  objSeguimiento: BitacoraModelo | null = null;
  usuarioActual = signal(0);
  habilitaEdicion = signal(false);

  cuentaSeleccionada = {} as CuentasModelo;
  bitacoraForm: FormGroup = this.fb.group({});

  listaObjCuentas = this.cuentaStore.listaCuentas;
  nuevaListaObjBitacora = this.bitacoraStore.listaBitacoraEnOperacion;
  listaComentarios = this.comentariosStore.listaComentarios;
  errorComentarios = this.comentariosStore.errorMessage;
  isLoadingComentarios = this.comentariosStore.isLoading;

  ngOnInit() {
    this.usuarioActual.set(this.authService.obtenerUsuarioActual()?.id || 0);
    this.bitacoraForm = this.fb.group({
      emocion: [''],
      descripcion: [''],
      urlImagen: [''],
    });
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

  async seleccionrCuenta(event: any) {
    this.cuentaSeleccionada = event.detail.value;
    this.cargarBitacoras();
    this.limpiarFormulario();
    this.habilitaEdicion.set(true);
  }

  seleccionarImagen(event: any): void {
    this.manejoImagenes.seleccionarImagen(
      event,
      (file, preview) => {
        this.selectedImage = file;
        this.imagePreview = preview;
      },
      (msg) => {
        this.utilServicio.mostrarToast(msg, 'danger');
      },
    );
  }

  eliminarImagen(): void {
    this.manejoImagenes.eliminarImagen(this.fileInput, () => {
      this.selectedImage = null;
      this.imagePreview = null;
    });
  }

  guardarObservacionPorBitacora() {
    const { emocion, descripcion, urlImagen } = this.bitacoraForm.value;
    const bitacoraId = this.objSeguimiento?.bit_idbitacora ?? 0;

    const comentarios: ComentarioModelo[] = [];

    if (emocion) {
      comentarios.push({
        obs_bitIdbitaco: bitacoraId,
        obs_comentario: emocion,
        obs_tipoObserva: 'E',
        obs_imagen: '--',
      });
    }

    if (descripcion || !emocion) {
      comentarios.push({
        obs_bitIdbitaco: bitacoraId,
        obs_comentario: descripcion,
        obs_tipoObserva: 'P',
        obs_imagen: urlImagen || this.imagePreview || '--',
      });
    }

    if (comentarios.length) {
      this.comentariosStore.guardarComentarios(comentarios);
      this.utilServicio.mostrarToast(
        'Comentario guardado exitosamente',
        'success',
      );
    }
    this.limpiarFormulario();
  }

  limpiarFormulario() {
    this.bitacoraForm.reset();
    this.objSeguimiento = null;
    this.eliminarImagen();
  }

  async editarComentarios(item: BitacoraModelo) {
    this.objSeguimiento = item;
    await this.obtenerCometariosPorBitacora(
      this.objSeguimiento.bit_idbitacora ?? 0,
    );

    const getComentarioPorTipo = (tipo: string) =>
      this.listaComentarios().find(
        (comentario) => comentario.obs_tipoObserva === tipo,
      ) || ({} as ComentarioModelo);

    const emocion = getComentarioPorTipo('E');
    const descripcion = getComentarioPorTipo('P');

    this.bitacoraForm.patchValue({
      emocion: emocion.obs_comentario || '',
      descripcion: descripcion.obs_comentario || '',
      urlImagen:
        typeof descripcion.obs_imagen === 'string' &&
        !descripcion.obs_imagen.startsWith('data:')
          ? descripcion.obs_imagen
          : '',
    });

    this.imagePreview =
      typeof descripcion.obs_imagen === 'string' &&
      descripcion.obs_imagen.startsWith('data:')
        ? descripcion.obs_imagen
        : null;

    this.selectedImage = null;
  }

  async obtenerCometariosPorBitacora(idBitacora: number): Promise<void> {
    if (!idBitacora) {
      this.utilServicio.mostrarToast('ID de bitácora no válido', 'danger');
      return;
    }
    this.cargandoDatos.set(true);
    const loading = await this.utilServicio.mostrarCargando(
      'Cargando observaciones...',
    );

    this.comentariosStore.cargarComentarios(idBitacora);
    await this.utilServicio.esperarCargaDeStore(() =>
      this.isLoadingComentarios(),
    );

    if (this.errorComentarios()) {
      this.utilServicio.mostrarToast(
        this.errorComentarios() || 'Error al cargar las observaciones',
        'warning',
      );
    }

    this.cargandoDatos.set(false);
    loading.dismiss();
  }

  cancelarFormulario() {
    this.objSeguimiento = null;
    this.limpiarFormulario();
  }
}
