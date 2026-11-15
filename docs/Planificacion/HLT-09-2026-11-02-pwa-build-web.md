# HLT-09 — PWA y endurecimiento de la build web: service worker, manifest, CSP, build sin source maps ni logs

| Campo | Valor |
|-------|-------|
| ID | HLT-09 |
| Fecha | 2026-11-02 |
| Historia | [HU-001](../Historia_usuario/HU-001-seguridad-autenticacion.md) (rev. 4) |
| Plan maestro | [PLAN-MAESTRO-HU-001](PLAN-MAESTRO-HU-001.md) (§2, §3, §4.6, §5) |
| Proyecto | `criterioKellyApp` (repositorio git propio) |
| Agente de implementación | `desarrollador-ionic` (todas las tareas) |
| Depende de | **HLT-07** ([HLT-07-2026-11-02-sesion-app.md](HLT-07-2026-11-02-sesion-app.md)): `SesionStore`, `ServicioInactividad.salir()` / `finalizarSalida()` (Flujo D, D-14), entornos y configuración `staging` (T-08) |
| Paralelo con | HLT-08 (solo comparten `src/app/app.component.ts`, en líneas distintas; D-17 de HLT-08) |
| Estado | Redactado · veredicto H6: **APROBADO** |

> **Referencias `ruta:línea`.** Leídas el 2026-11-02, antes de HLT-07. Si HLT-07 desplazó líneas, el agente de implementación localiza el punto por el fragmento o el nombre del método y registra la línea real en la evidencia. Rutas relativas a `criterioKellyApp/`.

---

## H1. Propósito

### Requerimiento literal

> **HLT-09 · PWA y endurecimiento de la build web** (plan maestro §2): "service worker, manifest, CSP (`autoCsp`), build sin source maps ni logs".
>
> Criterios asignados (plan §3): **H-01** "La PWA se habilita con `@angular/service-worker` (`ng add @angular/pwa`), con `manifest.webmanifest`, íconos y nombre de la app." · **H-02** "El service worker solo cachea recursos estáticos de la build. Las URLs de las APIs (otro servidor) quedan excluidas de `ngsw-config.json`: ninguna respuesta con datos del usuario se guarda en caché." · **H-03** "Al cerrar sesión, se limpian las cachés de datos que hubiera y el estado en memoria." · **H-06** (CSP de la app) "`default-src 'self'`; `script-src 'self'` sin `unsafe-inline` ni `unsafe-eval` (con `autoCsp` de Angular o hashes si hace falta); `connect-src 'self' https://api.<dominio>`; `img-src 'self' data:`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`…" · **H-08** "La PWA funciona sin conexión solo para mostrar la interfaz estática y un aviso de 'sin conexión'." · **G-10** (parte) "La build de producción no contiene `console.log` con datos de sesión ni source maps públicos."
>
> Encargo del coordinador: `ng add @angular/pwa` verificando compatibilidad con Angular 20 y el builder actual; `ngsw-config.json` solo con assetGroups; limpieza de cachés y memoria al cerrar sesión coordinada con `SesionStore`; CSP con `autoCsp` o hashes resolviendo los inline de index.html, jeep-sqlite, ionicons, chart.js, pdfmake y xlsx, dejando el valor exacto de cabecera como contrato para HLT-11; build de producción sin source maps ni `console.*`, optimizada y dentro de presupuestos; aviso "sin conexión"; pruebas con servidor estático local y DevTools.

### Propósito

Que la app web pueda instalarse como PWA sin guardar jamás datos del trader en caché, y que la build publicada no exponga código fuente ni registros y funcione bajo una CSP estricta que contenga un XSS.

### Resultado esperado

1. `ng build --configuration production` genera `www/` con `ngsw-worker.js`, `ngsw.json` (sin dataGroups), `manifest.webmanifest`, íconos, sin `*.map`, sin `assets/anexos/`, sin manejadores inline en `index.html`.
2. Servida localmente con las cabeceras del contrato, la app es instalable, el SW queda activo, Cache Storage solo contiene recursos estáticos propios y la consola no muestra violaciones de CSP recorriendo login, inicio, bitácora, reportes (PDF/Excel) y configuración.
3. Sin conexión aparece la interfaz con un aviso "Sin conexión"; ninguna respuesta de API sale de caché.
4. Al cerrar sesión se borran las cachés de datos (si existieran) antes de la recarga de HLT-07.
5. Existe el contrato exacto de cabeceras web (`herramientas/cabeceras-web.json`) que HLT-11 aplica en el servidor.

### Fuera de alcance

- Aplicar cabeceras en el servidor web real, HSTS, fallback SPA y caché HTTP de `index.html`/`ngsw.json` (H-05, H-06 servidor, H-07): **HLT-11**.
- Entornos, `staging`, `SesionStore`, interceptor y recarga al cerrar sesión: **HLT-07** (aquí solo se engancha la limpieza de caché).
- Apps nativas: el SW se desactiva en nativo (D-07); privacidad, red y firma: **HLT-10**.
- Migrar el builder a `@angular/build:application` (esbuild) para usar `autoCsp` (D-02).
- Funcionamiento sin conexión con datos (HU "historias aparte").
- Eliminar `jeep-sqlite` (D-09).

### Feature(s) afectada(s)

`src/` (index.html, main.ts, manifest), `src/app/app.component.*`, `src/app/compartidos/` (servicios, store, aviso-sin-conexion, seguridades/ServicioInactividad), `src/app/paginas/configuracion/cuentas/` (solo si aplica D-11), raíz (`angular.json`, `ngsw-config.json`, `package.json`, `.eslintrc.json`, `herramientas/`).

---

## H2. Reglas de negocio

