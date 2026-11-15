# HU-002 · Estructura del frontend por dominios y subdominios (`criterioKellyApp/src/app`)

| Campo | Valor |
|-------|-------|
| ID | HU-002 (rev. 2, 2026-11-15: **unifica** la HU-002 original y la HU-008; esta es la única historia de la reorganización) |
| Fecha | 2026-11-07 (original) · 2026-11-15 (rev. 2) |
| Estado | Por planificar (sin HLT todavía) |
| Prioridad | Media (orden y mantenibilidad; no cambia funcionalidad) |
| Proyecto | `criterioKellyApp` únicamente (`src/app`). Sin cambios en backend ni en la base de datos |
| Origen | HU-002 original (estructura por dominios) + petición del usuario del 2026-11-15: ordenar por **dominios** (configuración, administración, reportes, compartidos a nivel app…) y **subdominios** (compartido a nivel dominio, criterio Kelly, suscripción…), con componentes, modelos, páginas, servicios y store en cada subdominio, **reubicando sin tocar el código** |
| Depende de | HU-001 (sesión y PIN, ya implementada), HU-006 (alertas) y HU-007 (piezas reutilizables), ya implementadas |
| Agente de implementación | `desarrollador-ionic` |

## Historia

**Como** desarrollador que mantiene Criterio Kelly,
**quiero** que el código esté ordenado por dominios y subdominios, y que cada subdominio tenga siempre las mismas carpetas (componentes, modelos, páginas, servicios y store),
**para** encontrar cualquier pieza por su nombre de negocio sin buscar, cambiar un subdominio sin romper otros y que un desarrollador nuevo entienda la app leyendo las carpetas.

**Como** persona que usa la app,
**quiero** que nada cambie al usarla,
**para** no notar la reorganización.

## Principios

1. **Solo se reubica.** No se cambia lógica, nombres de clases ni de archivos, validaciones, selectores, URLs ni textos. Lo único que se edita dentro de un archivo son las **rutas de importación** y las rutas a archivos movidos (`loadComponent`, `templateUrl`, `styleUrls`).
2. **Misma funcionalidad, mismas pruebas.** Los specs se mueven junto a su archivo. Antes y después: mismos resultados de `ng test`, mismo `ng build` y mismas URLs.
3. **Un movimiento no se mezcla con una edición.** Los archivos se mueven con el sistema de archivos (git detecta los renombres al confirmar) y, en el mismo paso, solo cambian las líneas de importación.
4. **Por oleadas.** Un dominio por vez, compilando y probando al final de cada oleada, para poder detenerse o revertir una oleada sin afectar a las demás.

## Análisis de la estructura actual (verificado el 2026-11-15)

Hay 156 archivos `.ts` (sin specs) en `src/app`, repartidos entre `compartidos/` y `paginas/`, con 8 carpetas de «feature»: `administracion`, `configuracion`, `criterioKelly`, `inicio`, `planTrading`, `reportes`, `suscripcion` y `util`.

### Problemas que esta historia resuelve

| # | Problema | Evidencia |
|---|----------|-----------|
| P-01 | **`configuracion/` es un cajón de sastre**: cuentas y capital, perfil y clave, PIN de bloqueo y divisor Kelly | `paginas/configuracion/{cuentas,perfil,bloqueo,cambiar-pin,operativa-kelly}` |
| P-02 | **`util/` mezcla identidad con contenido informativo**: login, recuperación de clave y verificación de correo conviven con «ayuda» y «acerca de» | `paginas/util/*` |
| P-03 | **El registro de usuario vive en `suscripcion/`** aunque crea una persona y un usuario | `paginas/suscripcion/registro/` |
| P-04 | **`compartidos/` mezcla tres cosas**: núcleo de la aplicación (sesión, guardas, interceptores, estado, menú), persistencia local de dos dominios (PIN y divisor Kelly) y UI reutilizable | `compartidos/{seguridades,interceptors,store,servicios}` |
| P-05 | **Las cuentas son el dominio más usado y viven en `configuracion/`**; las usan `planTrading`, `reportes` y `criterioKelly` | importaciones entre features |
| P-06 | **Estructura interna no uniforme**: solo algunas features tienen `componentes/`; las páginas están sueltas en la raíz de cada feature junto a `modelos/`, `servicios/` y `store/`; `inicio/` no tiene store ni servicio | árbol de `paginas/` |
| P-07 | **Dependencia invertida de `compartidos/`**: los modelos `Rol` y `Login` (de sesión) viven en `paginas/util/modelos/` pero los importa `compartidos/` (3 archivos) | `compartidos/{modelos/sesion.modelo,seguridades/ServicioAutenticacion,store/sesion.store}` → `paginas/util/modelos/{Rol,Login}.modelo.ts` |

### Problemas de la historia original que ya no aplican

| Antes | Estado |
|-------|--------|
| Componentes con sufijo de página (`modal-pin`, `modal-actualiza-plan`, `seleccionar-cuentas`) y ruta propia `modal-pin` | **Resuelto en HU-007**: son `ModalPinComponent`, `AlertaLimitePlanComponent` y `SeleccionarCuentasComponent`; las rutas heredadas redirigen a `/inicio` |
| `seleccionar-cuentas` inyectaba stores (dependencia invertida) | **Resuelto en HU-007**: es presentacional |
| Pantallas con alertas por código (`AlertController`) | **Resuelto en HU-006** |
| Páginas demasiado grandes (`bitacora`, `cuentas`, `registro`) | **Fuera de alcance** (ver abajo) |

## Estructura objetivo

```
src/app/
├── app.component.*  app.routes.ts          # el shell y la tabla de rutas se quedan en la raíz
│
├── compartidos/                            # DOMINIO A NIVEL APP: lo que usan varios dominios
│   ├── componentes/      encabezado, aviso-sin-conexion, alerta-ck, alerta-limite-plan, seleccionar-cuentas
│   ├── modelos/          error-api, menu, sesion.modelo, pin-bloqueo.modelo, Rol.modelo, Login.modelo
│   ├── servicios/        utilitarios, manejo-imagenes, data-base(+web), almacen-seguro, coordinador-pestanas, limpieza-cliente, acciones-externas …
│   ├── store/            sesion, menu, estado-aplicacion, dbPIN-*, dbkelly-*, pin-bloqueo.feature
│   ├── seguridad/        guardas (GuardAutenticacion, GuardRoles, plan.guard), interceptores, ServicioAutenticacion, ServicioInactividad, NombreUsuarioSesion
│   ├── validadores/      politica-clave.validator
│   └── IonicComponentes.ts, textos-alertas.ts
│
├── <dominio>/                              # configuracion, administracion, reportes, negocio, general
│   ├── compartido/                         # SUBDOMINIO COMÚN A NIVEL DOMINIO: lo que usan varios subdominios de este dominio
│   └── <subdominio>/
│       ├── componentes/    presentacionales
│       ├── modelos/        interfaces y tipos
│       ├── paginas/        pantallas con ruta (una carpeta por página)
│       ├── servicios/      acceso a datos
│       └── store/          signalStore del subdominio
```

### Ejemplo completo: dominio `configuracion` · subdominio `cuentas`

```
configuracion/                              ← DOMINIO
└── cuentas/                                ← SUBDOMINIO
    ├── componentes/                        ← todos los componentes que cuentas necesita para funcionar
    │   └── seleccionar-cuentas/            (selector de cuentas; lo reutilizan analisis y operativas)
    │       ├── seleccionar-cuentas.component.ts | .html | .scss | .spec.ts
    ├── modelos/                            ← contratos de datos
    │   ├── Cuentas.modelo.ts
    │   └── Capital.modelo.ts
    ├── paginas/                            ← pantallas con ruta (una carpeta por página)
    │   └── cuentas/                        (ruta /cuentas)
    │       └── cuentas.page.ts | .html | .scss | .spec.ts
    ├── servicios/                          ← acceso a datos (HTTP)
    │   └── cuentas.service.ts
    └── store/                              ← estado y lógica (signalStore)
        └── cuentaStore.ts
```

Lo mismo se aplica a todos los subdominios. El **Anexo B** muestra el árbol final completo, sin dejar fuera ninguna página, componente ni archivo (328 archivos, con sus `.html`, `.scss` y `.spec.ts`).

**Regla de carpetas.** Un subdominio tiene las cinco carpetas (`componentes`, `modelos`, `paginas`, `servicios`, `store`) **cuando le corresponden**; una carpeta que no tendría archivos **no se crea** (sin `.gitkeep`). Los archivos de configuración pura (`*.config.ts`, textos, constantes) viven en una carpeta auxiliar `configuracion/` del subdominio, como hoy.

