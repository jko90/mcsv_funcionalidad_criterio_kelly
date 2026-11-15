import { Injectable, ElementRef } from '@angular/core';

const MAX_IMAGE_SIZE = 0.48 * 1024 * 1024;
const COMPRESS_QUALITY = 0.7;
const MAX_DIMENSION = 512;
const MIN_QUALITY = 0.2;
const QUALITY_STEP = 0.1;

@Injectable({
  providedIn: 'root',
})
export class ManejoImagenesService {
  seleccionarImagen(
    event: Event,
    onSuccess: (file: File, preview: string) => void,
    onError?: (msg: string) => void,
  ): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError?.('Por favor seleccione un archivo de imagen válido');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result as string;
      if (file.size <= MAX_IMAGE_SIZE) {
        onSuccess(file, result);
      } else {
        this.comprimirImagen(
          file,
          result,
          COMPRESS_QUALITY,
          onSuccess,
          onError,
          MAX_IMAGE_SIZE,
        );
      }
    };
    reader.readAsDataURL(file);
  }

  comprimirImagen(
    inputFile: File,
    dataUrl: string,
    compressQuality: number,
    onSuccess: (file: File, preview: string) => void,
    onError?: (msg: string) => void,
    maxSize: number = MAX_IMAGE_SIZE,
  ): void {
    const intentarComprimir = (quality: number) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onError?.('No se pudo procesar la imagen');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              onError?.('No se pudo comprimir la imagen');
              return;
            }
            if (blob.size > maxSize && quality > MIN_QUALITY) {
              intentarComprimir(quality - QUALITY_STEP);
              return;
            }
            if (blob.size > maxSize) {
              onError?.('No se pudo comprimir la imagen al tamaño permitido');
              return;
            }
            const compressedFile = new File([blob], inputFile.name, {
              type: inputFile.type,
            });
            const reader2 = new FileReader();
            reader2.onload = (e2: ProgressEvent<FileReader>) => {
              onSuccess(compressedFile, e2.target?.result as string);
            };
            reader2.readAsDataURL(compressedFile);
          },
          inputFile.type,
          quality,
        );
      };
      img.onerror = () =>
        onError?.('No se pudo cargar la imagen para comprimir');
      img.src = dataUrl;
    };

    intentarComprimir(compressQuality);
  }

  eliminarImagen(
    fileInput: ElementRef<HTMLInputElement> | null,
    limpiarImagen: () => void,
  ): void {
    limpiarImagen();
    if (fileInput) {
      fileInput.nativeElement.value = '';
    }
  }
}