| ID | Regla de negocio | Invariante verificable | Fuente |
|----|------------------|------------------------|--------|
| RN-01 | El SW solo cachea recursos estáticos de la propia build. | `ngsw-config.json` no tiene clave `dataGroups`; `node -p "(require('./www/ngsw.json').dataGroups\|\|[]).length"` = 0. | HU H-02 |
| RN-02 | Ninguna respuesta de las APIs (`environment.apiUrl*`) se guarda en Cache Storage. | V-5: en DevTools > Cache Storage todas las entradas son del origen de la web y de extensión estática. | HU H-02 |
| RN-03 | La app es instalable: manifest con nombre, `start_url`, `display: standalone`, íconos 192 y 512 y SW con manejador `fetch`. | V-2 y V-3 (DevTools > Application > Manifest sin errores; botón Instalar). | HU H-01 |
| RN-04 | El SW solo se registra en web y en builds sin modo desarrollo. | `main.ts` contiene `enabled: !isDevMode() && !Capacitor.isNativePlatform()`. | D-07 |
| RN-05 | Al cerrar sesión se eliminan todas las cachés cuyo nombre no empiece por `ngsw:` antes de la recarga de HLT-07, que borra el estado en memoria. | Spec LC-1; `grep -n "limpiarCachesDeDatos" src/app/compartidos/seguridades/ServicioInactividad.ts` = 1, antes de `location.replace`. | HU H-03; HLT-07 Flujo D, D-14 |
| RN-06 | `index.html` de producción no tiene scripts inline ni manejadores `on*`. | `grep -cE "<script>\|<script [^>]*>[^<]\| on[a-z]+=" www/index.html` = 0. | HU H-06 |
| RN-07 | La CSP contractual tiene `script-src 'self'` sin `unsafe-inline` ni `unsafe-eval`. | `herramientas/cabeceras-web.json` contiene `script-src 'self';` y no contiene `unsafe-eval` ni `'unsafe-inline'` dentro de `script-src`. | HU H-06 |
| RN-08 | La app funciona sin violaciones de CSP en los flujos principales. | V-6: consola sin "Content Security Policy" recorriendo la lista de V-6. | HU H-06 |
| RN-09 | La build de producción no publica source maps. | `ls www/*.map 2>/dev/null \| wc -l` = 0; `grep -l "sourceMappingURL" www/*.js` = vacío. | HU G-10 |
| RN-10 | El código de la app no usa `console.*`. | `grep -rn "console\." src/app` = 0; regla ESLint `no-console: error`; `ng lint` 0 errores. | HU G-10 |
| RN-11 | La build no publica los scripts SQL de `src/assets/anexos/` (contienen esquema y hashes de usuarios semilla, `GenericoDatos.sql:48-52`). | `test ! -d www/assets/anexos`. | HU E-05/DoD (descarga de `.sql`); plan §4.4 conserva la copia en `src/assets/anexos/` |
| RN-12 | Presupuestos: estilos por componente ≤ 14 KB y bundle inicial ≤ 5 MB. | `ng build --configuration production` sin error de presupuestos (`angular.json:53-64`). | IO-9 |
| RN-13 | Sin conexión se muestra la interfaz estática con el aviso "Sin conexión. Algunas funciones no están disponibles."; no se muestran datos de usuario cacheados. | V-7. | HU H-08 |
| RN-14 | Tras un despliegue, la app avisa de la versión nueva y recarga al aceptar; ante estado irrecuperable recarga sola. | Spec EA-3/EA-4; V-9. | H6 riesgo R-01 |
| RN-15 | El SW no altera las peticiones a la API ni la cookie de renovación (HLT-07), incluida la serialización entre pestañas de HLT-07 v2. | V-8: con SW activo, `renovar` responde 200 y en Network la petición no figura "(ServiceWorker)" como origen de la respuesta ni hay entrada en caché; dos pestañas siguen el comportamiento de HLT-07. | HLT-07 RN-03; nota del coordinador |

---

## H3. Flujo principal de ejecución

### Flujo A — Primera visita e instalación (web, build de producción)

```
[Navegador abre https://app.<dominio>/] → index.html (con <link rel="manifest">, sin inline)
 → main.ts bootstrapApplication → provideServiceWorker('ngsw-worker.js', registerWhenStable:30000)
 → ngsw-worker.js instala assetGroup 'aplicacion' (prefetch: index.html, manifest, *.css, *.js) y registra 'recursos' (lazy: imágenes y svg)
 → AppComponent: estadoAplicacionStore.monitorearConexion(); estadoAplicacionStore.monitorearActualizaciones()
   ├─ Éxito: SW "activated and running"; manifest válido; el navegador ofrece Instalar.
   ├─ Peticiones a apiUrl*: el SW no las cachea (sin dataGroups); van a red con las cabeceras y cookies de HLT-07.
   └─ Error de registro del SW: la app funciona igual sin PWA (no hay toast; SwUpdate.isEnabled = false).
```

### Flujo B — Sin conexión

```
[window 'offline'] → estadoAplicacionStore: patchState({ estaEnLinea: false })
 → AppComponent → <app-aviso-sin-conexion [estaSinConexion]="true"> muestra el aviso fijo
 → navegación: el SW sirve index.html y los chunks cacheados (interfaz estática)
 → cualquier petición a la API falla con status 0 → errorInterceptor: 'Error de conexión. Verifique su conexión a internet.'
[window 'online'] → estaEnLinea: true → aviso oculto
```

### Flujo C — Versión nueva tras despliegue

```
[estadoAplicacionStore.monitorearActualizaciones] → checkForUpdate() al iniciar y cada 6 h
 → SwUpdate.versionUpdates VERSION_READY → patchState({ hayVersionNueva: true })
 → AppComponent effect → AlertController 'Nueva versión disponible' ('Más tarde' | 'Actualizar')
   ├─ 'Actualizar' → document.location.reload()
   └─ 'Más tarde' → store.marcarVersionAtendida()
[SwUpdate.unrecoverable] → patchState({ requiereRecarga: true }) → AppComponent: toast warning 'La aplicación se actualizará para corregir un error de caché.' → document.location.reload()
```

### Flujo D — Cerrar sesión (enganche sobre HLT-07 Flujo D)

```
[ServicioInactividad.salir() o PerfilPage → cerrarTodas] → SesionStore.cerrarSesion()/cerrarTodasLasSesiones() (HLT-07)
 → ServicioInactividad.finalizarSalida(): sessionStorage.clear(); menú;
   → await limpiezaClienteService.limpiarCachesDeDatos()   ← HLT-09 (borra cachés que no empiezan por 'ngsw:')
   → window.location.replace(.../login)                      (HLT-07: borra el estado en memoria)
   └─ Error al borrar caché: se ignora (catch sin toast) y la recarga ocurre igual.
```

Sin persistencia local nueva: este HLT no toca SQLite ni IndexedDB. Ramas de error HTTP: las gestiona `errorInterceptor`/`autenticacionInterceptor` sin cambios (422 sigue reservado).

---

## H4. Calidad del HLT y cobertura

| Requerimiento / RN | Tarea(s) | Prueba/verificación |
|--------------------|----------|---------------------|
| H-01 (RN-03, RN-04) | T-02, T-04, T-05, T-06, T-07, T-08 | V-1…V-3; `grep` RN-04 |
| H-02 (RN-01, RN-02, RN-15) | T-03, T-06 | `node -p` RN-01; V-5; V-8 |
| H-03 (RN-05) | T-10, T-11 | Spec LC-1, LC-2; V-10 |
| H-06 app (RN-06, RN-07, RN-08) | T-06, T-07, T-15, T-16 | `grep` RN-06; V-6 |
| H-08 (RN-13) | T-12, T-13, T-14 | Spec EA-1, EA-2; V-7 |
| G-10 parte (RN-09, RN-10) | T-06, T-09 | `ls *.map`; `ng lint` |
| RN-11 anexos | T-06 | `test ! -d www/assets/anexos` |
| RN-12 presupuestos | T-18 | salida de `ng build` |
| RN-14 actualizaciones | T-12, T-14 | EA-3, EA-4; V-9 |
| Precondiciones HLT-07 | T-01 | `grep` |
| Pruebas | T-17, T-18, T-19 | salidas reales |
| Documentación | T-20 | diff |

