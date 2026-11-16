# Análisis integral de SCA-QR

Segunda revisión: 16 de noviembre de 2026, zona America/Lima. Código revisado: `d44c688f79e46093a2eee105d7f1851682e10b48`. El código de aplicación no cambió respecto de la primera revisión; se amplió la validación en producción y navegador.

Este documento evalúa la implementación presente; el diseño propuesto está en [SDD_MEJORA_GRATUITA.md](SDD_MEJORA_GRATUITA.md). No se ha implementado la propuesta ni contratado, desplegado o publicado ningún servicio.

## 1. Dictamen

El repositorio es un prototipo funcional de control de asistencia, con una interfaz de portería trabajada, panel administrativo, API mock y una primera aproximación a PWA y cola offline. Es una base reutilizable, pero **no está preparado para registrar asistencia real de manera confiable ni para exponer información de estudiantes en Internet**.

La prioridad es integridad, persistencia y autorización. Agregar Redis, más lectores, correo o un dashboard más complejo antes de corregirlas aumentaría la superficie del problema. Que las pruebas y el compilador pasen no acredita el circuito completo lector → almacenamiento local → servidor → reporte.

Principales bloqueos:

1. IndexedDB tiene dos versiones incompatibles; su fallo puede aparecer como cero registros pendientes.
2. La interfaz confirma registros antes de recibir aceptación del servidor y pierde errores de envío.
3. Asistencia e idempotencia viven en memoria del proceso, sin persistencia transaccional.
4. Las firmas QR son simuladas y hay credenciales y secreto JWT de demostración.
5. El padrón y la escritura de asistencia no requieren autenticación.
6. La cola elimina eventos tras tres fallos y equipara cualquier conflicto 409 a una sincronización correcta.
7. La compilación de producción elimina el cuerpo de la función de registro del service worker insertada mediante `toString()`: el navegador recibe `(function r(){})();` y no registra ningún worker automáticamente.

Esta revisión documenta **30 hallazgos**, diferenciando defectos reproducidos, conclusiones por lectura y capacidades todavía no verificadas.

## 2. Alcance, método y límites

Se revisaron manifiestos, lockfile, configuración Next/TypeScript/Vitest, workflow de GitHub, módulos `src/lib`, tipos, middleware, componentes de lector, pantalla de ingreso, endpoints, pantallas administrativas, service worker, manifest, pruebas y documentación de arquitectura, escalabilidad y costos. Las propuestas comerciales existentes no prueban funciones implementadas ni capacidad medida.

Se ejecutaron nuevamente las 14 pruebas unitarias, TypeScript, lint y una compilación de producción. Se inició `npm start` y se hicieron peticiones locales contra datos demo. Se reprodujeron IndexedDB, descarte y conflicto 409 con los módulos reales, transpiliados en memoria, y `fake-indexeddb`. Se generó un PDF de 100 marcaciones y se extrajo su texto. Se probó la aplicación con Playwright disponible en el entorno y Chromium del sistema: perfiles nuevos, fallo HTTP 503, registro de worker y caché tras logout. Esos perfiles y fixtures son de prueba; no se modificó código ni datos de usuarios reales.

No se hizo auditoría legal, pentest externo, prueba de penetración destructiva, medición de carga, prueba con USB real ni instalación PWA desde la interfaz del navegador. No se validaron Redis, Resend, producción remota ni recuperación desde backups. La comprobación de navegador fue funcional, no una auditoría visual/accesible exhaustiva. Playwright está disponible en la máquina, pero no está declarado ni configurado como dependencia E2E del repositorio.

Las páginas web comerciales consultadas siguen bloqueadas por el proxy, pero se recuperó documentación oficial desde `raw.githubusercontent.com` de los repositorios de Cloudflare y Supabase. Se verificaron cuotas publicadas, límites de funciones, pausa por inactividad y requisitos de copias; las fuentes están identificadas en el SDD. Elegibilidad contractual, disponibilidad regional, ausencia de tarjeta y estado efectivo de una cuenta siguen pendientes: leer una cuota no equivale a provisionar un plan gratuito.

## 3. Inventario y arquitectura actual

