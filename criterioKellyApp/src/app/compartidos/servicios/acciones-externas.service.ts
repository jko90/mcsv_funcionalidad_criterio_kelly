import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AccionesExternasService {
  async copiarTexto(texto: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      return this.copiarConRespaldo(texto);
    }
  }

  // Abre fuera de la app (WhatsApp, navegador); noopener evita dar acceso a esta ventana.
  abrirEnlaceExterno(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Respaldo para webviews sin Clipboard API o sin permiso.
  private copiarConRespaldo(texto: string): boolean {
    const areaTexto = document.createElement('textarea');
    areaTexto.value = texto;
    areaTexto.setAttribute('readonly', '');
    areaTexto.style.position = 'fixed';
    areaTexto.style.opacity = '0';
    document.body.appendChild(areaTexto);
    areaTexto.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(areaTexto);
    }
  }
}