Checklist: ✅ 11 secciones · ✅ sin marcadores pendientes · ✅ cobertura 100 % · ✅ criterio y ficha por tarea · ✅ sin contradecir §0.5 (una dependencia nueva, `@angular/service-worker`, ESM, no requiere `allowedCommonJsDependencies`) · ✅ `ruta:línea` verificadas · ✅ decisiones cerradas.

---

## H5. Reglas cerradas de decisión del HLT

| ID | Decisión | Opciones consideradas | Opción elegida | Justificación | ¿Irreversible? |
|----|----------|-----------------------|----------------|---------------|----------------|
| D-01 | Cómo habilitar la PWA | A) `ng add @angular/pwa` · B) configuración manual equivalente | **B** | Verificado en el código del schematic `@angular/pwa@20.3.30` (`pwa/index.js:69-71`): solo reconoce los builders `@angular-devkit/build-angular:browser`, `…:application` y `@angular/build:application`; el proyecto usa `@angular-builders/custom-webpack:browser` (`angular.json:14`), así que `ng add` **no** agrega el `<link rel="manifest">` a `index.html` ni el manifest a los assets de la build, y además ejecuta `npm install` sin `--legacy-peer-deps`. El sub-schematic `service-worker` sí funcionaría, pero instala `@angular/service-worker@^20.0.6` (rango de `package.json`) mientras `node_modules/@angular/core` es 20.3.25. La configuración manual produce exactamente los mismos artefactos (H-01 se cumple: `@angular/service-worker` + `manifest.webmanifest` + íconos + nombre). Se registra como desviación de la letra de H-01 (H6). | No |
| D-02 | Mecanismo de CSP para scripts | A) `security.autoCsp` · B) migrar a `@angular/build:application` · C) `script-src 'self'` sin inline | **C** | `autoCsp` existe solo en el schema del builder `application` (`node_modules/@angular/build/src/builders/application/schema.json:63`), no en el `browser` que usa custom-webpack. Además, su política (`@angular/build/src/utils/index-file/auto-csp.js:212-230`) es una `<meta>` con `'strict-dynamic'`, hashes y los respaldos `https:` y `'unsafe-inline'`, que contradice la letra de H-06 y que un escáner marca. B es una migración de build fuera de alcance. Con la build webpack, `index.html` solo carga scripts externos del mismo origen; el único inline es el `onload="this.media='all'"` de `inlineCritical` (observado en `www/index.html` actual), que se elimina con D-03. | No |
| D-03 | Optimización de producción | Por defecto · explícita | `"optimization": { "scripts": true, "styles": { "minify": true, "inlineCritical": false }, "fonts": false }`, `"sourceMap": false`, `"namedChunks": false`, `"extractLicenses": true` en `production` y en `staging` (HLT-07 T-08) | Elimina el manejador inline y el `<style>` crítico; deja explícitos los valores de G-10. Coste: un CSS bloqueante en el primer render (despreciable). | No |
| D-04 | `style-src` | `'self'` · `'self' 'unsafe-inline'` · nonces | **`'self' 'unsafe-inline'`** | Angular inyecta `<style>` de componentes, Ionic/Stencil inyecta estilos en tiempo de ejecución y hay atributos `style="…"` estáticos en 10 plantillas (p. ej. `cambiar-pin.page.html:9`). Los nonces exigen generarlos por petición en el servidor (hosting estático, DH-16). H-06 no fija `style-src`. Riesgo residual documentado (H6). | No |
| D-05 | Contrato de cabeceras | Solo en el HLT · archivo versionado | **`herramientas/cabeceras-web.json`** con la plantilla y `__ORIGEN_API__`; lo consume el servidor local de T-15 y HLT-11 | Una sola fuente para local y producción; HLT-11 sustituye `__ORIGEN_API__` por `https://api.<dominio>` (DH-07). | No |
| D-06 | Servidor estático local | `npx http-server` · `npx serve` · script Node propio | **`herramientas/servidor-local-www.mjs`** (solo módulos `node:`) en **`http://localhost:4200`** | `http-server` no envía cabeceras arbitrarias, así que no permite probar la CSP. El puerto 4200 ya está en `CORS_ORIGENES_WEB` local (plan §4.1), sin tocar el `.env` de los backends. Sin dependencias de terceros. | No |
| D-07 | SW en nativo | Activo · inactivo | **Inactivo** (`!Capacitor.isNativePlatform()`) | El WebView sirve los archivos del paquete; un SW añadiría versiones obsoletas tras actualizar la app; HLT-07 v2 prohíbe además alterar la vía HTTP nativa. | No |
| D-08 | Contenido de `ngsw-config.json` | Plantilla del schematic · personalizada | Plantilla de `@schematics/angular` 20.3.30 (`service-worker/files/ngsw-config.json.template`) sin `/favicon.ico` ni `/index.csr.html` (no existen) y con `/svg/*.svg`; **sin `dataGroups`** | `/*.js` prefetch garantiza que los chunks lazy (`/login`) estén sin conexión (H-08). | No |
| D-09 | `jeep-sqlite` (`main.ts:12-13`, `index.html` `<jeep-sqlite>`) | Quitar · mantener | **Mantener** | No tiene inline incompatibles: no carga WASM hasta abrir una BD (`jeep-sqlite.entry.js:9790-9801` solo abre un almacén localforage) y en web la app usa `DataBaseWebService`. Quitarlo es un cambio funcional no pedido (RD-7). | No |
| D-10 | `unsafe-eval` | Incluir · no | **No** | Inventario sobre `www/*.js` actual: los `new Function` de pdfmake (`pdfmake.js:39503, 60372, 75167`) y jszip son respaldos que no se ejecutan (van tras `globalThis` o `typeof === 'function'`); chart.js, jspdf, xlsx, file-saver: 0 usos. Se confirma en V-6. | No |
| D-11 | `pdfMake.createPdf(...).open()` (`cuentas.page.ts:335`) bajo CSP | Mantener · `download` | **Regla cerrada**: si en V-6 la pestaña del PDF queda en blanco o la consola (de la app o de la pestaña) muestra violación CSP, se reemplaza por `.download('cuentas.pdf')`; si se ve el PDF, no se toca | La pestaña `blob:` hereda la política del creador y el visor PDF puede chocar con `object-src 'none'` según el navegador; se decide con la observación, con las dos ramas fijadas. | No |
| D-12 | Íconos | Placeholders de Angular · generados del logo | **Generados de `src/assets/contenidos.png` (499×500)** con el script PowerShell de H8-3 en `src/assets/icons/`: 192, 512, maskable 512 (margen 22 %) y apple 180 | Marca propia; sin dependencias (System.Drawing de Windows). | No |
| D-13 | Colores y nombre | — | `name`/`short_name` "Criterio Kelly", `theme_color` `#3880ff` (`variables.scss:7`), `background_color` `#ffffff`, `lang` `es` | Coherente con el tema y `index.html:6`. | No |
| D-14 | Punto de limpieza de cachés | `SesionStore.limpiarSesionLocal` · interceptor · `ServicioInactividad.finalizarSalida()` | **`finalizarSalida()`** antes de `location.replace` | Es el punto único de salida voluntaria (salir, inactividad, 4.º PIN, cerrar todas) definido por HLT-07 D-14/D-32; el store no hace efectos de plataforma; no se edita el interceptor de HLT-07. La expiración de sesión (HLT-07 Flujo C) no es "cerrar sesión" y no hay cachés de datos que borrar (RN-01). | No |
| D-15 | Comprobación de versiones | Solo al iniciar · periódica | Al iniciar y cada **6 h** (`INTERVALO_COMPROBACION_ACTUALIZACION_MS = 21_600_000`) | Recomendación de Angular; coste nulo. | No |
| D-16 | `console.*` | Quitar en build (Terser) · prohibir en código | **ESLint `no-console: error`** + inventario | El builder no expone `drop_console`; sobrescribir Terser en custom-webpack es frágil. Inventario actual: 1 uso, `ServicioAutenticacion.ts:123` (HLT-07 lo reemplaza; si sigue, se elimina en T-09). Los `console` de librerías (p. ej. jeep-sqlite) no contienen datos de sesión. | No |
| D-17 | Versión de `@angular/service-worker` | Rango · exacta | **Exactamente la de `@angular/core` instalada** al ejecutar T-02 | Evita desalinear paquetes Angular (lockfile desfasado: `package-lock.json:943` dice 20.0.6 y `node_modules` tiene 20.3.25). | No |