**Dónde va cada cosa.**
- Una pieza que usa **un solo subdominio** vive en ese subdominio.
- Una pieza que usan **varios subdominios del mismo dominio** vive en `<dominio>/compartido/`.
- Una pieza que usan **varios dominios** vive en `compartidos/` (nivel app).
- La persistencia local pareada web/nativo (`dbPIN-*`, `dbkelly-*`, `pin-bloqueo.feature`) **se queda en `compartidos/store/`**: el uso real (grep del 2026-11-15) muestra que `dbPIN-*` lo usan `configuracion` y `general/autenticacion` (login) y `dbkelly-*` lo usan `configuracion` y `negocio/bitacora` (bitacora-fin). Es lo que manda la regla; por eso difiere de la primera propuesta.

## Dominios y subdominios

| Dominio | Subdominios | Origen actual |
|---------|-------------|---------------|
| `configuracion` | `cuentas`, `perfil`, `bloqueo-pin`, `operativa-kelly` (sin `compartido`: no hay piezas que usen varios de sus subdominios) | `paginas/configuracion/*` + `compartidos/seleccionar-cuentas/` |
| `administracion` | `pagos`, `datos-pago` | `paginas/administracion/*` |
| `reportes` | `analisis`, `operativas`, `compartido` (store, servicio y modelo de reportes) | `paginas/reportes/*` |
| `negocio` | `criterio-kelly`, `bitacora`, `suscripcion` | `paginas/criterioKelly/*`, `paginas/planTrading/*`, `paginas/suscripcion/*` (menos `registro`) + `compartidos/servicios/acciones-externas.service.ts` |
| `general` | `autenticacion`, `inicio`, `informacion` | `paginas/util/*` (menos `Rol` y `Login` modelos), `paginas/inicio/*`, `paginas/suscripcion/registro/` |
| `compartidos` (app) | — (carpetas por tipo) | `compartidos/*` (+ `Rol.modelo.ts` y `Login.modelo.ts` de `util/modelos`) |

### Asignación por carpeta (resumen)

Cada archivo `.ts` se lleva consigo sus `.html`, `.scss` y `.spec.ts` (mismo nombre base). El detalle de los **156 archivos** está en el **Anexo A** (al final), generado con el uso real de cada pieza (`grep` del 2026-11-15).

| Carpeta actual en `src/app` | Destino |
|-----------------------------|---------|
| `app.component.*`, `app.routes.ts` | Se quedan en la raíz |
| `compartidos/{alerta-ck,alerta-limite-plan,aviso-sin-conexion,encabezado}/` | `compartidos/componentes/<nombre>/` |
| `compartidos/seleccionar-cuentas/` | `configuracion/cuentas/componentes/seleccionar-cuentas/` (es un componente de cuentas; lo usan `analisis` y `operativas`) |
| `compartidos/interceptors/` | `compartidos/seguridad/interceptores/` |
| `compartidos/seguridades/{GuardAutenticacion,GuardRoles,plan.guard}` | `compartidos/seguridad/guardas/` |
| `compartidos/seguridades/{ServicioAutenticacion,ServicioInactividad,NombreUsuarioSesion,hash-pin}` | `compartidos/seguridad/` |
| `compartidos/modelos/`, `compartidos/servicios/` (menos `acciones-externas`), `compartidos/store/`, `compartidos/validadores/`, `IonicComponentes.ts`, `textos-alertas.ts` | Se quedan en `compartidos/` con las mismas carpetas |
| `compartidos/servicios/acciones-externas.service.ts` | `negocio/suscripcion/servicios/` (solo lo usa `comprobante`) |
| `paginas/util/modelos/{Rol,Login}.modelo.ts` | `compartidos/modelos/` (los usa la sesión) |
| `paginas/configuracion/{cuentas,perfil,operativa-kelly,bloqueo,cambiar-pin}/` + `modelos/`, `servicios/`, `store/`, `componentes/` | `configuracion/{cuentas,perfil,operativa-kelly,bloqueo-pin}/…` (`bloqueo` y `cambiar-pin` y `modal-pin` → `bloqueo-pin`; `formulario-cambio-clave` → `perfil`) |
| `paginas/administracion/{validar-pagos,componentes,configuracion,modelos,servicios,store}` | `administracion/pagos/…` |
| `paginas/administracion/datos-pago/` | `administracion/datos-pago/…` (la página pasa a `paginas/datos-pago/`) |
| `paginas/reportes/{analisis,operativas}/` | `reportes/{analisis,operativas}/paginas/<nombre>/` |
| `paginas/reportes/componentes/{filtro-fechas,grafico-estadistico}`, `servicios/exportarExcel.service.ts` | `reportes/analisis/…` (filtro y exportación) y `reportes/operativas/componentes/` (gráfico) |
| `paginas/reportes/{modelos,servicios/reportes.service.ts,store}` | `reportes/compartido/…` |
| `paginas/criterioKelly/` | `negocio/criterio-kelly/…` |
| `paginas/planTrading/` | `negocio/bitacora/…` |
| `paginas/suscripcion/` (menos `registro`) | `negocio/suscripcion/…` |
| `paginas/suscripcion/registro/` | `general/autenticacion/paginas/registro/` |
| `paginas/util/{login,recuperar-clave,verificar-correo,componentes,servicios,store}`, `modelos/` (menos `Rol` y `Login`) | `general/autenticacion/…` |
| `paginas/util/{ayuda,acerca-d}/` | `general/informacion/paginas/<nombre>/` |
| `paginas/inicio/` | `general/inicio/paginas/inicio/` |

> Se confirma en el primer HLT con un nuevo `grep` por si el código cambió; cualquier archivo nuevo se asigna con la regla «dónde va cada cosa».

## Reglas de dependencia (se verifican al final)

| Desde | Puede importar | No puede importar |
|-------|----------------|-------------------|
| `compartidos/` (app) | Angular, Ionic y librerías | cualquier dominio |
| `<dominio>/compartido/` | `compartidos/` | otro dominio y los subdominios de su propio dominio |
| `<dominio>/<subdominio>/` | `compartidos/`, `<dominio>/compartido/`, su propio subdominio | archivos internos de otro subdominio u otro dominio, salvo los permitidos abajo |

Dependencias entre subdominios que **existen hoy** y se permiten (quedan documentadas):
- `reportes` (`analisis`, `operativas`, `compartido`), `negocio/bitacora` y `negocio/criterio-kelly` → `configuracion/cuentas` (`cuentaStore`, `Cuentas.modelo` y el componente `seleccionar-cuentas`; `configuracion` los usa además `operativa-kelly`).
- `general/autenticacion` (registro) → `negocio/suscripcion` (plan reservado y planes).
- `general/autenticacion` (login) e `general/inicio` → `negocio/suscripcion` (`SuscripcionStore`, `PlanesStore`, `aviso-plan`, `aviso-bloqueo`, `plan-vigente.store`).
- Casi todos los dominios (`configuracion`, `reportes`, `negocio/criterio-kelly`, `general/inicio`) → `negocio/suscripcion`: `plan-vigente.store`, `permisos-plan.config` y `PlanVigente.modelo` (límites y avisos del plan).
- `administracion/datos-pago` → `negocio/suscripcion` (`textos-pago` y `EstadoPago.modelo`).
- `negocio/bitacora` → `compartidos/store` (`dbkelly-*`), `configuracion` → `compartidos/store` (`dbPIN-*`, `dbkelly-*`).
- **Excepciones de `compartidos/` hacia un dominio** (no se cambia código): `plan.guard` y `alerta-limite-plan` usan `negocio/suscripcion` (`plan-vigente.store`, `permisos-plan.config`); si el inventario de HLT-41 encuentra otras, se anotan igual.

Cualquier otra dependencia cruzada que aparezca en el inventario se decide en el HLT; no se corrige cambiando código en esta historia.

## Qué no cambia (sin pérdida de funcionalidad)

- Código, lógica, validaciones, textos, selectores, nombres de clases y de archivos.
- Las **URLs** de todas las pantallas y sus guardas; `app.routes.ts` solo cambia las rutas de los `import()` perezosos.
- Los stores, los servicios HTTP y la persistencia local dual (SQLite/IndexedDB): la elección web o nativa sigue en el llamador.
- Las claves de `localStorage`, los endpoints y el menú (`assets/datos/menu.json`).
- Los resultados de `ng lint`, `ng build` y `ng test`.

## Criterios de aceptación