| Área | Implementación real | Consecuencia |
|---|---|---|
| Aplicación | Next.js 14.2.15, React 18, TypeScript estricto, Tailwind | UI y rutas backend en un mismo proyecto |
| Captura | Eventos de teclado, prefijos, inputs con foco rotatorio | No proporciona canales físicos independientes |
| Datos | Ocho estudiantes en arrays, log de asistencia y Map de idempotencia | Se reinician al perder el proceso; no hay BD |
| Caché | Memoria por defecto; adaptador ioredis opcional | Redis no sustituye el log ni la idempotencia |
| Offline | `idb`, caché de estudiantes, cola y recientes | Esquema fragmentado y políticas de descarte inseguras |
| PWA | Manifest, sonidos, SVG, archivo SW y registro serializado | El build probado inserta una función vacía y no registra SW |
| Autenticación | JWT de 12 h, cookie HttpOnly, bcrypt, usuarios demo | Sin gestión real de cuentas, roles efectivos o revocación |
| Administración | Estadísticas, listado de scans, PDF, correo | Depende de datos mock y memoria |
| Pruebas | 3 archivos Vitest, 14 casos | Cobertura concentrada en helpers |
| CI/CD | Node 20, npm ci, lint/typecheck/test/build, SSH a VPS | Inconsistente con dependencias actuales y con presupuesto cero |

Flujo actual: el navegador consulta alumnos, guarda caché y captura códigos; muestra un resultado optimista; envía a una API que valida un formato demo y añade datos a un array. El panel consulta ese estado en memoria. La sincronización offline usa otro acceso a IndexedDB y una API que no puede demostrar persistencia durable.

### Fortalezas que conviene conservar

- Tipos compartidos, validación Zod y separación inicial de utilidades.
- UUID por evento e intención de idempotencia, aunque su implementación sea incompleta.
- Búsqueda manual, sonidos y estados visuales como apoyo a portería.
- Modelo explícito de entradas y lectores.
- Reportes PDF locales y pruebas automatizadas que permiten comenzar una refactorización incremental.
- IndexedDB y service worker como tecnologías apropiadas para desconexiones si se corrigen sus contratos.

## 4. Hallazgos priorizados y evidencia

Severidad crítica: puede impedir el registro, perder información o permitir acceso sustancial no autorizado. Alta: compromete reglas de negocio, privacidad u operación. Media: degrada exactitud, experiencia o mantenimiento. La severidad considera el uso con datos reales; hoy los datos son de demostración.