---

## H6. Revisión del requerimiento por parte de un senior

| # | Ítem | Resultado | Nota |
|---|------|-----------|------|
| 1 | Entendimiento | ✅ | H-01, H-02, H-03, H-06 (app), H-08 y la parte de G-10 asignada. |
| 2 | Reglas de negocio | ✅ | Invariantes con comando u observación. |
| 3 | Impacto | ✅ | `app.component.*` compartido con HLT-07/HLT-08; `ServicioInactividad.ts` de HLT-07 (una línea). |
| 4 | Consistencia | ✅ | Store con `rxMethod`, componente presentacional sin `inject()`, `AppComponent` como orquestador. |
| 5 | Riesgos | ✅ | Tabla abajo. |
| 6 | Simplicidad | ✅ | Sin migrar builder, sin dependencias salvo el SW, sin dataGroups. |
| 7 | Seguridad | ✅ | CSP estricta en scripts, sin source maps, sin SQL publicado, sin caché de datos. |
| 8 | Cobertura | ✅ | 100 %. |
| 9 | Determinismo | ✅ | D-11 con dos ramas cerradas por observación; versiones fijadas por comando. |
| 10 | Ejecutabilidad | ✅ | Criterios con comandos. |

### Revisión adversarial

1. **SW sirviendo una versión vieja tras desplegar (R-01).** El SW sirve `index.html` cacheado (`navigationRequestStrategy` por defecto) hasta detectar la versión nueva. Mitigaciones: `checkForUpdate` al iniciar y cada 6 h + aviso `VERSION_READY` + recarga en `unrecoverable` (RN-14); `ngsw.json` y `index.html` sin caché HTTP (H-05, **HLT-11**: requisito explícito que se le traslada); interruptor de emergencia: desplegar `safety-worker.js` (incluido en `@angular/service-worker`) como `ngsw-worker.js` desregistra el SW en todos los clientes — documentado en el README (T-20). Riesgo residual Media: un usuario puede usar la versión anterior hasta aceptar el aviso; como el contrato HTTP lo controla el servidor, una versión vieja solo falla con errores visibles, no filtra datos.
2. **Cache poisoning.** El SW solo cachea mismo origen y verifica el hash de cada recurso contra `ngsw.json` (una descarga con hash distinto se descarta); no hay dataGroups, así que ninguna respuesta de API ni de terceros entra en caché; la CSP impide cargar scripts de otros orígenes; HTTPS en producción (HLT-11). Riesgo residual Baja: quien controle el servidor web puede publicar un `ngsw.json` malicioso, mismo nivel que publicar JS malicioso.
3. **CSP rota en producción (R-02).** Se prueba localmente con la misma cadena de cabeceras (`cabeceras-web.json`) que usará HLT-11, recorriendo todas las pantallas con exportaciones (V-6). Se traslada a HLT-11 el requisito de desplegar primero en staging con `Content-Security-Policy-Report-Only` y pasar a modo estricto tras un recorrido sin reportes. Diferencia local/producción: solo `connect-src` y `upgrade-insecure-requests` (que el servidor local omite con `http://`).
4. **`style-src 'unsafe-inline'`.** Permite inyección de CSS (exfiltración limitada por selectores). Mitigado: no hay sumideros `innerHTML`/`bypassSecurityTrust` (HLT-07 riesgo 5) y `script-src` sigue estricto. Aceptado (Baja).
5. **Interacción con HLT-07 / HLT-07 v2.** El SW no intercepta para caché las peticiones cross-origin de la API; la serialización de `renovar` entre pestañas (Web Locks API) es una API de página no afectada por SW ni por CSP; `connect-src` incluye el origen de la API, del que salen `renovar` y `cerrarSesion`. En nativo el SW está apagado (D-07), compatible con la prohibición de CapacitorHttp. Se verifica en V-8.
6. **Desviación de la letra de H-01** ("`ng add @angular/pwa`"): justificada en D-01 con el código del schematic; el resultado exigido por H-01 se cumple. Se eleva como observación al plan maestro.
7. **Contradicción con el plan maestro §2** ("CSP (`autoCsp`)"): `autoCsp` no está disponible con el builder actual y su salida incluye `'unsafe-inline'` (D-02). H-06 permite "o hashes si hace falta"; aquí ni siquiera hacen falta hashes.
8. **SW en el puerto 4200 en desarrollo.** Tras V-1…V-10 el SW queda registrado en `localhost:4200`; un `ng serve` posterior en ese puerto podría servirse desde caché. T-19 termina desregistrando el SW y borrando datos del sitio; el flujo de desarrollo del proyecto usa 8100.

