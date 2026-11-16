import {
  desescaparEntidades,
  enlaceWhatsapp,
  mensajeSolicitudBanco,
  numeroWhatsapp,
} from './textos-pago';

const RESUMEN = { nombrePlan: 'Pro', intervalo: 'Mensual', monto: 20 };

describe('textos-pago', () => {
  it('sin número no hay enlace de WhatsApp', () => {
    expect(enlaceWhatsapp(numeroWhatsapp(null), 'hola')).toBeNull();
    expect(enlaceWhatsapp(numeroWhatsapp(''), 'hola')).toBeNull();
  });

  it('el número de WhatsApp queda solo con dígitos', () => {
    expect(numeroWhatsapp('+593 99-999')).toBe('59399999');
  });

  it('el mensaje menciona plan, intervalo y monto, y el enlace lo codifica', () => {
    const mensaje = mensajeSolicitudBanco(RESUMEN);
    expect(mensaje).toContain('Pro (Mensual)');
    expect(mensaje).toContain('20');
    const enlace = enlaceWhatsapp('59399999', mensaje) ?? '';
    expect(enlace.startsWith(['https://wa.me', '59399999?text='].join('/'))).toBeTrue();
    expect(enlace).not.toContain(' ');
  });

  it('una plantilla vacía o nula usa el texto estándar', () => {
    const estandar = mensajeSolicitudBanco(RESUMEN);
    expect(mensajeSolicitudBanco(RESUMEN, null)).toBe(estandar);
    expect(mensajeSolicitudBanco(RESUMEN, '   ')).toBe(estandar);
  });

  it('la plantilla reemplaza {plan} y {monto}', () => {
    const mensaje = mensajeSolicitudBanco(RESUMEN, 'Quiero {plan} por {monto}. Gracias {plan}');
    expect(mensaje).toBe('Quiero Pro (Mensual) por 20. Gracias Pro (Mensual)');
  });

  it('sin monto, {monto} queda vacío y no se escribe «null»', () => {
    const mensaje = mensajeSolicitudBanco({ ...RESUMEN, monto: null }, 'Plan {plan}{monto}');
    expect(mensaje).toBe('Plan Pro (Mensual)');
  });

  it('la plantilla no agrega datos personales ni deja entidades escapadas', () => {
    const mensaje = mensajeSolicitudBanco(RESUMEN, 'Hola &amp; gracias, es &quot;{plan}&quot;');
    expect(mensaje).toBe('Hola & gracias, es "Pro (Mensual)"');
  });

  it('desescaparEntidades revierte lo que escapa el servidor sin doble decodificar', () => {
    expect(desescaparEntidades('O&#039;Brien &amp; Co')).toBe("O'Brien & Co");
    expect(desescaparEntidades('&amp;lt;')).toBe('&lt;');
  });
});