| # | Criterio |
|---|----------|
| CA-1 | Todo el código vive en `compartidos/` o en `<dominio>/<subdominio>/…` según la tabla; no queda `src/app/paginas/` |
| CA-2 | Cada subdominio tiene solo las carpetas que le corresponden, con los nombres `componentes`, `modelos`, `paginas`, `servicios`, `store`; sin carpetas vacías |
| CA-3 | Cada dominio tiene `compartido/` solo si hay piezas usadas por varios de sus subdominios |
| CA-4 | Ningún archivo cambia salvo sus rutas de importación y las rutas de archivos movidos; `git diff` por archivo movido solo muestra esas líneas |
| CA-5 | Las URLs y guardas de `app.routes.ts` son idénticas; la clasificación de `permisos-plan.config.ts` y la spec R-04 no cambian de contenido |
| CA-6 | Los specs se movieron con su archivo; el recuento de `ng test` es igual al anterior (mismos fallos conocidos: AppComponent, «primer pago», «plan pendiente normal», PV-19) |
| CA-7 | `npx tsc --noEmit` (app y spec), `ng lint`, `ng build` (desarrollo y producción) pasan; el bundle inicial no cambia de tamaño |
| CA-8 | Sin importaciones circulares nuevas ni importaciones que violen las reglas de dependencia (verificado con grep, o con la regla `no-restricted-imports` de ESLint si se acepta DN-03) |
| CA-9 | `CLAUDE.md` y `README.md` de la app describen la estructura, la regla «dónde va cada cosa» y la tabla de dominios, con una plantilla «nuevo subdominio» |
| CA-10 | `.claude/agents/desarrollador-ionic.md` (y las guías que citen rutas viejas) apuntan a las rutas nuevas |
| CA-11 | La app arranca y recorre todas sus pantallas igual (prueba manual M-01), sin errores nuevos en la consola |

## Fuera de alcance (cada punto, una historia aparte)

- **Renombrar** archivos, carpetas o clases (kebab-case en stores y modelos, `planTrading` → otro nombre, `acerca-d`…). Se conservan para no tocar más líneas que las de importación.
- **Alias de importación** (`@compartidos/*`, `@dominios/*`) y archivos `index.ts` de API pública por subdominio.
- **Dividir las páginas grandes** (`bitacora`, `cuentas`, `registro`) en componentes presentacionales.
- Cambiar la lógica de los stores o mover lógica de las páginas a los stores.
- Cambiar URLs, el menú o el contrato con los backends; las páginas de administración por rol (rutas comentadas); cualquier cambio en `rest_*`.

## Decisiones por confirmar

| # | Tema | Recomendación |
|---|------|---------------|
| DN-01 | Agrupar `criterio-kelly`, `bitacora` y `suscripcion` bajo `negocio`, y `autenticacion`, `inicio`, `informacion` bajo `general` | Aceptar. Alternativa: `suscripcion` como dominio propio y `criterio-kelly`/`bitacora` bajo `trading` |
| DN-02 | La página `registro` va a `general/autenticacion` (crea una persona) y usa el plan reservado de `negocio/suscripcion` | Aceptar |
| DN-03 | Regla ESLint `no-restricted-imports` para hacer cumplir las dependencias | Opcional: es configuración, no código de la app; si se acepta, se activa en aviso durante la migración y en error al cerrar |
| DN-04 | `plan.guard` y `alerta-limite-plan` (en `compartidos/`) dependen de `negocio/suscripcion` (plan vigente y permisos) | Dejarlos y documentar la excepción |
| DN-05 | `plan-vigente.store`, `permisos-plan.config` y `PlanVigente.modelo` los usan casi todos los dominios y `compartidos/` | Dejarlos en `negocio/suscripcion` como dependencia permitida de toda la app. Alternativa: subirlos a `compartidos/` (cambia la intención del subdominio `suscripcion`) |
| DN-06 | `cuentaStore`/`Cuentas.modelo` los usan 4 dominios | Dejarlos en `configuracion/cuentas` como dependencia permitida (como pidió la HU original). Alternativa: subirlos a `compartidos/` |

## Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Rutas de importación rotas (cientos) | Alta | Oleadas pequeñas; compilar al final de cada una; usar el compilador como lista de pendientes; script con comprobación, nunca a mano |
| Mezclar movimiento y cambios de código | Media | Prohibido: un archivo movido solo cambia sus importaciones |
| Una importación rota que solo falla en ejecución (`loadComponent` perezoso) | Media | `ng build` compila todos los chunks perezosos; recorrido manual de todas las rutas |
| Un `providedIn: 'root'` perdido o duplicado al mover stores | Media | No cambiar decoradores; los specs de stores deben seguir en verde |
| `angular.json`, `tsconfig.*.json` o specs con rutas a archivos movidos | Media | Revisarlos en cada oleada; las rutas de `assets/` no se mueven |
| Finales de línea mixtos (CRLF/LF) al reescribir importaciones | Baja | Conservar los de cada archivo |
| Pérdida del historial de git | Baja | Mover sin editar contenido en el mismo paso; el usuario confirma por oleada |
| Conflictos con trabajo en curso | Media | Migrar con el árbol limpio (lo anterior ya confirmado) |

## Plan de migración sugerido (HLT a crear al aprobar)

Cada oleada deja la app compilando y funcionando, y termina con `tsc`, lint, `ng test` y build en verde.

| HLT | Contenido | Riesgo |
|-----|-----------|--------|
| 1 | Inventario real y línea base: `find` por carpeta, tabla definitiva origen → destino, dependencias cruzadas (grep), `ng test`, `ng build` y tamaño. Sin mover nada | Bajo |
| 2 | `compartidos/` a nivel app (`componentes`, `seguridad`…) | Medio: muchos imports |
| 3 | Dominio `configuracion` (`cuentas`, `perfil`, `bloqueo-pin`, `operativa-kelly`) | Medio: cuentas es el más usado |
| 4 | Dominios `administracion` y `reportes` | Bajo |
| 5 | Dominio `negocio` (`criterio-kelly`, `bitacora`, `suscripcion`) | Medio |
| 6 | Dominio `general` (`autenticacion`, `inicio`, `informacion`) y eliminación de `paginas/` | Medio: toca la sesión |
| 7 | Cierre: dependencias, `ng build` producción, documentación, agentes y prueba manual M-01 | Bajo |

## Definición de terminado

- [ ] HLT de esta historia aprobados.
- [ ] Criterios CA-1 a CA-11 verificados con salida real: árbol de carpetas, greps de dependencias, `tsc`, `ng lint`, `ng test`, `ng build` en desarrollo y producción.
- [ ] Recorrido manual de todas las rutas: login, recuperación, verificación de correo, registro, inicio, bitácora (abrir, seguimiento, cierre), criterio Kelly, reportes y exportaciones, cuentas, perfil, PIN, planes, comprobante, validar pagos, datos de pago, ayuda y acerca de. Sin errores en la consola.
- [ ] Bundle inicial sin cambio de tamaño.
- [ ] Documentación y agente `desarrollador-ionic` actualizados.

## Anexo A · Destino de cada archivo `.ts` de `src/app` (156 archivos)

Cada archivo se lleva consigo sus `.html`, `.scss` y `.spec.ts`. Generado con el uso real de cada pieza (`grep` de importaciones del 2026-11-15) y la regla «dónde va cada cosa».

#### `src/app (raíz)` (2 archivos)

| Archivo actual | Destino | Motivo |
|---|---|---|
| `app.component.ts` | `app.component.ts` | Se queda en la raíz |
| `app.routes.ts` | `app.routes.ts` | Se queda en la raíz |

#### `compartidos` (41 archivos)

