import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonicComponentes } from 'src/app/compartidos/IonicComponentes';
import { UtilitariosService } from 'src/app/compartidos/servicios/utilitarios.service';
import { EncabezadoComponent } from 'src/app/compartidos/encabezado/encabezado.component';
import { RecuperacionClaveStore } from '../store/recuperacion-clave.store';
import { FormularioSolicitarCodigoComponent } from '../componentes/formulario-solicitar-codigo/formulario-solicitar-codigo.component';
import { FormularioRestablecerClaveComponent } from '../componentes/formulario-restablecer-clave/formulario-restablecer-clave.component';
import { DatosRestablecimiento } from '../modelos/RecuperacionClave.modelo';

@Component({
  selector: 'app-recuperar-clave',
  standalone: true,
  imports: [IonicComponentes, EncabezadoComponent, FormularioSolicitarCodigoComponent, FormularioRestablecerClaveComponent],
  templateUrl: './recuperar-clave.page.html',
  styleUrls: ['./recuperar-clave.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecuperarClavePage {
  private readonly store = inject(RecuperacionClaveStore);
  private readonly router = inject(Router);
  private readonly utilServicio = inject(UtilitariosService);
  readonly paso = this.store.paso;
  readonly correo = this.store.correo;
  readonly mensajeSolicitud = this.store.mensajeSolicitud;
  readonly estaCargando = this.store.isLoading;
  readonly titulo = 'RECUPERAR CONTRASEÑA';

  constructor() {
    effect(() => {
      if (this.paso() === 'completado') {
        void this.utilServicio.mostrarToast(
          'Contraseña restablecida. Inicie sesión con su nueva contraseña.',
          'success',
        );
        this.store.reiniciar();
        void this.router.navigate(['/login']);
      }
    });
  }

  ionViewWillEnter(): void {
    this.store.reiniciar();
  }

  alSolicitarCodigo(correo: string): void {
    this.store.solicitarCodigo(correo);
  }

  alRestablecerClave(datos: DatosRestablecimiento): void {
    this.store.restablecerClave(datos);
  }

  alSolicitarOtroCodigo(): void {
    this.store.volverASolicitar();
  }
}
