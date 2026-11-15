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
| P-07 | **Persistencia local repartida**: los stores pareados web/nativo (`dbPIN-*`, `dbkelly-*`) están en `compartidos/`, aunque cada uno pertenece a un solo dominio | `compartidos/store/db*.store.ts` |

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
│   ├── modelos/          error-api, menu, sesion.modelo, pin-bloqueo.modelo …
│   ├── servicios/        utilitarios, manejo-imagenes, data-base(+web), almacen-seguro, coordinador-pestanas, limpieza-cliente, acciones-externas …
│   ├── store/            sesion, menu, estado-aplicacion
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

**Regla de carpetas.** Un subdominio tiene las cinco carpetas (`componentes`, `modelos`, `paginas`, `servicios`, `store`) **cuando le corresponden**; una carpeta que no tendría archivos **no se crea** (sin `.gitkeep`). Los archivos de configuración pura (`*.config.ts`, textos, constantes) viven en una carpeta auxiliar `configuracion/` del subdominio, como hoy.

**Dónde va cada cosa.**
- Una pieza que usa **un solo subdominio** vive en ese subdominio.
- Una pieza que usan **varios subdominios del mismo dominio** vive en `<dominio>/compartido/`.
- Una pieza que usan **varios dominios** vive en `compartidos/` (nivel app).
- La persistencia local pareada web/nativo (`dbPIN-*`, `dbkelly-*`, `pin-bloqueo.feature`, `hash-pin`) vive en el subdominio dueño (`configuracion/bloqueo-pin`, `configuracion/operativa-kelly`).

## Dominios y subdominios

| Dominio | Subdominios | Origen actual |
|---------|-------------|---------------|
| `configuracion` | `cuentas`, `perfil`, `bloqueo-pin`, `operativa-kelly`, `compartido` | `paginas/configuracion/*` (+ `compartidos/store/dbPIN-*`, `dbkelly-*`, `pin-bloqueo.feature`, `seguridades/hash-pin`, `modelos/pin-bloqueo.modelo`) |
| `administracion` | `pagos`, `datos-pago` | `paginas/administracion/*` |
| `reportes` | `analisis`, `operativas`, `compartido` | `paginas/reportes/*` |
| `negocio` | `criterio-kelly`, `bitacora`, `suscripcion` | `paginas/criterioKelly/*`, `paginas/planTrading/*`, `paginas/suscripcion/*` |
| `general` | `autenticacion`, `inicio`, `informacion` | `paginas/util/*`, `paginas/inicio/*`, `paginas/suscripcion/registro/` |
| `compartidos` (app) | — (carpetas por tipo) | `compartidos/*` |

### Asignación detallada

| Origen actual | Destino |
|---------------|---------|
| `paginas/configuracion/cuentas/`, `modelos/{Cuentas,Capital}.modelo.ts`, `servicios/cuentas.service.ts`, `store/cuentaStore.ts` | `configuracion/cuentas/{paginas,modelos,servicios,store}/` |
| `paginas/configuracion/perfil/`, `componentes/formulario-cambio-clave/`, `modelos/Perfil.modelo.ts`, `servicios/perfil.service.ts`, `store/perfilStore.ts` | `configuracion/perfil/` |
| `paginas/configuracion/{bloqueo,cambiar-pin}/`, `componentes/modal-pin/`, `store/pin-formulario.store.ts` + stores `dbPIN-*`, `pin-bloqueo.feature`, `hash-pin`, `pin-bloqueo.modelo` | `configuracion/bloqueo-pin/` |
| `paginas/configuracion/operativa-kelly/` + stores `dbkelly-*` | `configuracion/operativa-kelly/` |
| `paginas/administracion/{validar-pagos,componentes,servicios,store,modelos,configuracion}` | `administracion/pagos/` |
| `paginas/administracion/datos-pago/` | `administracion/datos-pago/` |
| `paginas/reportes/analisis/` | `reportes/analisis/paginas/` |
| `paginas/reportes/operativas/`, `componentes/grafico-estadistico/` | `reportes/operativas/` |
| `paginas/reportes/componentes/filtro-fechas/`, `modelos/`, `servicios/`, `store/reportesStore.ts` | `reportes/compartido/` (los usan `analisis` y `operativas`) |
| `paginas/criterioKelly/*` | `negocio/criterio-kelly/{paginas,modelos,servicios,store}/` |
| `paginas/planTrading/*` | `negocio/bitacora/` |
| `paginas/suscripcion/*` (menos `registro`) | `negocio/suscripcion/` |
| `paginas/suscripcion/registro/` | `general/autenticacion/paginas/registro/` |
| `paginas/util/{login,recuperar-clave,verificar-correo}`, componentes, modelos, servicios y stores | `general/autenticacion/` |
| `paginas/util/{ayuda,acerca-d}/` | `general/informacion/paginas/` |
| `paginas/inicio/` | `general/inicio/paginas/` |
| `compartidos/{encabezado,aviso-sin-conexion,alerta-ck,alerta-limite-plan,seleccionar-cuentas}/` | `compartidos/componentes/` |
| `compartidos/{interceptors,seguridades}/` (menos `hash-pin`) | `compartidos/seguridad/` |
| `compartidos/{modelos,servicios,store,validadores}/`, `IonicComponentes.ts`, `textos-alertas.ts` | `compartidos/` con los mismos nombres de carpeta (menos lo que pasa a un subdominio dueño) |

> Las listas se confirman en el primer HLT con el inventario real; cualquier archivo no listado se asigna con la regla «dónde va cada cosa».

## Reglas de dependencia (se verifican al final)

| Desde | Puede importar | No puede importar |
|-------|----------------|-------------------|
| `compartidos/` (app) | Angular, Ionic y librerías | cualquier dominio |
| `<dominio>/compartido/` | `compartidos/` | otro dominio y los subdominios de su propio dominio |
| `<dominio>/<subdominio>/` | `compartidos/`, `<dominio>/compartido/`, su propio subdominio | archivos internos de otro subdominio u otro dominio, salvo los permitidos abajo |

Dependencias entre subdominios que **existen hoy** y se permiten (quedan documentadas):
- `reportes`, `negocio/bitacora` y `negocio/criterio-kelly` → `configuracion/cuentas` (cuentas y su store).
- `general/autenticacion` (registro) → `negocio/suscripcion` (plan reservado).
- `general/inicio` → `negocio/suscripcion` (aviso del plan, planes) y menú.
- `compartidos/componentes/seleccionar-cuentas` y `alerta-limite-plan` usan hoy modelos de negocio: se documentan como **excepciones** (no se cambia código).

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
| DN-04 | `seleccionar-cuentas` y `alerta-limite-plan` en `compartidos/componentes` usan modelos de negocio | Dejarlos y documentar la excepción |

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