| Archivo actual | Destino | Motivo |
|---|---|---|
| `compartidos/IonicComponentes.ts` | `compartidos/IonicComponentes.ts` | Se queda |
| `compartidos/alerta-ck/alerta-ck.component.ts` | `compartidos/componentes/alerta-ck/alerta-ck.component.ts` | Pieza de varios dominios |
| `compartidos/alerta-limite-plan/alerta-limite-plan.component.ts` | `compartidos/componentes/alerta-limite-plan/alerta-limite-plan.component.ts` | Pieza de varios dominios |
| `compartidos/aviso-sin-conexion/aviso-sin-conexion.component.ts` | `compartidos/componentes/aviso-sin-conexion/aviso-sin-conexion.component.ts` | Pieza de varios dominios |
| `compartidos/encabezado/encabezado.component.ts` | `compartidos/componentes/encabezado/encabezado.component.ts` | Pieza de varios dominios |
| `compartidos/interceptors/autenticacion.interceptor.ts` | `compartidos/seguridad/interceptores/autenticacion.interceptor.ts` | Seguridad HTTP de toda la app |
| `compartidos/interceptors/error.interceptor.ts` | `compartidos/seguridad/interceptores/error.interceptor.ts` | Seguridad HTTP de toda la app |
| `compartidos/interceptors/sesion-http.ts` | `compartidos/seguridad/interceptores/sesion-http.ts` | Seguridad HTTP de toda la app |
| `compartidos/modelos/error-api.ts` | `compartidos/modelos/error-api.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/modelos/menu.ts` | `compartidos/modelos/menu.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/modelos/pin-bloqueo.modelo.ts` | `compartidos/modelos/pin-bloqueo.modelo.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/modelos/sesion.modelo.ts` | `compartidos/modelos/sesion.modelo.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/seguridades/GuardAutenticacion.ts` | `compartidos/seguridad/guardas/GuardAutenticacion.ts` | Guarda de rutas de toda la app |
| `compartidos/seguridades/GuardRoles.ts` | `compartidos/seguridad/guardas/GuardRoles.ts` | Guarda de rutas de toda la app |
| `compartidos/seguridades/NombreUsuarioSesion.ts` | `compartidos/seguridad/NombreUsuarioSesion.ts` | Sesión y seguridad de toda la app |
| `compartidos/seguridades/ServicioAutenticacion.ts` | `compartidos/seguridad/ServicioAutenticacion.ts` | Sesión y seguridad de toda la app |
| `compartidos/seguridades/ServicioInactividad.ts` | `compartidos/seguridad/ServicioInactividad.ts` | Sesión y seguridad de toda la app |
| `compartidos/seguridades/hash-pin.ts` | `compartidos/seguridad/hash-pin.ts` | Solo lo usa `pin-bloqueo.feature` (compartidos) |
| `compartidos/seguridades/plan.guard.ts` | `compartidos/seguridad/guardas/plan.guard.ts` | Guarda de rutas de toda la app |
| `compartidos/seleccionar-cuentas/seleccionar-cuentas.component.ts` | `configuracion/cuentas/componentes/seleccionar-cuentas/seleccionar-cuentas.component.ts` | Selector de cuentas: pertenece al subdominio `cuentas` (lo usan `analisis` y `operativas`) |
| `compartidos/servicios/acciones-externas.service.ts` | `negocio/suscripcion/servicios/acciones-externas.service.ts` | Solo lo usa `comprobante` (regla: un solo subdominio) |
| `compartidos/servicios/almacen-seguro.service.ts` | `compartidos/servicios/almacen-seguro.service.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/servicios/coordinador-pestanas.service.ts` | `compartidos/servicios/coordinador-pestanas.service.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/servicios/data-base-web.service.ts` | `compartidos/servicios/data-base-web.service.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/servicios/data-base.service.ts` | `compartidos/servicios/data-base.service.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/servicios/limpieza-cliente.service.ts` | `compartidos/servicios/limpieza-cliente.service.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/servicios/manejo-imagenes.service.ts` | `compartidos/servicios/manejo-imagenes.service.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/servicios/menu.service.ts` | `compartidos/servicios/menu.service.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/servicios/plataforma.ts` | `compartidos/servicios/plataforma.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/servicios/sesion.service.ts` | `compartidos/servicios/sesion.service.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/servicios/utilitarios.service.ts` | `compartidos/servicios/utilitarios.service.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/store/dbPIN-app.store.ts` | `compartidos/store/dbPIN-app.store.ts` | Se queda: lo usan `configuracion` (bloqueo, cambiar-pin) y `general/autenticacion` (login) |
| `compartidos/store/dbPIN-web.store.ts` | `compartidos/store/dbPIN-web.store.ts` | Se queda: lo usan `configuracion` (bloqueo, cambiar-pin) y `general/autenticacion` (login) |
| `compartidos/store/dbkelly-app.store.ts` | `compartidos/store/dbkelly-app.store.ts` | Se queda: lo usan `configuracion` (cuentas, operativa-kelly) y `negocio/bitacora` (bitacora-fin) |
| `compartidos/store/dbkelly-web.store.ts` | `compartidos/store/dbkelly-web.store.ts` | Se queda: lo usan `configuracion` (cuentas, operativa-kelly) y `negocio/bitacora` (bitacora-fin) |
| `compartidos/store/estado-aplicacion.store.ts` | `compartidos/store/estado-aplicacion.store.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/store/menu.store.ts` | `compartidos/store/menu.store.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/store/pin-bloqueo.feature.ts` | `compartidos/store/pin-bloqueo.feature.ts` | Se queda: lo usan los stores `dbPIN-*` (compartidos) |
| `compartidos/store/sesion.store.ts` | `compartidos/store/sesion.store.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |
| `compartidos/textos-alertas.ts` | `compartidos/textos-alertas.ts` | Se queda |
| `compartidos/validadores/politica-clave.validator.ts` | `compartidos/validadores/politica-clave.validator.ts` | Se queda: lo usan varios dominios (PIN: `configuracion` y `general`; divisor: `configuracion` y `negocio`) |

#### `paginas/administracion` (18 archivos)

| Archivo actual | Destino | Motivo |
|---|---|---|
| `paginas/administracion/componentes/detalle-pago/detalle-pago.component.ts` | `administracion/pagos/componentes/detalle-pago/detalle-pago.component.ts` | Subdominio `pagos` |
| `paginas/administracion/componentes/lista-pagos-pendientes/lista-pagos-pendientes.component.ts` | `administracion/pagos/componentes/lista-pagos-pendientes/lista-pagos-pendientes.component.ts` | Subdominio `pagos` |
| `paginas/administracion/configuracion/textos-validacion.ts` | `administracion/pagos/configuracion/textos-validacion.ts` | Subdominio `pagos` |
| `paginas/administracion/datos-pago/componentes/formulario-banco/formulario-banco.component.ts` | `administracion/datos-pago/componentes/formulario-banco/formulario-banco.component.ts` | Subdominio `datos-pago` |
| `paginas/administracion/datos-pago/componentes/formulario-paypal/formulario-paypal.component.ts` | `administracion/datos-pago/componentes/formulario-paypal/formulario-paypal.component.ts` | Subdominio `datos-pago` |
| `paginas/administracion/datos-pago/componentes/formulario-red/formulario-red.component.ts` | `administracion/datos-pago/componentes/formulario-red/formulario-red.component.ts` | Subdominio `datos-pago` |
| `paginas/administracion/datos-pago/componentes/lista-redes/lista-redes.component.ts` | `administracion/datos-pago/componentes/lista-redes/lista-redes.component.ts` | Subdominio `datos-pago` |
| `paginas/administracion/datos-pago/componentes/subida-qr/subida-qr.component.ts` | `administracion/datos-pago/componentes/subida-qr/subida-qr.component.ts` | Subdominio `datos-pago` |
| `paginas/administracion/datos-pago/configuracion/textos-datos-pago.ts` | `administracion/datos-pago/configuracion/textos-datos-pago.ts` | Subdominio `datos-pago` |
| `paginas/administracion/datos-pago/configuracion/validadores-pago.ts` | `administracion/datos-pago/configuracion/validadores-pago.ts` | Subdominio `datos-pago` |
| `paginas/administracion/datos-pago/datos-pago-admin.page.ts` | `administracion/datos-pago/paginas/datos-pago/datos-pago-admin.page.ts` | Página |
| `paginas/administracion/datos-pago/modelos/DatosPagoAdmin.modelo.ts` | `administracion/datos-pago/modelos/DatosPagoAdmin.modelo.ts` | Subdominio `datos-pago` |
| `paginas/administracion/datos-pago/servicios/administracion-datos-pago.service.ts` | `administracion/datos-pago/servicios/administracion-datos-pago.service.ts` | Subdominio `datos-pago` |
| `paginas/administracion/datos-pago/store/datos-pago-admin.store.ts` | `administracion/datos-pago/store/datos-pago-admin.store.ts` | Subdominio `datos-pago` |
| `paginas/administracion/modelos/PagoPendiente.modelo.ts` | `administracion/pagos/modelos/PagoPendiente.modelo.ts` | Subdominio `pagos` |
| `paginas/administracion/servicios/administracion-pagos.service.ts` | `administracion/pagos/servicios/administracion-pagos.service.ts` | Subdominio `pagos` |
| `paginas/administracion/store/validacion-pagos.store.ts` | `administracion/pagos/store/validacion-pagos.store.ts` | Subdominio `pagos` |
| `paginas/administracion/validar-pagos/validar-pagos.page.ts` | `administracion/pagos/paginas/validar-pagos/validar-pagos.page.ts` | Página |

#### `paginas/configuracion` (15 archivos)

| Archivo actual | Destino | Motivo |
|---|---|---|
| `paginas/configuracion/bloqueo/bloqueo.page.ts` | `configuracion/bloqueo-pin/paginas/bloqueo/bloqueo.page.ts` | Página de PIN |
| `paginas/configuracion/cambiar-pin/cambiar-pin.page.ts` | `configuracion/bloqueo-pin/paginas/cambiar-pin/cambiar-pin.page.ts` | Página de PIN |
| `paginas/configuracion/componentes/formulario-cambio-clave/formulario-cambio-clave.component.ts` | `configuracion/perfil/componentes/formulario-cambio-clave/formulario-cambio-clave.component.ts` | Solo lo usa `perfil` |
| `paginas/configuracion/componentes/modal-pin/modal-pin.component.ts` | `configuracion/bloqueo-pin/componentes/modal-pin/modal-pin.component.ts` | Modal del PIN |
| `paginas/configuracion/cuentas/cuentas.page.ts` | `configuracion/cuentas/paginas/cuentas/cuentas.page.ts` | Página |
| `paginas/configuracion/modelos/Capital.modelo.ts` | `configuracion/cuentas/modelos/Capital.modelo.ts` | Modelo de cuentas |
| `paginas/configuracion/modelos/Cuentas.modelo.ts` | `configuracion/cuentas/modelos/Cuentas.modelo.ts` | Modelo de cuentas |
| `paginas/configuracion/modelos/Perfil.modelo.ts` | `configuracion/perfil/modelos/Perfil.modelo.ts` | Modelo de perfil |
| `paginas/configuracion/operativa-kelly/operativa-kelly.page.ts` | `configuracion/operativa-kelly/paginas/operativa-kelly/operativa-kelly.page.ts` | Página |
| `paginas/configuracion/perfil/perfil.page.ts` | `configuracion/perfil/paginas/perfil/perfil.page.ts` | Página |
| `paginas/configuracion/servicios/cuentas.service.ts` | `configuracion/cuentas/servicios/cuentas.service.ts` | Servicio del subdominio |
| `paginas/configuracion/servicios/perfil.service.ts` | `configuracion/perfil/servicios/perfil.service.ts` | Servicio del subdominio |
| `paginas/configuracion/store/cuentaStore.ts` | `configuracion/cuentas/store/cuentaStore.ts` | Store de cuentas (la usan otros dominios: dependencia permitida) |
| `paginas/configuracion/store/perfilStore.ts` | `configuracion/perfil/store/perfilStore.ts` | Store de perfil |
| `paginas/configuracion/store/pin-formulario.store.ts` | `configuracion/bloqueo-pin/store/pin-formulario.store.ts` | Store del PIN |

#### `paginas/criterioKelly` (7 archivos)

| Archivo actual | Destino | Motivo |
|---|---|---|
| `paginas/criterioKelly/modelos/CriterioKelly.modelo.ts` | `negocio/criterio-kelly/modelos/CriterioKelly.modelo.ts` | Subdominio `criterio-kelly` |
| `paginas/criterioKelly/modelos/Resultados.modelo.ts` | `negocio/criterio-kelly/modelos/Resultados.modelo.ts` | Subdominio `criterio-kelly` |
| `paginas/criterioKelly/mostrar-criterio-kelly/mostrar-criterio-kelly.page.ts` | `negocio/criterio-kelly/paginas/mostrar-criterio-kelly/mostrar-criterio-kelly.page.ts` | Página |
| `paginas/criterioKelly/servicios/criterio-kelly.service.ts` | `negocio/criterio-kelly/servicios/criterio-kelly.service.ts` | Subdominio `criterio-kelly` |
| `paginas/criterioKelly/servicios/resultados.service.ts` | `negocio/criterio-kelly/servicios/resultados.service.ts` | Subdominio `criterio-kelly` |
| `paginas/criterioKelly/store/criterioKellyStore.ts` | `negocio/criterio-kelly/store/criterioKellyStore.ts` | Subdominio `criterio-kelly` |
| `paginas/criterioKelly/store/resultadosStore.ts` | `negocio/criterio-kelly/store/resultadosStore.ts` | Subdominio `criterio-kelly` |

#### `paginas/inicio` (1 archivos)

| Archivo actual | Destino | Motivo |
|---|---|---|
| `paginas/inicio/inicio.page.ts` | `general/inicio/paginas/inicio/inicio.page.ts` | Página |

#### `paginas/planTrading` (12 archivos)

| Archivo actual | Destino | Motivo |
|---|---|---|
| `paginas/planTrading/bitacora-fin/bitacora-fin.page.ts` | `negocio/bitacora/paginas/bitacora-fin/bitacora-fin.page.ts` | Página |
| `paginas/planTrading/bitacora-seguimiento/bitacora-seguimiento.page.ts` | `negocio/bitacora/paginas/bitacora-seguimiento/bitacora-seguimiento.page.ts` | Página |
| `paginas/planTrading/bitacora/bitacora.page.ts` | `negocio/bitacora/paginas/bitacora/bitacora.page.ts` | Página |
| `paginas/planTrading/componentes/modal-busca-divisa/modal-busca-divisa.component.ts` | `negocio/bitacora/componentes/modal-busca-divisa/modal-busca-divisa.component.ts` | Subdominio `bitacora` |
| `paginas/planTrading/modelos/Bitacora.modelo.ts` | `negocio/bitacora/modelos/Bitacora.modelo.ts` | Subdominio `bitacora` |
| `paginas/planTrading/modelos/Comentario.modelo.ts` | `negocio/bitacora/modelos/Comentario.modelo.ts` | Subdominio `bitacora` |
| `paginas/planTrading/modelos/Divisas.modelo.ts` | `negocio/bitacora/modelos/Divisas.modelo.ts` | Subdominio `bitacora` |
| `paginas/planTrading/modelos/listaDivisas.ts` | `negocio/bitacora/modelos/listaDivisas.ts` | Subdominio `bitacora` |
| `paginas/planTrading/servicios/bitacora.service.ts` | `negocio/bitacora/servicios/bitacora.service.ts` | Subdominio `bitacora` |
| `paginas/planTrading/servicios/comentarios.service.ts` | `negocio/bitacora/servicios/comentarios.service.ts` | Subdominio `bitacora` |
| `paginas/planTrading/store/bitacoraStore.ts` | `negocio/bitacora/store/bitacoraStore.ts` | Subdominio `bitacora` |
| `paginas/planTrading/store/comentariosStore.ts` | `negocio/bitacora/store/comentariosStore.ts` | Subdominio `bitacora` |

#### `paginas/reportes` (8 archivos)

| Archivo actual | Destino | Motivo |
|---|---|---|
| `paginas/reportes/analisis/analisis.page.ts` | `reportes/analisis/paginas/analisis/analisis.page.ts` | Página |
| `paginas/reportes/componentes/filtro-fechas/filtro-fechas.component.ts` | `reportes/analisis/componentes/filtro-fechas/filtro-fechas.component.ts` | Solo lo usa `analisis` |
| `paginas/reportes/componentes/grafico-estadistico/grafico-estadistico.component.ts` | `reportes/operativas/componentes/grafico-estadistico/grafico-estadistico.component.ts` | Solo lo usa `operativas` |
| `paginas/reportes/modelos/DetalleOperacion.modelo.ts` | `reportes/compartido/modelos/DetalleOperacion.modelo.ts` | Lo usan `analisis` y `operativas` (vía el store) |
| `paginas/reportes/operativas/operativas.page.ts` | `reportes/operativas/paginas/operativas/operativas.page.ts` | Página |
| `paginas/reportes/servicios/exportarExcel.service.ts` | `reportes/analisis/servicios/exportarExcel.service.ts` | Solo lo usa `analisis` |
| `paginas/reportes/servicios/reportes.service.ts` | `reportes/compartido/servicios/reportes.service.ts` | Lo usan `analisis` y `operativas` (vía el store) |
| `paginas/reportes/store/reportesStore.ts` | `reportes/compartido/store/reportesStore.ts` | Lo usan `analisis` y `operativas` (vía el store) |

#### `paginas/suscripcion` (32 archivos)

| Archivo actual | Destino | Motivo |
|---|---|---|
| `paginas/suscripcion/aviso-bloqueo/aviso-bloqueo.component.ts` | `negocio/suscripcion/componentes/aviso-bloqueo/aviso-bloqueo.component.ts` | Componente (lo muestra `general/inicio`) |
| `paginas/suscripcion/aviso-plan/aviso-plan.component.ts` | `negocio/suscripcion/componentes/aviso-plan/aviso-plan.component.ts` | Componente (lo muestra `general/inicio`) |
| `paginas/suscripcion/componentes/estado-pago/estado-pago.component.ts` | `negocio/suscripcion/componentes/estado-pago/estado-pago.component.ts` | Componente del recorrido de pago |
| `paginas/suscripcion/componentes/formulario-comprobante/formulario-comprobante.component.ts` | `negocio/suscripcion/componentes/formulario-comprobante/formulario-comprobante.component.ts` | Componente del recorrido de pago |
| `paginas/suscripcion/componentes/indicador-pasos-pago/indicador-pasos-pago.component.ts` | `negocio/suscripcion/componentes/indicador-pasos-pago/indicador-pasos-pago.component.ts` | Componente del recorrido de pago |
| `paginas/suscripcion/componentes/instrucciones-pago/instrucciones-pago.component.ts` | `negocio/suscripcion/componentes/instrucciones-pago/instrucciones-pago.component.ts` | Componente del recorrido de pago |
| `paginas/suscripcion/componentes/selector-metodo-pago/selector-metodo-pago.component.ts` | `negocio/suscripcion/componentes/selector-metodo-pago/selector-metodo-pago.component.ts` | Componente del recorrido de pago |
| `paginas/suscripcion/comprobante/comprobante.page.ts` | `negocio/suscripcion/paginas/comprobante/comprobante.page.ts` | Página |
| `paginas/suscripcion/comprobante/validacion-imagen.ts` | `negocio/suscripcion/paginas/comprobante/validacion-imagen.ts` | Validación propia de la página |
| `paginas/suscripcion/configuracion/permisos-plan.config.ts` | `negocio/suscripcion/configuracion/permisos-plan.config.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/configuracion/textos-comprobante.ts` | `negocio/suscripcion/configuracion/textos-comprobante.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/configuracion/textos-pago.ts` | `negocio/suscripcion/configuracion/textos-pago.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/modelos/DatosPago.modelo.ts` | `negocio/suscripcion/modelos/DatosPago.modelo.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/modelos/EstadoPago.modelo.ts` | `negocio/suscripcion/modelos/EstadoPago.modelo.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/modelos/PasoPago.modelo.ts` | `negocio/suscripcion/modelos/PasoPago.modelo.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/modelos/PlanVigente.modelo.ts` | `negocio/suscripcion/modelos/PlanVigente.modelo.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/modelos/Planes.modelo.ts` | `negocio/suscripcion/modelos/Planes.modelo.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/modelos/Suscripcion.modelo.ts` | `negocio/suscripcion/modelos/Suscripcion.modelo.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/planes/planes.page.ts` | `negocio/suscripcion/paginas/planes/planes.page.ts` | Página |
| `paginas/suscripcion/registro/registro.page.ts` | `general/autenticacion/paginas/registro/registro.page.ts` | Página (crea una persona y usuario) |
| `paginas/suscripcion/servicios/datos-pago.service.ts` | `negocio/suscripcion/servicios/datos-pago.service.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/servicios/pagos.service.ts` | `negocio/suscripcion/servicios/pagos.service.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/servicios/plan-avisado.service.ts` | `negocio/suscripcion/servicios/plan-avisado.service.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/servicios/plan-reservado.service.ts` | `negocio/suscripcion/servicios/plan-reservado.service.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/servicios/planes.service.ts` | `negocio/suscripcion/servicios/planes.service.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/servicios/solicitud-banco.service.ts` | `negocio/suscripcion/servicios/solicitud-banco.service.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/servicios/suscripcion.service.ts` | `negocio/suscripcion/servicios/suscripcion.service.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/store/PlanesStore.ts` | `negocio/suscripcion/store/PlanesStore.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/store/SuscripcionStore.ts` | `negocio/suscripcion/store/SuscripcionStore.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/store/comprobante.store.ts` | `negocio/suscripcion/store/comprobante.store.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/store/metodo-pago.store.ts` | `negocio/suscripcion/store/metodo-pago.store.ts` | Subdominio `suscripcion` |
| `paginas/suscripcion/store/plan-vigente.store.ts` | `negocio/suscripcion/store/plan-vigente.store.ts` | Subdominio `suscripcion` |

#### `paginas/util` (20 archivos)

| Archivo actual | Destino | Motivo |
|---|---|---|
| `paginas/util/acerca-d/acerca-d.page.ts` | `general/informacion/paginas/acerca-d/acerca-d.page.ts` | Página informativa |
| `paginas/util/ayuda/ayuda.page.ts` | `general/informacion/paginas/ayuda/ayuda.page.ts` | Página informativa |
| `paginas/util/componentes/formulario-restablecer-clave/formulario-restablecer-clave.component.ts` | `general/autenticacion/componentes/formulario-restablecer-clave/formulario-restablecer-clave.component.ts` | Formulario de acceso |
| `paginas/util/componentes/formulario-solicitar-codigo/formulario-solicitar-codigo.component.ts` | `general/autenticacion/componentes/formulario-solicitar-codigo/formulario-solicitar-codigo.component.ts` | Formulario de acceso |
| `paginas/util/componentes/formulario-verificar-correo/formulario-verificar-correo.component.ts` | `general/autenticacion/componentes/formulario-verificar-correo/formulario-verificar-correo.component.ts` | Formulario de acceso |
| `paginas/util/login/login.page.ts` | `general/autenticacion/paginas/login/login.page.ts` | Página de acceso |
| `paginas/util/modelos/Login.modelo.ts` | `compartidos/modelos/Login.modelo.ts` | Lo usa `compartidos/` (sesión): se sube para evitar la dependencia invertida |
| `paginas/util/modelos/Persona.modelo.ts` | `general/autenticacion/modelos/Persona.modelo.ts` | Modelo del subdominio |
| `paginas/util/modelos/RecuperacionClave.modelo.ts` | `general/autenticacion/modelos/RecuperacionClave.modelo.ts` | Modelo del subdominio |
| `paginas/util/modelos/Rol.modelo.ts` | `compartidos/modelos/Rol.modelo.ts` | Lo usa `compartidos/` (sesión): se sube para evitar la dependencia invertida |
| `paginas/util/modelos/VerificacionCorreo.modelo.ts` | `general/autenticacion/modelos/VerificacionCorreo.modelo.ts` | Modelo del subdominio |
| `paginas/util/recuperar-clave/recuperar-clave.page.ts` | `general/autenticacion/paginas/recuperar-clave/recuperar-clave.page.ts` | Página de acceso |
| `paginas/util/servicios/persona.service.ts` | `general/autenticacion/servicios/persona.service.ts` | Subdominio `autenticacion` |
| `paginas/util/servicios/recuperacion-clave.service.ts` | `general/autenticacion/servicios/recuperacion-clave.service.ts` | Subdominio `autenticacion` |
| `paginas/util/servicios/verificacion-correo.service.ts` | `general/autenticacion/servicios/verificacion-correo.service.ts` | Subdominio `autenticacion` |
| `paginas/util/store/login.store.ts` | `general/autenticacion/store/login.store.ts` | Subdominio `autenticacion` |
| `paginas/util/store/personaStore.ts` | `general/autenticacion/store/personaStore.ts` | Subdominio `autenticacion` |
| `paginas/util/store/recuperacion-clave.store.ts` | `general/autenticacion/store/recuperacion-clave.store.ts` | Subdominio `autenticacion` |
| `paginas/util/store/verificacion-correo.store.ts` | `general/autenticacion/store/verificacion-correo.store.ts` | Subdominio `autenticacion` |
| `paginas/util/verificar-correo/verificar-correo.page.ts` | `general/autenticacion/paginas/verificar-correo/verificar-correo.page.ts` | Página de acceso |

## Anexo B · Árbol final completo (328 archivos de `src/app`)

Incluye cada página, componente, modelo, servicio, store y archivo auxiliar, con sus `.html`, `.scss` y `.spec.ts`. Cada archivo del árbol actual aparece exactamente una vez (verificado: 328 de 328, sin colisiones de ruta).

```
src/app/
├── app.component.html
├── app.component.scss
├── app.component.spec.ts
├── app.component.ts
├── app.routes.ts
```

#### Dominio `compartidos` (64 archivos)

```
compartidos/
├── componentes/
│   ├── alerta-ck/
│   │   ├── alerta-ck.component.html
│   │   ├── alerta-ck.component.scss
│   │   ├── alerta-ck.component.spec.ts
│   │   └── alerta-ck.component.ts
│   ├── alerta-limite-plan/
│   │   ├── alerta-limite-plan.component.html
│   │   ├── alerta-limite-plan.component.spec.ts
│   │   └── alerta-limite-plan.component.ts
│   ├── aviso-sin-conexion/
│   │   ├── aviso-sin-conexion.component.html
│   │   ├── aviso-sin-conexion.component.scss
│   │   └── aviso-sin-conexion.component.ts
│   └── encabezado/
│       ├── encabezado.component.html
│       ├── encabezado.component.scss
│       └── encabezado.component.ts
├── modelos/
│   ├── Login.modelo.ts
│   ├── Rol.modelo.ts
│   ├── error-api.ts
│   ├── menu.ts
│   ├── pin-bloqueo.modelo.ts
│   └── sesion.modelo.ts
├── seguridad/
│   ├── guardas/
│   │   ├── GuardAutenticacion.ts
│   │   ├── GuardRoles.spec.ts
│   │   ├── GuardRoles.ts
│   │   ├── plan.guard.spec.ts
│   │   └── plan.guard.ts
│   ├── interceptores/
│   │   ├── autenticacion.interceptor.spec.ts
│   │   ├── autenticacion.interceptor.ts
│   │   ├── error.interceptor.spec.ts
│   │   ├── error.interceptor.ts
│   │   └── sesion-http.ts
│   ├── NombreUsuarioSesion.ts
│   ├── ServicioAutenticacion.ts
│   ├── ServicioInactividad.ts
│   ├── hash-pin.spec.ts
│   └── hash-pin.ts
├── servicios/
│   ├── almacen-seguro.service.spec.ts
│   ├── almacen-seguro.service.ts
│   ├── coordinador-pestanas.service.spec.ts
│   ├── coordinador-pestanas.service.ts
│   ├── data-base-web.service.ts
│   ├── data-base.service.ts
│   ├── limpieza-cliente.service.spec.ts
│   ├── limpieza-cliente.service.ts
│   ├── manejo-imagenes.service.ts
│   ├── menu.service.ts
│   ├── plataforma.ts
│   ├── sesion.service.ts
│   └── utilitarios.service.ts
├── store/
│   ├── dbPIN-app.store.ts
│   ├── dbPIN-web.store.ts
│   ├── dbkelly-app.store.ts
│   ├── dbkelly-web.store.ts
│   ├── estado-aplicacion.store.spec.ts
│   ├── estado-aplicacion.store.ts
│   ├── menu.store.spec.ts
│   ├── menu.store.ts
│   ├── pin-bloqueo.feature.spec.ts
│   ├── pin-bloqueo.feature.ts
│   ├── sesion.store.spec.ts
│   └── sesion.store.ts
├── validadores/
│   ├── politica-clave.validator.spec.ts
│   └── politica-clave.validator.ts
├── IonicComponentes.ts
├── textos-alertas.spec.ts
└── textos-alertas.ts
```

#### Dominio `configuracion` (40 archivos)

```
configuracion/
├── bloqueo-pin/
│   ├── componentes/
│   │   └── modal-pin/
│   │       ├── modal-pin.component.html
│   │       ├── modal-pin.component.scss
│   │       ├── modal-pin.component.spec.ts
│   │       └── modal-pin.component.ts
│   ├── paginas/
│   │   ├── bloqueo/
│   │   │   ├── bloqueo.page.html
│   │   │   ├── bloqueo.page.scss
│   │   │   ├── bloqueo.page.spec.ts
│   │   │   └── bloqueo.page.ts
│   │   └── cambiar-pin/
│   │       ├── cambiar-pin.page.html
│   │       ├── cambiar-pin.page.scss
│   │       ├── cambiar-pin.page.spec.ts
│   │       └── cambiar-pin.page.ts
│   └── store/
│       ├── pin-formulario.store.spec.ts
│       └── pin-formulario.store.ts
├── cuentas/
│   ├── componentes/
│   │   └── seleccionar-cuentas/
│   │       ├── seleccionar-cuentas.component.html
│   │       ├── seleccionar-cuentas.component.scss
│   │       ├── seleccionar-cuentas.component.spec.ts
│   │       └── seleccionar-cuentas.component.ts
│   ├── modelos/
│   │   ├── Capital.modelo.ts
│   │   └── Cuentas.modelo.ts
│   ├── paginas/
│   │   └── cuentas/
│   │       ├── cuentas.page.html
│   │       ├── cuentas.page.scss
│   │       ├── cuentas.page.spec.ts
│   │       └── cuentas.page.ts
│   ├── servicios/
│   │   └── cuentas.service.ts
│   └── store/
│       └── cuentaStore.ts
├── operativa-kelly/
│   └── paginas/
│       └── operativa-kelly/
│           ├── operativa-kelly.page.html
│           ├── operativa-kelly.page.scss
│           ├── operativa-kelly.page.spec.ts
│           └── operativa-kelly.page.ts
└── perfil/
    ├── componentes/
    │   └── formulario-cambio-clave/
    │       ├── formulario-cambio-clave.component.html
    │       ├── formulario-cambio-clave.component.scss
    │       └── formulario-cambio-clave.component.ts
    ├── modelos/
    │   └── Perfil.modelo.ts
    ├── paginas/
    │   └── perfil/
    │       ├── perfil.page.html
    │       ├── perfil.page.scss
    │       └── perfil.page.ts
    ├── servicios/
    │   └── perfil.service.ts
    └── store/
        ├── perfilStore.spec.ts
        └── perfilStore.ts