### Riesgos

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|------------|
| R-01 | Versión obsoleta servida por el SW | Media | RN-14, H-05 en HLT-11, `safety-worker.js` documentado |
| R-02 | CSP bloquea una funcionalidad en producción | Alta | V-6 con la cabecera exacta; Report-Only en staging (HLT-11); D-11 |
| R-03 | Hashes de usuarios semilla publicados en builds anteriores (`www/assets/anexos/GenericoDatos.sql`) y en el APK | Alta | RN-11 desde ahora; HLT-11 debe rotar esas claves o eliminar esos usuarios en producción (se eleva al coordinador) |
| R-04 | Estilos inline inyectables (`style-src 'unsafe-inline'`) | Baja | D-04 |
| R-05 | Choque de edición en `app.component.*` con HLT-08 | Baja | Líneas distintas; quien ejecute segundo integra |

### Veredicto

**APROBADO.** Cubre al 100 % los criterios asignados; las dos desviaciones respecto a la letra del plan/HU (`ng add`, `autoCsp`) se basan en el código verificado de las herramientas y producen un resultado igual o más estricto; los riesgos Alta tienen mitigación concreta y lo que corresponde al servidor queda trasladado a HLT-11.

---

## H7. Plan de tareas

Agente de todas las tareas: **`desarrollador-ionic`**. Paralelizables: T-03/T-04/T-09/T-10/T-12/T-15.

| ID | Agente | Tarea (verbo + objeto) | Archivos `ruta:línea` | Depende de | Criterio de aceptación (verificable) | RN/Req |
|----|--------|------------------------|-----------------------|------------|--------------------------------------|--------|
| T-01 | desarrollador-ionic | Verificar precondiciones de HLT-07 (solo lectura) | `angular.json`, `src/environments/environment.staging.ts`, `src/app/compartidos/store/sesion.store.ts`, `src/app/compartidos/seguridades/ServicioInactividad.ts` | — | `grep -n '"staging"' angular.json` ≥ 1; `test -f src/environments/environment.staging.ts`; `grep -n "finalizarSalida" src/app/compartidos/seguridades/ServicioInactividad.ts` ≥ 1 y contiene `location.replace`; `grep -n "cerrarSesion" src/app/compartidos/store/sesion.store.ts` ≥ 1. Si falla → BLOQUEADA. | Precondición |
| T-02 | desarrollador-ionic | Instalar `@angular/service-worker` alineado con el core | `package.json`, `package-lock.json` | T-01 | `npm install @angular/service-worker@$(node -p "require('@angular/core/package.json').version") --save-exact --legacy-peer-deps`; `node -p "require('@angular/service-worker/package.json').version"` = versión de `@angular/core`. | H-01 |
| T-03 | desarrollador-ionic | Crear `ngsw-config.json` | `ngsw-config.json` (nuevo, raíz) | T-02 | Contenido exacto de H8-2; `node -e "const c=require('./ngsw-config.json'); if('dataGroups' in c) process.exit(1)"` sale con 0. | RN-01 |
| T-04 | desarrollador-ionic | Generar los íconos de la PWA | `src/assets/icons/icono-192x192.png`, `icono-512x512.png`, `icono-maskable-512x512.png`, `icono-apple-180x180.png` (nuevos) | T-01 | Script de H8-3 ejecutado desde `criterioKellyApp/`; cada archivo existe con el tamaño de su nombre (verificar con `node -e` leyendo bytes 16-23 del PNG). | RN-03 |
| T-05 | desarrollador-ionic | Crear el manifest | `src/manifest.webmanifest` (nuevo) | T-04 | Contenido exacto de H8-4; `node -e "JSON.parse(require('fs').readFileSync('src/manifest.webmanifest','utf8'))"` sin error. | RN-03 |
| T-06 | desarrollador-ionic | Configurar la build (SW, assets, optimización, sin source maps) | `angular.json:36-47` (assets de build), `:52-72` (production), configuración `staging` de HLT-07 | T-03, T-05 | Assets de build: la entrada `src/assets` lleva `"ignore": ["anexos/**"]` y se agrega `"src/manifest.webmanifest"`; `production` y `staging` con las claves de H8-5; `development` (`:73-80`) sin cambios. | RN-01, RN-06, RN-09, RN-11 |
| T-07 | desarrollador-ionic | Enlazar el manifest en `index.html` | `src/index.html:15-19`, `:22-25` | T-05 | Tras `index.html:15`: `<link rel="manifest" href="manifest.webmanifest" />`, `<meta name="theme-color" content="#3880ff" />`, `<link rel="apple-touch-icon" href="assets/icons/icono-apple-180x180.png" />`; antes de `</body>`: `<noscript>Habilite JavaScript para usar Criterio Kelly.</noscript>`; sin `<script>` ni `<style>` inline; `<jeep-sqlite>` se mantiene. | RN-03, RN-06 |
| T-08 | desarrollador-ionic | Registrar el SW en `main.ts` | `src/main.ts:1-4`, `:17-24` | T-02 | Provider de H8-6 agregado al arreglo de `bootstrapApplication`; imports de `isDevMode`, `provideServiceWorker`, `Capacitor`; nada más cambia. | RN-04 |
| T-09 | desarrollador-ionic | Prohibir `console.*` y eliminar los restantes | `.eslintrc.json:15`, `src/app/compartidos/seguridades/ServicioAutenticacion.ts:123` (solo si sigue existiendo tras HLT-07) | T-01 | `"no-console": "error"` dentro de `rules` del override `*.ts`; `grep -rn "console\." src/app` = 0; `ng lint` 0 errores. | RN-10 |
| T-10 | desarrollador-ionic | Crear `LimpiezaClienteService` y su spec | `src/app/compartidos/servicios/limpieza-cliente.service.ts` (nuevo), `limpieza-cliente.service.spec.ts` (nuevo) | T-01 | API de H8-7; `ng test --watch=false --include='**/limpieza-cliente.service.spec.ts'` verde con LC-1, LC-2. | RN-05 |
| T-11 | desarrollador-ionic | Enganchar la limpieza de cachés al cierre de sesión | `src/app/compartidos/seguridades/ServicioInactividad.ts` (método `finalizarSalida()` de HLT-07) | T-10 | `finalizarSalida()` hace `try { await this.limpiezaCliente.limpiarCachesDeDatos(); } catch { /* la recarga borra el resto */ }` inmediatamente antes de `window.location.replace(...)`; el resto del método no cambia. | RN-05, H-03 |
| T-12 | desarrollador-ionic | Crear `EstadoAplicacionStore` y su spec | `src/app/compartidos/store/estado-aplicacion.store.ts` (nuevo), `estado-aplicacion.store.spec.ts` (nuevo) | T-02 | Estado y métodos de H8-8; spec EA-1…EA-4 verde. | RN-13, RN-14 |
| T-13 | desarrollador-ionic | Crear el componente presentacional de aviso sin conexión | `src/app/compartidos/aviso-sin-conexion/aviso-sin-conexion.component.ts\|html\|scss` (nuevos) | T-01 | Selector `app-aviso-sin-conexion`; `estaSinConexion = input(false)`; `OnPush`; sin `inject()`; texto de RN-13 con `ion-icon name="cloud-offline-outline"`; SCSS < 1 KB, `position: fixed; top: 0; z-index: 30000`. | RN-13 |
| T-14 | desarrollador-ionic | Integrar estado de aplicación y aviso en `AppComponent` | `src/app/app.component.ts:19`, `:21-29`, `:41-70`; `src/app/app.component.html:1-2` | T-12, T-13 | Importa `AvisoSinConexionComponent`; inyecta `EstadoAplicacionStore`, `AlertController`, `UtilitariosService`; en el constructor llama `monitorearConexion()` y `monitorearActualizaciones()`; dos `effect` (Flujo C); en el HTML, tras `<ion-app>`: `<app-aviso-sin-conexion [estaSinConexion]="!estadoAplicacion.estaEnLinea()" />`. No toca `:37` (HLT-08). | RN-13, RN-14 |
| T-15 | desarrollador-ionic | Crear el contrato de cabeceras y el servidor local | `herramientas/cabeceras-web.json` (nuevo), `herramientas/servidor-local-www.mjs` (nuevo) | T-01 | Contenido de H8-9 y H8-10; `node herramientas/servidor-local-www.mjs` sobre una build sirve `/` y `/inicio` (fallback) con `curl -sI http://localhost:4200/inicio` mostrando `Content-Security-Policy` con `connect-src 'self' http://localhost`. | RN-07 |
| T-16 | desarrollador-ionic | Aplicar la regla D-11 a la exportación PDF de cuentas | `src/app/paginas/configuracion/cuentas/cuentas.page.ts:335` | T-19 (paso V-6.e) | Si V-6.e mostró PDF visible: archivo sin cambios y se registra la observación. Si no: la línea queda `pdfMake.createPdf(docDefinition).download('cuentas.pdf');` y V-6.e se repite con descarga correcta. | RN-08 |
| T-17 | desarrollador-ionic | Ejecutar lint y pruebas | — | T-09, T-10, T-11, T-12, T-14 | `ng lint` 0 errores; `ng test --watch=false --include='**/limpieza-cliente.service.spec.ts' --include='**/estado-aplicacion.store.spec.ts'` verde. | Pruebas |
| T-18 | desarrollador-ionic | Ejecutar la build de producción y sus verificaciones | — | T-06, T-07, T-08, T-17 | `ng build --configuration production` sin errores ni presupuestos excedidos; y en `www/`: `ls *.map` = 0; `grep -l sourceMappingURL *.js` vacío; `test -f ngsw-worker.js && test -f ngsw.json && test -f manifest.webmanifest`; `node -p` RN-01 = 0; `grep -cE " on[a-z]+=\|<style" index.html` = 0; `test ! -d assets/anexos`; `ng build --configuration staging` también sin errores. | RN-01, RN-06, RN-09, RN-11, RN-12 |
| T-19 | desarrollador-ionic | Verificar PWA y CSP en el navegador | — (observación) | T-15, T-18 | XAMPP con backends (HLT-07 hecho); `node herramientas/servidor-local-www.mjs`; Chrome en `http://localhost:4200`; evidencia de V-1…V-10 (H8-11); al final, DevTools > Application > Storage > "Clear site data" y desregistrar el SW. | RN-02…RN-05, RN-08, RN-13…RN-15 |
| T-20 | desarrollador-ionic | Actualizar la documentación | `README.md` ("Comandos" línea 56, "Sesión y seguridad" línea 190), `CLAUDE.md` (línea "What is not set up: … no PWA/service worker"), `docs/doc_arquitectura.md` §6.4 ("No hay: … PWA/service worker") | T-19 | README: sección "PWA y build web" con build, servidor local, contrato `herramientas/cabeceras-web.json`, requisitos para HLT-11 (no-cache de `index.html`/`ngsw.json`, Report-Only en staging) y procedimiento `safety-worker.js`; CLAUDE.md y doc_arquitectura ya no dicen que no hay PWA. | Plan §5.5 |

