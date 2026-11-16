import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval, map } from 'rxjs';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { EncabezadoComponent } from 'src/app/compartidos/componentes/encabezado/encabezado.component';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { FormularioVerificarCorreoComponent } from '../../componentes/formulario-verificar-correo/formulario-verificar-correo.component';
import { ActivacionCuenta } from '../../modelos/VerificacionCorreo.modelo';
import { VerificacionCorreoStore } from '../../store/verificacion-correo.store';

const MILISEGUNDOS_POR_SEGUNDO = 1000;

// Esta página no reinicia el store al entrar: quien navega aquí (registro o
// login) ya lo inicia, y reiniciarlo borraría el correo recién registrado.
@Component({
  selector: 'app-verificar-correo',
  standalone: true,
  imports: [
    IonicComponentes,
    EncabezadoComponent,
    FormularioVerificarCorreoComponent,
  ],
  templateUrl: './verificar-correo.page.html',
  styleUrls: ['./verificar-correo.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificarCorreoPage {
  private readonly store = inject(VerificacionCorreoStore);
  private readonly router = inject(Router);
  private readonly utilServicio = inject(UtilitariosService);

  readonly titulo = 'VERIFICAR CORREO';
  readonly correo = this.store.correo;
  readonly estaCargando = this.store.isLoading;
  readonly mensajeReenvio = this.store.mensajeReenvio;
  readonly paso = this.store.paso;

  private readonly ahora = toSignal(
    interval(MILISEGUNDOS_POR_SEGUNDO).pipe(map(() => Date.now())),
    { initialValue: Date.now() },
  );
  readonly segundosRestantes = computed(() =>
    Math.max(
      0,
      Math.ceil(
        (this.store.reenvioDisponibleEn() - this.ahora()) /
          MILISEGUNDOS_POR_SEGUNDO,
      ),
    ),
  );

  constructor() {
    effect(() => {
      if (this.paso() === 'activada') {
        void this.utilServicio.mostrarToast(
          'Cuenta activada. Inicia sesión con tu usuario y contraseña.',
          'success',
        );
        this.store.reiniciar();
        void this.router.navigate(['/login']);
      }
    });
  }

  alActivar(datos: ActivacionCuenta): void {
    this.store.activarCuenta(datos);
  }

  alReenviar(correo: string): void {
    this.store.reenviarCodigo(correo);
  }

  alVolverAlLogin(): void {
    void this.router.navigate(['/login']);
  }
}