```

#### Dominio `administracion` (50 archivos)

```
administracion/
├── datos-pago/
│   ├── componentes/
│   │   ├── formulario-banco/
│   │   │   ├── formulario-banco.component.html
│   │   │   ├── formulario-banco.component.scss
│   │   │   ├── formulario-banco.component.spec.ts
│   │   │   └── formulario-banco.component.ts
│   │   ├── formulario-paypal/
│   │   │   ├── formulario-paypal.component.html
│   │   │   ├── formulario-paypal.component.scss
│   │   │   ├── formulario-paypal.component.spec.ts
│   │   │   └── formulario-paypal.component.ts
│   │   ├── formulario-red/
│   │   │   ├── formulario-red.component.html
│   │   │   ├── formulario-red.component.scss
│   │   │   ├── formulario-red.component.spec.ts
│   │   │   └── formulario-red.component.ts
│   │   ├── lista-redes/
│   │   │   ├── lista-redes.component.html
│   │   │   ├── lista-redes.component.scss
│   │   │   ├── lista-redes.component.spec.ts
│   │   │   └── lista-redes.component.ts
│   │   └── subida-qr/
│   │       ├── subida-qr.component.html
│   │       ├── subida-qr.component.scss
│   │       ├── subida-qr.component.spec.ts
│   │       └── subida-qr.component.ts
│   ├── configuracion/
│   │   ├── textos-datos-pago.ts
│   │   ├── validadores-pago.spec.ts
│   │   └── validadores-pago.ts
│   ├── modelos/
│   │   └── DatosPagoAdmin.modelo.ts
│   ├── paginas/
│   │   └── datos-pago/
│   │       ├── datos-pago-admin.page.html
│   │       ├── datos-pago-admin.page.scss
│   │       ├── datos-pago-admin.page.spec.ts
│   │       └── datos-pago-admin.page.ts
│   ├── servicios/
│   │   ├── administracion-datos-pago.service.spec.ts
│   │   └── administracion-datos-pago.service.ts
│   └── store/
│       ├── datos-pago-admin.store.spec.ts
│       └── datos-pago-admin.store.ts
└── pagos/
    ├── componentes/
    │   ├── detalle-pago/
    │   │   ├── detalle-pago.component.html
    │   │   ├── detalle-pago.component.scss
    │   │   ├── detalle-pago.component.spec.ts
    │   │   └── detalle-pago.component.ts
    │   └── lista-pagos-pendientes/
    │       ├── lista-pagos-pendientes.component.html
    │       ├── lista-pagos-pendientes.component.scss
    │       ├── lista-pagos-pendientes.component.spec.ts
    │       └── lista-pagos-pendientes.component.ts
    ├── configuracion/
    │   └── textos-validacion.ts
    ├── modelos/
    │   └── PagoPendiente.modelo.ts
    ├── paginas/
    │   └── validar-pagos/
    │       ├── validar-pagos.page.html
    │       ├── validar-pagos.page.scss
    │       ├── validar-pagos.page.spec.ts
    │       └── validar-pagos.page.ts
    ├── servicios/
    │   ├── administracion-pagos.service.spec.ts
    │   └── administracion-pagos.service.ts
    └── store/
        ├── validacion-pagos.store.spec.ts
        └── validacion-pagos.store.ts
