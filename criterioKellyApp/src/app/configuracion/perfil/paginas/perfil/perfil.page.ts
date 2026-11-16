import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { Router } from '@angular/router';
import { ServicioAutenticacion } from 'src/app/nucleo/seguridad/servicio/ServicioAutenticacion';
import {
  ActualizarPerfilRequest,
  CambiarClaveRequest,
  VALIDACIONES,
} from '../../modelos/Perfil.modelo';
import { UsuarioApp } from '../../../../funcionalidad/autenticacion/modelo/Login.modelo';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { PerfilStore } from '../../store/perfilStore';
import { AlertaCkComponent } from 'src/app/compartidos/componentes/alerta-ck/alerta-ck.component';
import { ALERTA_CERRAR_SESIONES } from 'src/app/compartidos/textos-alertas';
import { ServicioInactividad } from 'src/app/nucleo/seguridad/servicio/ServicioInactividad';
import { FormularioCambioClaveComponent } from '../../componentes/formulario-cambio-clave/formulario-cambio-clave.component';
import { SesionStore } from 'src/app/nucleo/store/sesion.store';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicComponentes,
    EncabezadoComponent,
    ReactiveFormsModule,
    FormularioCambioClaveComponent,
    AlertaCkComponent,
  ],
})
export class PerfilPage {
  readonly titulo = 'CONFIGURACIÓN';
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(ServicioAutenticacion);
  private readonly utilServicio = inject(UtilitariosService);
  private readonly router = inject(Router);
  private readonly perfilStore = inject(PerfilStore);
  private readonly sesionStore = inject(SesionStore);
  private readonly servicioInactividad = inject(ServicioInactividad);

  readonly alertaCerrarSesiones = ALERTA_CERRAR_SESIONES;
  readonly cerrarSesionesPendiente = signal(false);

  perfilForm: FormGroup = this.formBuilder.group({});
  readonly reinicioFormularioClave = signal(0);

  cargandoCambioContrasena = this.perfilStore.cargandoCambioContrasena;
  cargandoActualizacion = this.perfilStore.cargandoActualizacion;
  respuestaClave = this.perfilStore.respuestaClave;
  respuestaPerfil = this.perfilStore.respuestaPerfil;
  errorActualizacion = this.perfilStore.errorActualizacion;
  errorCambioClave = this.perfilStore.errorCambioClave;

  objUsuarioActual = signal({} as UsuarioApp);

  constructor() {
    this.inicializarFormularios();
    this.objUsuarioActual.set(
      this.authService.obtenerUsuarioActual() || ({} as UsuarioApp),
    );
    this.cargarDatosUsuario();

    effect(() => {
      const resp = this.respuestaPerfil();
      const err = this.errorActualizacion();

      if (resp) {
        if (!resp.error) {
          if (this.objUsuarioActual()) {
            this.objUsuarioActual().nombres =
              resp.nombres || this.objUsuarioActual().nombres;
            this.objUsuarioActual().apellidos =
              resp.apellidos || this.objUsuarioActual().apellidos;
            this.sesionStore.actualizarDatosUsuario(this.objUsuarioActual());
          }
          this.utilServicio.mostrarToast(
            'Perfil actualizado exitosamente',
            'success',
          );
        } else {
          this.utilServicio.mostrarToast(resp.error, 'danger');
        }
        this.perfilStore.limpiarPerfil();
      } else if (err) {
        this.utilServicio.mostrarToast(err, 'danger');
        this.perfilStore.limpiarErrorPerfil();
      }
    });

    effect(() => {
      const resp = this.respuestaClave();
      const err = this.errorCambioClave();
      if (resp) {
        if (!resp.error) {
          this.utilServicio.mostrarToast(
            'Contraseña actualizada exitosamente',
            'success',
          );
          this.reinicioFormularioClave.update((valor) => valor + 1);
        }
        this.perfilStore.limpiarPerfil();
      } else if (err) {
        this.perfilStore.limpiarErrorClave();
      }
    });
  }

  esCampoInvalido(form: FormGroup, campo: string): boolean {
    const control = form.get(campo);
    return !!(control?.invalid && control?.touched);
  }

  private inicializarFormularios(): void {
    this.perfilForm = this.formBuilder.group({
      per_nombres: [
        '',
        [
          Validators.required,
          Validators.minLength(VALIDACIONES.MIN_LENGTH_NOMBRES),
        ],
      ],
      per_apellidos: [
        '',
        [
          Validators.required,
          Validators.minLength(VALIDACIONES.MIN_LENGTH_APELLIDOS),
        ],
      ],
      per_telefono: [
        '',
        [Validators.required, Validators.pattern(VALIDACIONES.TELEFONO_REGEX)],
      ],
    });
  }

  private cargarDatosUsuario(): void {
    if (this.objUsuarioActual()) {
      this.perfilForm.patchValue({
        per_nombres: this.objUsuarioActual().nombres || '',
        per_apellidos: this.objUsuarioActual().apellidos || '',
        per_telefono: '',
      });
    }
  }

  actualizarPerfil(): void {
    if (this.perfilForm.valid && !this.cargandoActualizacion()) {
      const request: ActualizarPerfilRequest = {
        nombres: this.perfilForm.value.per_nombres.trim(),
        apellidos: this.perfilForm.value.per_apellidos.trim(),
        telefono: this.perfilForm.value.per_telefono.trim(),
      };
      this.perfilStore.actualizarPerfil(request);
    }
  }

  alCambiarClave(request: CambiarClaveRequest): void {
    if (!this.cargandoCambioContrasena())
      this.perfilStore.cambiarClave(request);
  }

  irACambiarPin(): void {
    this.router.navigate(['/cambiar-pin']);
  }

  alSolicitarCerrarSesiones(): void {
    this.cerrarSesionesPendiente.set(true);
  }

  alDescartarCerrarSesiones(): void {
    this.cerrarSesionesPendiente.set(false);
  }

  async alConfirmarCerrarSesiones(): Promise<void> {
    this.cerrarSesionesPendiente.set(false);
    this.sesionStore.cerrarTodasLasSesiones();
    try {
      await this.utilServicio.esperarCargaDeStore(() =>
        this.sesionStore.isLoading(),
      );
    } catch {
      // La limpieza local ocurre en el finalize del store.
    }
    this.servicioInactividad.finalizarSalida();
  }
}