| ID | Nivel | Evidencia en el código | Problema e impacto | Corrección propuesta |
|---|---|---|---|---|
| F01 | Crítica | `src/lib/offlineQueue.ts:6`; `src/lib/studentsCache.ts:6` | Abren la misma BD con versiones 2 y 3. Si se crea v3 primero, faltan stores de cola y abrir v2 da VersionError. Si v2 conserva conexiones, puede bloquear el upgrade. | Un módulo propietario del esquema, migraciones acumulativas y manejo de versionchange/blocked |
| F02 | Crítica | `src/app/ingreso/page.tsx:337–390` | Muestra éxito y ON_TIME antes del fetch; ignora rechazos y errores de red. No conserva durablemente ese envío online. | Persistir primero; mostrar pendiente; confirmar solo tras ACK transaccional |
| F03 | Crítica | `src/lib/mockData-exports.ts`; `src/lib/mockData.ts:120` | Log y deduplicación en arrays/Map por proceso; reinicios e instancias pueden producir pérdida o divergencia. Redis opcional solo cachea alumnos. | PostgreSQL, claves únicas y transacción de evento, proyección y ACK |
| F04 | Crítica | `src/lib/qrValidator.ts:37`; `src/app/api/attendances/scan/route.ts:88` | Cualquier firma de ocho caracteres pasa. La firma no está vinculada al estudiante. | Credencial opaca y firma asimétrica verificable, revocación y rotación |
| F05 | Crítica | `src/lib/auth.ts:8`; `src/middleware.ts:6`; login demo | Secreto JWT predecible si no hay variable; usuarios y contraseñas de ejemplo activos. | Cuentas reales; sin fallback en producción; sesiones revocables; eliminar acceso demo |
| F06 | Alta | `src/app/api/students/route.ts`; ruta scan | Padrón con nombres/DNI/guardianes accesible sin sesión y con caché pública. POST students también invalida caché sin permiso. Scan acepta escritura anónima. | Sesión + RBAC + terminal habilitada; mínimos datos; no-store en respuestas sensibles |
| F07 | Crítica | `src/lib/offlineQueue.ts:148–168` | 409 se toma como éxito aunque sea rechazo de negocio; tras tres fallos se borra el evento. No hay dead-letter real. | ACK explícito por ID/hash; estados recuperables y cuarentena sin descarte automático |
| F08 | Alta | `src/app/api/attendances/scan/route.ts:18–44,104,116,125` | Horario del servidor; cálculo con hora de recepción, aunque la fecha guardada sea offline. `is_burst` del cliente evita control de duplicado. | Reglas de dominio en servidor, timezone escolar, timestamps verificados y doble marcación transaccional |
| F09 | Alta | misma ruta; `src/types/attendance.ts` | No se bloquea SUSPENDED/GRADUATED; no hay dirección de paso explícita; turno EVENING cae en ON_TIME. | Política de matrícula/estado/calendario y eventos ENTRY/EXIT explícitos |
| F10 | Alta | `public/sw.js:45–76` | Cuando se activa, cachea GET same-origin, incluidas APIs/admin. Tras registrar manualmente el worker, estadísticas siguieron devolviendo 200 después de logout mientras la red devolvía 401. Por F23 no se activa automáticamente en el build probado. | Allowlist de assets; excluir auth/admin/API; shell offline versionado |
| F11 | Alta | `src/components/MultiScannerInput.tsx:117–214` | Dos handlers procesan los mismos keydown; prefijo puede llegar intacto al handler de input y el global quedar limitado por el mismo reloj. Rotar foco no identifica hardware. | Un único parser; un lector por terminal como base; integración por dispositivo si el hardware lo permite |
| F12 | Alta | `src/lib/offlineQueue.ts:26,128`; `PendingScan` | Al encolar se genera otro UUID y no se preservan lector/entrada; no hay bloqueo de sincronización entre intervalos/pestañas. | Evento único desde captura; contexto completo; lease local y servidor idempotente |
| F13 | Alta | `src/lib/auth.ts:85`; endpoints admin | Se verifica token, pero no permiso por operación. No hay rate limit de login ni revocación de sesión. | Matriz RBAC, validación de institución y estado; límites y auditoría |
| F14 | Media | `src/app/ingreso/page.tsx:276–277,567` | No tener alumno local se interpreta como offline aun con red; búsqueda manual usa MOCK_STUDENTS. | Diferenciar conectividad/caché/identidad; repositorio común de alumnos reales |
| F15 | Media | `src/app/api/admin/stats/route.ts`; reporte daily | Filtro por prefijo ISO/medianoche del host, sin calendario, matrícula activa ni cierre; salidas pueden contar como presencia. | Fecha escolar local y agregación diaria desde eventos válidos |
| F16 | Media | `src/app/api/students/route.ts:24` | X-Cache se calcula tras llenar la caché: reporta HIT incluso en primer acceso. | Medir el hit antes de resolver o devolver metadatos del adaptador |
| F17 | Media | `src/components/ScannerHub.tsx:96`; `ingreso/page.tsx:499` | Configurado se presenta como listo; useMemo no depende del tick y congela salud. Botón Probar genera una asistencia real demo. | Separar configuración, actividad y conexión comprobada; simulación sin efectos de dominio |
| F18 | Alta | `package.json`; `.github/workflows/deploy.yml` | Vitest 5.0.4 exige Node ^22.12 o ^24 o >=26 y tipos ^22 o >=24; CI usa Node 20 y el proyecto tipos 20. `npm ci --dry-run` falla con ERESOLVE. Script E2E sin dependencia/config de Playwright. | Toolchain alineada y lock reproducible, prueba E2E real, deployment gratuito separado |
| F19 | Media | `src/app/layout.tsx:25`; modal ScannerHub | Zoom bloqueado, modales sin contrato completo de foco/teclado; landscape/fullscreen asumidos. | WCAG 2.2 AA objetivo, zoom, foco, aria-live y modo responsive |
| F20 | Alta | `src/lib/email.ts`; endpoint email | Sin API key simula pero devuelve éxito; destinatario/contenido los decide el cliente autenticado. Interpolación HTML sin escape explícito. | Notificación in-app por defecto; estados delivered/simulated; destinatarios derivados del servidor y escape |
| F21 | Media | rutas JSON; scans `parseInt`; reporte date | JSON malformado acaba en 500; fechas y límites incompletamente validados; total representa la página, no todos los resultados. | Contratos versionados, 400/422, límites y paginación por cursor |
| F22 | Alta | repositorio completo | Sin migraciones, backups, restauración, auditoría durable, importación real, revocación QR, horarios editables ni gestión de matrícula. | Construir el núcleo operativo antes del piloto con menores |
| F23 | Crítica | `src/app/layout.tsx:38–43`; `src/lib/serviceWorkerRegistration.ts:2` | Serializar una función del bundle de servidor mediante toString permite que la optimización por typeof window borre su cuerpo. HTML servido: `(function r(){})();`; Chromium no registra SW. | Componente cliente explícito con useEffect, registro tras hidratación y comprobación E2E del build |
| F24 | Alta | `src/app/api/attendances/scan/route.ts:60–63` | Idempotencia ligada solo al ID global, sin hash, terminal ni actor. Reusar el ID con otro DNI devuelve el éxito del alumno anterior. | Clave acotada y hash canónico obligatorio; conflicto por reutilización incompatible |
| F25 | Media | `src/lib/pdf.ts:167,196–204` | El PDF funciona, pero exporta solo las primeras 80 marcaciones. Avisa del límite, aunque no ofrece exportación completa. Prueba con 100 filas: la 80 existe y la 81 no. | PDF completo paginado o límites explícitos con CSV completo consistente |
| F26 | Media | `src/app/api/health/route.ts` y salida del build | Next prerenderiza `/api/health`; timestamp y uptime corresponden al build. Dos peticiones de producción devuelven el mismo timestamp y X-Nextjs-Cache HIT. | Liveness/readiness dinámicas y no-store; no usarlas como caché de hora del servidor |
| F27 | Media | `src/app/admin/reports/page.tsx:14–28,130`; dashboard `fetchData`; layout logout | Resumen combina fecha seleccionada con estadísticas de hoy y destinatario hardcoded aunque el input cambie. El dashboard no limpia error tras recuperación; logout navega a JSON. | Snapshot por fecha y destinatario validado en servidor; estados recuperables y logout a login |
| F28 | Alta | `package-lock.json`; resultado npm audit | Auditoría de producción informa 3 paquetes afectados: next crítico, postcss transitivo alto y zod alto. No demuestra que todos los avisos sean explotables en esta app. | Actualizar a versiones mantenidas y evaluar cada aviso según superficie real; no usar audit fix --force sin revisión |
| F29 | Alta | `.github/workflows/deploy.yml:40–83` | Deploy arranca en otro job y no descarga build-output antes de copiar `.next`. El script remoto usa cp de un directorio sin -r y no actualiza public/config. | Artefacto verificado, transferencia coherente y despliegue atómico; retirar VPS del flujo gratuito |
| F30 | Alta | `src/app/admin/login/page.tsx:10,34` | `redirect` viene de la URL y se pasa directamente a router.push. En Chromium, un redirect javascript ejecutó un marcador inocuo en el DOM tras login. Permite ejecución de JS en el origen de la app si se induce a abrir ese enlace e iniciar sesión. | Allowlist de destinos internos, validación de protocolo/origen y regresión de esquemas peligrosos |