---

## H8. Reglas de implementación deterministas

Rigen RI-1…RI-11 y `.claude/agents/desarrollador-ionic.md`. Excepciones registradas: `herramientas/*.mjs` y `.json` fuera de `src/` (no son código de la app ni pasan por ESLint del proyecto).

### H8-1. Reglas específicas

- **RI-09-1** Ningún archivo nuevo usa `any`, `console.*`, `localStorage` ni `innerHTML`.
- **RI-09-2** El store no navega, no recarga y no muestra toasts; la recarga y la alerta las hace `AppComponent`.
- **RI-09-3** Toda constante numérica con nombre: `INTERVALO_COMPROBACION_ACTUALIZACION_MS = 21_600_000`, `PREFIJO_CACHE_SERVICE_WORKER = 'ngsw:'`, `PUERTO_POR_DEFECTO = 4200`.
- **RI-09-4** Textos: alerta header 'Nueva versión disponible', message 'Hay una versión nueva de Criterio Kelly. ¿Desea actualizar ahora?', botones 'Más tarde' / 'Actualizar'.

### H8-2. `ngsw-config.json`

```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "aplicacion",
      "installMode": "prefetch",
      "resources": { "files": ["/index.html", "/manifest.webmanifest", "/*.css", "/*.js"] }
    },
    {
      "name": "recursos",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": { "files": ["/assets/**/*.(svg|png|jpg|jpeg|webp|gif|ico)", "/svg/*.svg"] }
    }
  ]
}
```

### H8-3. Script de íconos (PowerShell, desde `criterioKellyApp/`)

```powershell
Add-Type -AssemblyName System.Drawing
$origen = [System.Drawing.Image]::FromFile((Resolve-Path 'src/assets/contenidos.png'))
New-Item -ItemType Directory -Force 'src/assets/icons' | Out-Null
function New-IconoPwa([int]$lado, [double]$margen, [string]$destino) {
  $lienzo = New-Object System.Drawing.Bitmap $lado, $lado
  $g = [System.Drawing.Graphics]::FromImage($lienzo)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::White)
  $util = $lado * (1 - 2 * $margen)
  $escala = [Math]::Min($util / $origen.Width, $util / $origen.Height)
  $ancho = [int]($origen.Width * $escala); $alto = [int]($origen.Height * $escala)
  $g.DrawImage($origen, [int](($lado - $ancho) / 2), [int](($lado - $alto) / 2), $ancho, $alto)
  $lienzo.Save((Join-Path (Get-Location) $destino), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $lienzo.Dispose()
}
New-IconoPwa 192 0.0 'src/assets/icons/icono-192x192.png'
New-IconoPwa 512 0.0 'src/assets/icons/icono-512x512.png'
New-IconoPwa 512 0.22 'src/assets/icons/icono-maskable-512x512.png'
New-IconoPwa 180 0.0 'src/assets/icons/icono-apple-180x180.png'
$origen.Dispose()
```