```

#### Dominio `reportes` (20 archivos)

```
reportes/
├── analisis/
│   ├── componentes/
│   │   └── filtro-fechas/
│   │       ├── filtro-fechas.component.html
│   │       ├── filtro-fechas.component.scss
│   │       ├── filtro-fechas.component.spec.ts
│   │       └── filtro-fechas.component.ts
│   ├── paginas/
│   │   └── analisis/
│   │       ├── analisis.page.html
│   │       ├── analisis.page.scss
│   │       ├── analisis.page.spec.ts
│   │       └── analisis.page.ts
│   └── servicios/
│       └── exportarExcel.service.ts
├── compartido/
│   ├── modelos/
│   │   └── DetalleOperacion.modelo.ts
│   ├── servicios/
│   │   └── reportes.service.ts
│   └── store/
│       └── reportesStore.ts
└── operativas/
    ├── componentes/
    │   └── grafico-estadistico/
    │       ├── grafico-estadistico.component.html
    │       ├── grafico-estadistico.component.scss
    │       ├── grafico-estadistico.component.spec.ts
    │       └── grafico-estadistico.component.ts
    └── paginas/
        └── operativas/
            ├── operativas.page.html
            ├── operativas.page.scss
            ├── operativas.page.spec.ts
            └── operativas.page.ts