Las referencias con intervalos son ubicaciones orientativas del commit auditado. F11 incluye riesgo de colisión y atribución; no se afirma haber reproducido intercalado de lectores físicos. F10 se reprodujo registrando manualmente el SW para aislar su algoritmo: no se debe confundir ese procedimiento de auditoría con el comportamiento predeterminado, bloqueado por F23. F27 y F29 se establecen por lectura; no se envió correo ni ejecutó despliegue.

## 5. Reproducciones y validación

| Comprobación | Resultado observado | Qué demuestra y qué no |
|---|---|---|
| `npm run test:run` | 14/14, 3/3 archivos | Helpers probados; no acredita integración/PWA |
| `npm run typecheck` | Exit 0 | Consistencia estática; no persistencia |
| `npm run lint` | Exit 0, 2 warnings de `<img>` | No detecta los fallos de dominio |
| `npm run build`, seguido de `npm start` | Build y arranque correctos | Next 14.2.15; warning de importación dinámica Redis y los dos warnings de imágenes |
| `npm ci --dry-run --ignore-scripts --no-audit --no-fund` | ERESOLVE | Instalación estándar no reproducible sin corregir peers; dry-run no reemplaza dependencias |
| Crear caché alumnos v3 y después leer cola v2, con fake-indexeddb | VersionError | Incompatibilidad real entre módulos, sin depender de UI |
| `getPendingCount()` tras el error anterior | 0 | El error se oculta como cola vacía |
| GET anónimo `/api/students` | 200, 8 alumnos; Cache-Control público | Exposición del padrón demo |
| GET anónimo `/api/admin/stats` | 401 | Esa ruta sí comprueba autenticación |
| POST anónimo scan, DNI suspendido, firma `aaaaaaaa`, fecha 2099, `is_burst:true` | 200, ok:true, SUSPENDED | Acepta escritura anónima, firma arbitraria, estado suspendido y fecha futura |
| JSON malformado en scan | 500 | Clasifica un error del cliente como interno |
| POST anónimo `/api/students` | 200 | Invalida caché sin autorización |
| Tres sincronizaciones con fetch simulado 503 | El evento desaparece en el tercer intento | Reproducción de descarte sin depender de red real |
| Sincronización con 409 y cuerpo de rechazo | synced=1 y remaining=0 | Conflicto contado como éxito sin ACK de ese evento |
| Reusar client_scan_id con otro DNI | 200, idempotent:true, alumno anterior | No se verifica identidad del comando |
| Duplicado con nuevo ID e is_burst:true | 200 | Control de duplicado evitable por cliente |
| HTML producción y Chromium limpio | Función inline vacía; 0 registros SW | PWA offline no se habilita automáticamente |
| Worker registrado manualmente, login → stats → logout → stats | Worker 200; petición directa 401 | Caché privada persiste tras logout |
| Fixture de caché v3 en navegador y scan interceptado con 503 | UI conserva SUCCESS, Entrada registrada y PUNTUAL | Falso éxito online, aislado de F01; no supone que el flujo inicial de BD funcione |
| PDF con 100 scans sintéticos y extracción de texto | PDF de 3 páginas, solo 80 filas | PDF generado correctamente pero detalle incompleto |
| Health de producción, dos peticiones | Mismo timestamp, HIT | Prerenderización, no lectura de hora/uptime en vivo |
| `npm audit --omit=dev --json` | 3 paquetes: 1 crítico, 2 altos | Conteo de paquetes afectados, no de exploits demostrados |
| Login con redirect javascript de prueba | Login 200 y marcador DOM ejecutado | Ejecución de JS en el origen local; sin exfiltración ni acceso a servicios externos |