### H8-4. `src/manifest.webmanifest`

```json
{
  "name": "Criterio Kelly",
  "short_name": "Criterio Kelly",
  "description": "Gestión de trading con el Criterio de Kelly",
  "lang": "es",
  "dir": "ltr",
  "display": "standalone",
  "scope": "./",
  "start_url": "./",
  "theme_color": "#3880ff",
  "background_color": "#ffffff",
  "icons": [
    { "src": "assets/icons/icono-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/icono-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/icono-maskable-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### H8-5. Claves de `angular.json` para `production` y `staging`

```json
"optimization": { "scripts": true, "styles": { "minify": true, "inlineCritical": false }, "fonts": false },
"sourceMap": false,
"namedChunks": false,
"extractLicenses": true,
"serviceWorker": true,
"ngswConfigPath": "ngsw-config.json"
```

Se conservan `budgets`, `fileReplacements` y `outputHashing` existentes. Entrada de assets de build: `{ "glob": "**/*", "input": "src/assets", "output": "assets", "ignore": ["anexos/**"] }` y `"src/manifest.webmanifest"`. El target `test` no cambia.

### H8-6. Provider del SW (`main.ts`)

```ts
provideServiceWorker('ngsw-worker.js', {
  enabled: !isDevMode() && !Capacitor.isNativePlatform(),
  registrationStrategy: 'registerWhenStable:30000',
}),
```

### H8-7. `LimpiezaClienteService`

```ts
export const PREFIJO_CACHE_SERVICE_WORKER = 'ngsw:';
@Injectable({ providedIn: 'root' })
export class LimpiezaClienteService {
  /** Borra las cachés que no son del service worker de Angular. Devuelve cuántas borró. */
  async limpiarCachesDeDatos(): Promise<number>; // si !('caches' in globalThis) → 0
}
```

Specs: **LC-1** con `caches` simulado (`spyOn(caches, 'keys').and.resolveTo(['ngsw:/:1:assets', 'datos-x'])`, `spyOn(caches, 'delete').and.resolveTo(true)`) borra solo `datos-x` y devuelve 1; **LC-2** sin cachés distintas de `ngsw:` devuelve 0 y no llama `delete`.

### H8-8. `EstadoAplicacionStore`

- Estado: `{ estaEnLinea: boolean (navigator.onLine al crear), hayVersionNueva: false, requiereRecarga: false, loading: false, error: null }`; computed `isLoading`, `errorMessage` (sin reexportar señales de estado).
- `monitorearConexion: rxMethod<void>` → `merge(fromEvent(window, 'online').pipe(map(() => true)), fromEvent(window, 'offline').pipe(map(() => false)))` → `patchState({ estaEnLinea })`.
- `monitorearActualizaciones: rxMethod<void>` → si `!swUpdate.isEnabled` → `EMPTY`; si no, `merge(` `versionUpdates` filtrado a `VERSION_READY` → `hayVersionNueva: true`; `unrecoverable` → `requiereRecarga: true`; `timer(0, INTERVALO_COMPROBACION_ACTUALIZACION_MS)` → `from(swUpdate.checkForUpdate())` `)`, con `catchError` → `error: 'No se pudo comprobar si hay una versión nueva'`.
- `marcarVersionAtendida()` → `hayVersionNueva: false`.
- Specs: **EA-1** evento `offline` → `estaEnLinea()` false; **EA-2** `online` → true; **EA-3** `versionUpdates.next({ type: 'VERSION_READY', … })` → `hayVersionNueva()` true; **EA-4** `unrecoverable.next(...)` → `requiereRecarga()` true; con `isEnabled: false` no llama `checkForUpdate`. `SwUpdate` se provee con un doble (`Subject`s y `jasmine.createSpy().and.resolveTo(false)`).

### H8-9. `herramientas/cabeceras-web.json` (contrato para HLT-11)

```json
{
  "origenApiPorDefecto": "http://localhost",
  "directivasSoloHttps": "upgrade-insecure-requests",
  "cabeceras": {
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' __ORIGEN_API__; worker-src 'self'; manifest-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  }
}
```

**Valor exacto de producción** (HLT-11 lo aplica como cabecera, con `<dominio>` de DH-07): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.<dominio>; worker-src 'self'; manifest-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests`. Staging: igual con `https://staging-api.<dominio>`.

### H8-10. `herramientas/servidor-local-www.mjs`

- Solo `node:http`, `node:fs/promises`, `node:path`, `node:url`.
- Raíz `www/` (relativa al script: `../www`); puerto `process.env.PUERTO ?? 4200`; origen de API `process.env.ORIGEN_API ?? origenApiPorDefecto`.
- Construye la CSP reemplazando `__ORIGEN_API__`; si el origen empieza por `https://`, agrega `; ` + `directivasSoloHttps`.
- Para cada GET/HEAD: resuelve la ruta dentro de la raíz (si el resultado no empieza por la raíz → 404); si el archivo existe, lo sirve con su `Content-Type` (`.html` `text/html; charset=utf-8`, `.js` `text/javascript`, `.css` `text/css`, `.json` `application/json`, `.webmanifest` `application/manifest+json`, `.png` `image/png`, `.svg` `image/svg+xml`, `.ico` `image/x-icon`, `.txt` `text/plain`); si no existe y la ruta no tiene extensión → `index.html`; si no → 404. Otros métodos → 405.
- Todas las respuestas llevan las cabeceras del JSON y `Cache-Control: no-cache`.
- Imprime una sola línea al arrancar con la URL (herramienta de desarrollo; fuera del alcance de `no-console`).

### H8-11. Verificaciones en el navegador (T-19)

| ID | Verificación | Resultado esperado |
|----|--------------|--------------------|
| V-1 | DevTools > Application > Service Workers | `ngsw-worker.js` "activated and is running" |
| V-2 | Application > Manifest | Nombre, colores e íconos sin errores ni advertencias de instalabilidad |
| V-3 | Barra de direcciones | Opción "Instalar Criterio Kelly"; la app instalada abre en ventana propia |
| V-4 | Network al recargar | Los JS/CSS se sirven "(ServiceWorker)" |
| V-5 | Login y recorrido por inicio, bitácora y cuentas; luego Application > Cache Storage | Solo cachés `ngsw:*`; ninguna URL con `/rest_` ni de otro origen |
| V-6 | Consola filtrada por "Content Security Policy" mientras se recorre: (a) login, (b) inicio y menú, (c) bitácora abrir/seguimiento/finalizar, (d) reportes: operativas → exportar PDF y Excel, gráfico estadístico → PDF, (e) cuentas → PDF (`cuentas.page.ts:335`), (f) perfil, cambiar PIN, operativa Kelly | 0 violaciones; descargas correctas; (e) decide D-11 |
| V-7 | Network > Offline y navegar a `/login` e `/inicio` | Interfaz y aviso "Sin conexión"; peticiones a la API con error de conexión; nada servido desde caché para `/rest_` |
| V-8 | Con SW activo: forzar renovación (HLT-07 T-36) y abrir una segunda pestaña | `renovar` 200 con cookie; en Network la petición a la API no tiene "(ServiceWorker)" como origen de la respuesta; comportamiento entre pestañas igual que en HLT-07 |
| V-9 | Cambiar un texto, `ng build --configuration production`, recargar la pestaña abierta | Alerta "Nueva versión disponible"; "Actualizar" carga la versión nueva |
| V-10 | Crear desde la consola `await caches.open('datos-prueba')` y pulsar SALIR | Tras la recarga, `caches.keys()` no contiene `datos-prueba` |

---

## H9. Reglas de seguimiento de ejecución

Fichas por tarea y tablero global según RS-1…RS-9. En T-01, T-17, T-18 y T-19, C1 y C6 se marcan `➖` ("tarea de verificación"). En T-04 y T-15, C4 se marca `➖` (archivos fuera de `lintFilePatterns`).

### Fichas

```
T-01 — Verificar precondiciones de HLT-07 (solo lectura)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-02 — Instalar `@angular/service-worker` alineado con el core
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-03 — Crear `ngsw-config.json`
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-04 — Generar los íconos de la PWA
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-05 — Crear el manifest
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-06 — Configurar la build (SW, assets, optimización, sin source maps)
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-07 — Enlazar el manifest en `index.html`
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-08 — Registrar el SW en `main.ts`
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-09 — Prohibir `console.*` y eliminar los restantes
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-10 — Crear `LimpiezaClienteService` y su spec
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-11 — Enganchar la limpieza de cachés al cierre de sesión
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-12 — Crear `EstadoAplicacionStore` y su spec
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-13 — Crear el componente presentacional de aviso sin conexión
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-14 — Integrar estado de aplicación y aviso en `AppComponent`
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-15 — Crear el contrato de cabeceras y el servidor local
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-16 — Aplicar la regla D-11 a la exportación PDF de cuentas
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-17 — Ejecutar lint y pruebas
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-18 — Ejecutar la build de producción y sus verificaciones
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-19 — Verificar PWA y CSP en el navegador
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```

```
T-20 — Actualizar la documentación
  Estado: PENDIENTE
  Checks de verificación:
    [⬜] C1. Cambios aplicados en los archivos declarados (ruta:línea)
    [⬜] C2. Cumple el criterio de aceptación (§9) — evidencia: <comando/observación>
    [⬜] C3. Respeta las reglas de implementación (§10, RI-1…RI-11)
    [⬜] C4. Lint OK (ng lint) sobre lo tocado
    [⬜] C5. Pruebas OK (ng test --watch=false --include=…) si aplica
    [⬜] C6. Sin efectos fuera de alcance (solo archivos declarados)
  Evidencia:
  Notas / desviaciones:
```


### Tablero global

| Tarea | Estado | C1 | C2 | C3 | C4 | C5 | C6 | ¿Todos ✅? |
|-------|--------|----|----|----|----|----|----|-----------|
| T-01 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-02 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-03 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-04 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-05 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-06 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-07 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-08 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-09 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-10 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-11 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-12 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-13 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-14 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-15 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-16 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-17 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-18 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-19 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |
| T-20 | PENDIENTE | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | No |

Si T-01 queda BLOQUEADA, ninguna otra tarea inicia (RS-6). Una violación de CSP en V-6 que no resuelva D-11 se registra como tarea adicional con revisión H6 antes de ejecutarla (RS-7); está prohibido relajar `script-src`.

---

## H10. Diseño del reporte de ejecución

```
REPORTE DE EJECUCIÓN — HLT-09 PWA y endurecimiento de la build web
  1. Resumen ejecutivo
  2. Estado global            (COMPLETADO | PARCIAL | BLOQUEADO)
  3. Tablero de tareas        (T-01…T-20 con C1…C6)
  4. Cobertura vs. HLT        (RN-01…RN-15, H-01, H-02, H-03, H-06 app, H-08, G-10 parte)
  5. Cambios realizados       (ruta:línea, tipo)
  6. Verificaciones ejecutadas (ng lint, ng test, ng build prod/staging, checks de www/, V-1…V-10 con capturas o texto)
  7. Desviaciones y decisiones (incluye la rama tomada en D-11)
  8. Pendientes / bloqueos
  9. Próximos pasos           (requisitos trasladados a HLT-11: cabeceras de cabeceras-web.json, no-cache de index.html/ngsw.json, Report-Only en staging, rotación de usuarios semilla)
```

RR-1…RR-5 sin excepciones. La sección 6 incluye la salida de `curl -sI http://localhost:4200/` con la CSP efectiva y el tamaño del bundle inicial informado por la build.

---

## H11. Convenciones de desarrollo y arquitectura de código limpio

Rige `doc_modo_planificacion.md` §13 y `desarrollador-ionic.md`.

| Artefacto | Archivo | Capa |
|-----------|---------|------|
| `EstadoAplicacionStore` | `compartidos/store/estado-aplicacion.store.ts` | Store transversal (toda la lógica de conexión y versiones) |
| `AvisoSinConexionComponent` | `compartidos/aviso-sin-conexion/aviso-sin-conexion.component.ts` | Presentacional (sin `inject()`) |
| `LimpiezaClienteService` | `compartidos/servicios/limpieza-cliente.service.ts` | Acceso a almacenamiento del navegador |
| `AppComponent` | `app.component.ts` | Orquestador del shell (alerta, toast, recarga) |
| Contrato y servidor local | `herramientas/cabeceras-web.json`, `herramientas/servidor-local-www.mjs` | Herramientas de desarrollo |

- Nombres en español, verbo + objeto (`monitorearConexion`, `monitorearActualizaciones`, `marcarVersionAtendida`, `limpiarCachesDeDatos`); booleanos `esta/hay/requiere`; constantes `UPPER_SNAKE_CASE`.
- Archivos nuevos en kebab-case con sufijo de rol; íconos `icono-<tamaño>.png`.
- `OnPush` en el componente nuevo; plantillas con `@if`; SCSS < 14 KB.
- `npm install` solo con `--legacy-peer-deps` (T-02); `@angular/service-worker` es ESM y no va en `allowedCommonJsDependencies`.