```

#### Dominio `negocio` (104 archivos)

```
negocio/
├── bitacora/
│   ├── componentes/
│   │   └── modal-busca-divisa/
│   │       ├── modal-busca-divisa.component.html
│   │       ├── modal-busca-divisa.component.scss
│   │       ├── modal-busca-divisa.component.spec.ts
│   │       └── modal-busca-divisa.component.ts
│   ├── modelos/
│   │   ├── Bitacora.modelo.ts
│   │   ├── Comentario.modelo.ts
│   │   ├── Divisas.modelo.ts
│   │   └── listaDivisas.ts
│   ├── paginas/
│   │   ├── bitacora/
│   │   │   ├── bitacora.page.html
│   │   │   ├── bitacora.page.scss
│   │   │   └── bitacora.page.ts
│   │   ├── bitacora-fin/
│   │   │   ├── bitacora-fin.page.html
│   │   │   ├── bitacora-fin.page.scss
│   │   │   └── bitacora-fin.page.ts
│   │   └── bitacora-seguimiento/
│   │       ├── bitacora-seguimiento.page.html
│   │       ├── bitacora-seguimiento.page.scss
│   │       └── bitacora-seguimiento.page.ts
│   ├── servicios/
│   │   ├── bitacora.service.ts
│   │   └── comentarios.service.ts
│   └── store/
│       ├── bitacoraStore.ts
│       └── comentariosStore.ts
├── criterio-kelly/
│   ├── modelos/
│   │   ├── CriterioKelly.modelo.ts
│   │   └── Resultados.modelo.ts
│   ├── paginas/
│   │   └── mostrar-criterio-kelly/
│   │       ├── mostrar-criterio-kelly.page.html
│   │       ├── mostrar-criterio-kelly.page.scss
│   │       ├── mostrar-criterio-kelly.page.spec.ts
│   │       └── mostrar-criterio-kelly.page.ts
│   ├── servicios/
│   │   ├── criterio-kelly.service.ts
│   │   └── resultados.service.ts
│   └── store/
│       ├── criterioKellyStore.ts
│       └── resultadosStore.ts
└── suscripcion/
    ├── componentes/
    │   ├── aviso-bloqueo/
    │   │   ├── aviso-bloqueo.component.html
    │   │   ├── aviso-bloqueo.component.scss
    │   │   ├── aviso-bloqueo.component.spec.ts
    │   │   └── aviso-bloqueo.component.ts
    │   ├── aviso-plan/
    │   │   ├── aviso-plan.component.html
    │   │   ├── aviso-plan.component.scss
    │   │   ├── aviso-plan.component.spec.ts
    │   │   └── aviso-plan.component.ts
    │   ├── estado-pago/
    │   │   ├── estado-pago.component.html
    │   │   ├── estado-pago.component.scss
    │   │   ├── estado-pago.component.spec.ts
    │   │   └── estado-pago.component.ts
    │   ├── formulario-comprobante/
    │   │   ├── formulario-comprobante.component.html
    │   │   ├── formulario-comprobante.component.scss
    │   │   ├── formulario-comprobante.component.spec.ts
    │   │   └── formulario-comprobante.component.ts
    │   ├── indicador-pasos-pago/
    │   │   ├── indicador-pasos-pago.component.html
    │   │   ├── indicador-pasos-pago.component.scss
    │   │   ├── indicador-pasos-pago.component.spec.ts
    │   │   └── indicador-pasos-pago.component.ts
    │   ├── instrucciones-pago/
    │   │   ├── instrucciones-pago.component.html
    │   │   ├── instrucciones-pago.component.scss
    │   │   ├── instrucciones-pago.component.spec.ts
    │   │   └── instrucciones-pago.component.ts
    │   └── selector-metodo-pago/
    │       ├── selector-metodo-pago.component.html
    │       ├── selector-metodo-pago.component.scss
    │       ├── selector-metodo-pago.component.spec.ts
    │       └── selector-metodo-pago.component.ts
    ├── configuracion/
    │   ├── permisos-plan.config.spec.ts
    │   ├── permisos-plan.config.ts
    │   ├── textos-comprobante.spec.ts
    │   ├── textos-comprobante.ts
    │   ├── textos-pago.spec.ts
    │   └── textos-pago.ts
    ├── modelos/
    │   ├── DatosPago.modelo.ts
    │   ├── EstadoPago.modelo.ts
    │   ├── PasoPago.modelo.ts
    │   ├── PlanVigente.modelo.ts
    │   ├── Planes.modelo.ts
    │   └── Suscripcion.modelo.ts
    ├── paginas/
    │   ├── comprobante/
    │   │   ├── comprobante.page.html
    │   │   ├── comprobante.page.scss
    │   │   ├── comprobante.page.spec.ts
    │   │   ├── comprobante.page.ts
    │   │   ├── validacion-imagen.spec.ts
    │   │   └── validacion-imagen.ts
    │   └── planes/
    │       ├── planes.page.html
    │       ├── planes.page.scss
    │       ├── planes.page.spec.ts
    │       └── planes.page.ts
    ├── servicios/
    │   ├── acciones-externas.service.ts
    │   ├── datos-pago.service.spec.ts
    │   ├── datos-pago.service.ts
    │   ├── pagos.service.spec.ts
    │   ├── pagos.service.ts
    │   ├── plan-avisado.service.spec.ts
    │   ├── plan-avisado.service.ts
    │   ├── plan-reservado.service.spec.ts
    │   ├── plan-reservado.service.ts
    │   ├── planes.service.ts
    │   ├── solicitud-banco.service.ts
    │   ├── suscripcion.service.spec.ts
    │   └── suscripcion.service.ts
    └── store/
        ├── PlanesStore.spec.ts
        ├── PlanesStore.ts
        ├── SuscripcionStore.spec.ts
        ├── SuscripcionStore.ts
        ├── comprobante.store.spec.ts
        ├── comprobante.store.ts
        ├── metodo-pago.store.spec.ts
        ├── metodo-pago.store.ts
        ├── plan-vigente.store.spec.ts
        └── plan-vigente.store.ts