Los probes HTTP crearon registros demo en el proceso local de producción; uno tiene fecha futura y también se contó en estadísticas de hoy, pues el filtro carece de límite superior. No involucraron datos institucionales ni envíos a terceros. En Chromium nuevo la BD quedó en v2 mientras la inicialización intentaba v3; la reproducción aislada en orden v3→v2 produjo VersionError. Ambos comportamientos justifican migraciones y cierre de conexiones explícitos.

No se reinstalaron paquetes ni se ejecutó la pipeline remota. Entorno de revisión: Node 24.22.1, npm 11.9.0, Vitest 5.0.4 y Chromium 156. Las pruebas usan dependencias retenidas de la instalación con legacy-peer-deps; el dry-run actual confirma el conflicto. La auditoría incluye, entre otros, [bypass de autorización de middleware Next](https://github.com/advisories/GHSA-f82v-jwr5-mffw) y [validación de colecciones Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). El reporte agregado no autoriza a afirmar RCE en esta aplicación: varios avisos dependen de plataforma o funciones no utilizadas. Se requiere triage y actualización antes del despliegue.

### Cómo repetir los casos principales

1. Con las dependencias actuales instaladas, ejecutar test:run, typecheck, lint y build; después arrancar npm start. Completar el build antes de usar el mismo directorio `.next` como servidor.
2. En perfil nuevo, abrir `/ingreso`, inspeccionar IndexedDB y `navigator.serviceWorker.getRegistrations()`; comprobar también la función inline en el HTML. No borrar el perfil de un usuario para hacer este ensayo.
3. En un perfil de prueba con padrón v3 precargado, interceptar POST scan con 503 y seleccionar un alumno manualmente: observar que el resultado queda verde. El fixture evita que F01 oculte F02.
4. Para auditar F10, registrar expresamente `/sw.js` en ese perfil aislado, recargar, iniciar sesión demo y consultar stats. Tras logout, comparar la petición de página controlada por SW con una petición directa sin cookie: 200 frente a 401.
5. En un harness que importe los módulos reales con fake-indexeddb, crear caché v3 antes de consultar cola; sustituir fetch por 503 tres veces o por 409 una vez. No usar una base real ni reenviar eventos de alumnos reales.

Los scripts temporales de auditoría no se incorporan como una suite E2E que el proyecto todavía no tiene. El SDD exige convertir estas reproducciones en pruebas de regresión dentro de la futura implementación.

## 6. Revisión por dimensión

### Seguridad y privacidad

La separación middleware/API es parcial: proteger `/admin` no protege automáticamente `/api`. El cliente no puede decidir identidad de terminal, autorizaciones, validez de una credencial ni si se admite un duplicado. La cookie HttpOnly y el hashing son buenos puntos de partida, pero no compensan credenciales conocidas, secreto fallback y ausencia de permisos efectivos.

Para menores, nombres, fotos, DNI, horarios y datos de apoderados deben minimizarse y limitarse por rol. No cargar fotos reales en proveedores de avatares públicos ni enviar DNI a generadores QR externos. Definir responsable institucional, retención, acceso a copias, consentimiento/base aplicable, transferencias y eliminación; el marco peruano y la Ley 29733 requieren revisión institucional especializada, no una suposición de cumplimiento por usar HTTPS.

### Integridad y reglas escolares

Un scan, una asistencia diaria y una autorización de salida son conceptos distintos. Actualmente la hora determina una supuesta salida, y estar presente puede inferirse de cualquier scan. Hay que modelar matrícula vigente, fecha escolar, horario, tolerancia en minutos exactos, feriados, permisos, correcciones y responsables. Un carnet firmado evita fabricación, pero no que otra persona use una foto o copia; la verificación visual sigue siendo necesaria.

### Offline, recuperación y concurrencia

La durabilidad local debe existir antes de notificar captura. Ni `navigator.onLine` garantiza acceso al servidor ni un timeout demuestra que una transacción no ocurrió. El mismo evento debe poder repetirse sin duplicar, incluso después de un reinicio del servidor, expiración de sesión o cierre de pestaña. Una caché de alumnos vencida y una credencial revocada requieren resultado provisional y política explícita, nunca verde definitivo.

IndexedDB comparte origen, puede ser eliminado por el navegador o por el usuario y no equivale a backup. Son necesarios avisos de cuota, persistencia solicitada, exportación de pendientes, migraciones y recuperación. El SW necesita probarse en build de producción, incluyendo primera visita online, cierre completo, reinicio offline y actualización con cola pendiente.

### Rendimiento y capacidad

No hay evidencia de que ocho lectores o una cifra de peticiones por segundo estén soportados. El array se recorre/copia, los mocks viajan en el bundle y las estadísticas se recalculan sin índices. Antes de Redis se necesitan índices, consultas acotadas, paginación y transacciones. Un cuello de botella físico por intercalado HID no se resuelve con caché de servidor.

### UX y operación

La pantalla debe distinguir capturado localmente, pendiente, confirmado, rechazado y en revisión. “Probar lector” debe probar el dispositivo sin crear asistencia. Mostrar última lectura no prueba conexión USB. Las búsquedas manuales requieren motivo y operador; los cambios de entrada no deberían alterar identidad autorizada de una terminal desde localStorage.

### Calidad, entrega y mantenimiento

Los tests de cola solo guardan/leen; no sincronizan ni comparten BD con el padrón. La prueba QR acepta el mecanismo inseguro por diseño. Falta integración con base real, auth, fechas, carreras, restauración y E2E. Las promesas documentales de offline completo, deduplicación, hardware universal y escalabilidad deben sustituirse por capacidades verificadas. CI no debe desplegar automáticamente a un VPS pagado ni copiar una carpeta `.next` sobre un proceso activo sin despliegue coherente y rollback.

## 7. Prioridad de inversión sin servicios pagados

1. **P0 — datos confiables:** esquema IndexedDB único; outbox durable; PostgreSQL; transacción/idempotencia; UX de ACK.
2. **P0 — acceso seguro:** cuentas, permisos, terminales habilitadas, retirada de mocks y credenciales demo, protección del padrón.
3. **P1 — reglas reales:** credencial QR, revocación, horario Lima, entrada/salida, calendario y matrícula.
4. **P1 — operación verificable:** sincronización recuperable, pruebas de desconexión, backups/restauración y piloto por una entrada.
5. **P2 — gestión:** importación, correcciones auditadas, informes, accesibilidad y múltiples terminales.
6. **P3 — extras gratuitos opcionales:** Web Push, correo sujeto a cuota, analítica local agregada. Nunca bloquear asistencia por estas funciones.

El diseño recomendado y su backlog trazable están en el SDD. La restricción de presupuesto cambia el despliegue y los servicios auxiliares; no justifica aceptar pérdida de datos ni publicar menores sin control de acceso.