```

#### Dominio `general` (45 archivos)

```
general/
├── autenticacion/
│   ├── componentes/
│   │   ├── formulario-restablecer-clave/
│   │   │   ├── formulario-restablecer-clave.component.html
│   │   │   ├── formulario-restablecer-clave.component.scss
│   │   │   └── formulario-restablecer-clave.component.ts
│   │   ├── formulario-solicitar-codigo/
│   │   │   ├── formulario-solicitar-codigo.component.html
│   │   │   ├── formulario-solicitar-codigo.component.scss
│   │   │   └── formulario-solicitar-codigo.component.ts
│   │   └── formulario-verificar-correo/
│   │       ├── formulario-verificar-correo.component.html
│   │       ├── formulario-verificar-correo.component.scss
│   │       └── formulario-verificar-correo.component.ts
│   ├── modelos/
│   │   ├── Persona.modelo.ts
│   │   ├── RecuperacionClave.modelo.ts
│   │   └── VerificacionCorreo.modelo.ts
│   ├── paginas/
│   │   ├── login/
│   │   │   ├── login.page.html
│   │   │   ├── login.page.scss
│   │   │   ├── login.page.spec.ts
│   │   │   └── login.page.ts
│   │   ├── recuperar-clave/
│   │   │   ├── recuperar-clave.page.html
│   │   │   ├── recuperar-clave.page.scss
│   │   │   └── recuperar-clave.page.ts
│   │   ├── registro/
│   │   │   ├── registro.page.html
│   │   │   ├── registro.page.scss
│   │   │   ├── registro.page.spec.ts
│   │   │   └── registro.page.ts
│   │   └── verificar-correo/
│   │       ├── verificar-correo.page.html
│   │       ├── verificar-correo.page.scss
│   │       └── verificar-correo.page.ts
│   ├── servicios/
│   │   ├── persona.service.ts
│   │   ├── recuperacion-clave.service.ts
│   │   └── verificacion-correo.service.ts
│   └── store/
│       ├── login.store.ts
│       ├── personaStore.ts
│       ├── recuperacion-clave.store.spec.ts
│       ├── recuperacion-clave.store.ts
│       ├── verificacion-correo.store.spec.ts
│       └── verificacion-correo.store.ts
├── informacion/
│   └── paginas/
│       ├── acerca-d/
│       │   ├── acerca-d.page.html
│       │   ├── acerca-d.page.scss
│       │   └── acerca-d.page.ts
│       └── ayuda/
│           ├── ayuda.page.html
│           ├── ayuda.page.scss
│           └── ayuda.page.ts
└── inicio/
    └── paginas/
        └── inicio/
            ├── inicio.page.html
            ├── inicio.page.scss
            ├── inicio.page.spec.ts
            └── inicio.page.ts
```
