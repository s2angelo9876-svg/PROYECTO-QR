# Implementación inicial del SDD y controles de seguridad

Fecha: 16 de noviembre de 2026 · Alcance: primera entrega técnica de la fase 1 y correcciones P0 previas. Referencia: [SDD mejorado](SDD_MEJORA_GRATUITA.md). El análisis anterior describe el commit previo a esta implementación y se conserva como evidencia histórica.

## Resultado y límites

Esta entrega prepara la base de desarrollo y el circuito local de captura sin contratar servicios. No convierte el prototipo en un sistema institucional listo para datos reales. El servidor sigue usando datos ficticios y memoria; PostgreSQL, cuentas institucionales, RBAC/RLS, carnets JWS, reglas escolares definitivas, backups del servidor y piloto con hardware pertenecen a las fases siguientes.

Estado de fase 0: inventario técnico, riesgos iniciales y comparación documental de proveedores disponibles. Censo real, responsables institucionales, reglas escolares, condiciones de una cuenta cloud y prueba de varios lectores por laptop siguen pendientes. No se inventaron esos datos ni se creó un servicio externo para sustituirlos.

## Cambios implementados

- Node 24 y npm 11 declarados; Next 16, React 19 y Zod 4; dependencias y lockfile alineados. Instalación sin legacy-peer-deps. ESLint usa configuración flat; el plugin React de Next declara compatibilidad con ESLint 9, por eso se mantiene la última versión compatible aunque npm avise que esa línea está deprecada. Revisar esa dependencia de desarrollo cuando el plugin admita la siguiente versión.
- Inicio de sesión con allowlist exacta de destinos. Nunca se entrega un esquema javascript/data o una URL externa a router.push.
- Registro del service worker desde un componente cliente, después de hidratación, compatible con carga ya terminada. Se elimina la serialización de funciones del servidor.
- Caché limitada al shell público `/ingreso` y assets públicos/compilados. APIs, administración, query/RSC y reportes quedan fuera; la activación elimina cachés anteriores de SCA-QR y conserva namespaces ajenos. El nuevo worker espera cierre de clientes, sin recarga automática durante una captura.
- IndexedDB v4 centralizada para padrón, pendientes, recientes, metadata y leases. Migraciones desde esquemas 1/2/3 parciales conservan IDs y datos. Eventos antiguos sin origen pasan a revisión; no se les inventa lector/entrada. Aperturas bloqueadas producen error visible y acotado, no cero pendientes.
- Toda captura admitida se guarda antes de enviar, con un UUID, timestamp original, terminal, lector, entrada y hash SHA-256 de la representación canónica v1.
- Reintentos con backoff y jitter, respeto de Retry-After, timeout y lease compartido entre pestañas. El vencimiento de un lease permite continuar tras un cierre. La idempotencia del servidor duradero sigue pendiente y será la última defensa entre instancias.
- Los 401 pausan la cola hasta reanudación explícita. Los conflictos y rechazos se conservan para revisión. No hay borrado automático después de tres errores ni clasificación de un 409 como sincronización correcta.
- Un ACK solo se admite si su estructura, ID y hash corresponden al comando original. El prototipo devuelve persistence=memory-demo; la UI muestra recepción demo y conserva el registro local, sin prometer persistencia institucional ni puntualidad definitiva.
- Los registros recibidos permanecen localmente junto al ACK. Exportación manual a JSON para conservar evidencia y pendientes; exportar no modifica su estado. La importación/restauración automatizada y los recibos firmados se implementarán con la fase de recuperación: este archivo es evidencia sensible, no un backup completo del sistema.
- Parser de teclado único, sin foco rotatorio ni doble manejador. Piloto por defecto de un lector; prefijos identifican frames completos, pero no aíslan lecturas físicas simultáneas. La prueba de sonido/pantalla no registra asistencia ni confirma conexión física.
- JWT sin secreto de respaldo, algoritmo/issuer/audience/expiración verificados. El demo requiere activación explícita en producción; las APIs ficticias devuelven 503 cuando está desactivado. Esto no reemplaza cuentas/roles reales.
- Límites de lectura del body antes de JSON/Zod para login y marcación; control de Origin en esas mutaciones; respuestas sensibles no-store y cabeceras contra MIME sniffing, framing y fuga de referrer. No se afirma una CSP completa en esta fase.
- Correo externo deshabilitado por defecto; la UI no simula una entrega real ni consulta proveedores para enviar mensajes.
- Health dinámico, sin timestamp de compilación. Se retira el despliegue SSH a VPS de CI; solo se ejecutan comprobaciones. No se publica ni fusiona a main desde este trabajo.

## Ejecución local gratuita

Desde la carpeta del repositorio, en Windows, Linux o macOS:

```bash
node --version
npm --version
npm ci
node scripts/setup-demo.mjs
npm run dev
```

Se requiere Node 24.x y npm 11.x; `.nvmrc` registra la versión usada. El helper genera un secreto aleatorio en `.env.local`, no lo imprime y se niega a sobrescribir un archivo existente. Si ya hay configuración local, revisar de forma segura SCA_DEMO_MODE y JWT_SECRET; no pegar secretos en chat, tickets o Git.

Para comprobar el build:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm start
```

No ejecutar dev y build sobre la misma carpeta `.next` al mismo tiempo. La configuración de CI realiza las mismas comprobaciones, añade Chromium y ejecuta E2E contra el build de producción. En máquinas sin Chromium instalado:

```bash
npx playwright install chromium
npm run test:e2e
```

El launcher E2E genera un secreto efímero y habilita el demo solo en su proceso local. En este entorno cloud, los comandos npm necesitan `--cache /workspace/.npm-cache` para no escribir en el HOME restringido; esa ruta no es un requisito en el PC del usuario.

## Evidencia de validación local

Entorno: Node 24.22.1, npm 11.9.0, Next 16.4.6, React 19.3.1, Zod 4.6.7 y Chromium del sistema.

| Comprobación ejecutada | Resultado |
|---|---|
| npm ci sin legacy-peer-deps | Instalación limpia correcta; aviso de deprecación de ESLint 9 explicado arriba |
| npm run lint | Sin errores ni advertencias |
| npm run typecheck / chequeo TypeScript del build final | Correctos |
| npm run test:run | 56 pruebas, 7 archivos; todas aprobadas |
| npm run build | Compilación de producción correcta, sin el import dinámico Redis anterior |
| npm run test:e2e | 6 pruebas Chromium contra npm start; todas aprobadas |
| npm audit --omit=dev --audit-level=high | 0 vulnerabilidades conocidas reportadas en dependencias de producción |

Casos probados: migraciones 1/2/3 y apertura bloqueada recuperable; cuota de 5.000 pendientes sin sobrescribir; 401/403/409/422/429/503; ACK con ID/hash/alumno incorrecto; lease y llamadas concurrentes; copia local tras cierre/reapertura; límite de recientes sin borrar originales; canal de correo deshabilitado. En navegador: SW registrado automáticamente, arranque offline frío y reconexión, error 503 sin falso éxito, redirect seguro, logout sin caché privada, health dinámico, prueba de hardware sin asistencia y un frame prefijado convertido en un solo comando.

La validación de teclado es sintética, no de varios USB físicos. No se midieron p95/carga escolar, cuota real del navegador en hardware objetivo, restauración institucional, Redis, proveedor cloud ni correo externo. El workflow queda versionado; no se afirma un resultado de GitHub Actions remoto no observado. La auditoría de paquetes es una fotografía, no una certificación de seguridad.

## Controles alineados con ISO/IEC 27001/27002

La tabla es una selección de referencia para esta fase, no una declaración de conformidad, certificación ni una Declaración de Aplicabilidad institucional aprobada. Los nombres son resúmenes; el colegio deberá revisar alcance, riesgos y texto oficial aplicable.

| Referencia orientativa | Aplicación en esta entrega | Evidencia y estado |
|---|---|---|
| 27001 6.1, riesgos y tratamiento | Registro inicial, prioridades y riesgos residuales | Tabla de riesgos de este documento; responsables institucionales pendientes |
| A.5.9, inventario | Inventario de activos, datos y flujos | Tabla siguiente, basada en código y documentación |
| A.5.15/A.8.3, control/restricción de acceso | Redirect seguro, APIs demo desactivadas por defecto en producción | Unitarias y E2E; RBAC/RLS institucional pendiente |
| A.5.17/A.8.5, autenticación | Secreto independiente, sin fallback; validación de claims y salida de sesión | Tests de token y login; MFA, recuperación y revocación duradera pendientes |
| A.8.8, vulnerabilidades | Actualización de dependencias de producción y auditoría | npm audit de la revisión; cero avisos conocidos no garantiza ausencia de vulnerabilidades |
| A.8.9, configuración | Node/npm declarados, lockfile, plantilla sin secreto JWT, helper que no sobrescribe | npm ci, CI y revisión Git |
| A.8.13/A.5.30, copias y continuidad | Outbox persistente, exportación manual, recuperación de lease y migraciones no destructivas | Parcial: no hay backup/restauración de PostgreSQL ni RPO/RTO institucional validados |
| A.5.34, privacidad | No cachear sesiones/API/admin; avatares demo locales y no-store | E2E logout/caché; política de menores, retención y base legal pendientes |
| A.8.24, criptografía | Hash canónico SHA-256 y firma JWT | Hash detecta cambio de comando, no acredita identidad del alumno; JWS de carnets pendiente |
| A.8.25/A.8.28/A.8.29, desarrollo y pruebas seguras | Contratos compartidos, límites, regresiones de fallos y navegador | Suites versionadas y resultados de verificación |
| A.8.31/A.8.32, separación/cambios | Demo explícito, fixtures, CI sin despliegue y commit revisable | No se habilitan cuentas/servicios productivos |
| A.5.37, procedimientos | Operación ante cola bloqueada, actualización y custodia de exportación | Runbook de esta entrega; responsables por designar |

## Inventario inicial y clasificación propuesta

| Activo | Datos/función | Tratamiento en fase 1 |
|---|---|---|
| Código y contratos | Reglas y estructura del prototipo | Versionado y revisión; sin secretos |
| Padrón demo | Nombres/DNI ficticios y referencia de alumno | No sustituir por datos reales antes de fase 2/privacidad |
| IndexedDB | QR, eventos, IDs, contexto y ACK | Tratar como confidencial en una futura instalación real; perfil protegido, sin limpieza automática |
| Exportación JSON | Copia de eventos y recibos locales | Sensible; custodia institucional, sin subirla a Git ni compartir públicamente |
| JWT_SECRET/cookie | Información de autenticación | Secreto local fuera del repositorio y cookie HttpOnly; cuentas demo no son cuentas institucionales |
| Cache Storage | Shell y JS/CSS/iconos/sonidos | Solo assets públicos; datos privados prohibidos |
| CI y evidencias E2E | Resultados y trazas con datos de prueba | Sin PII real ni credenciales productivas; retención acotada de artefactos |
| Laptop/lector/red | Captura y disponibilidad física | Existencia/modelos y custodia deben confirmarse con el colegio |

## Registro inicial de riesgos y tratamiento

| Riesgo | Tratamiento técnico actual | Riesgo residual / siguiente acción | Responsable requerido |
|---|---|---|---|
| Pérdida por desconexión o rechazo | Persistir primero, ACK verificable, sin descarte automático | Disco/perfil puede perderse; exportación y futura restauración | Operación escolar y desarrollo |
| Pérdida por reinicio del servidor | Retener copia local y señalar servidor demo | Memoria no es BD; PostgreSQL transaccional en fase 2 | Desarrollo/operación |
| Acceso indebido o suplantación | Guardas demo, JWT configurado, redirect seguro | QR sigue siendo simulación, sin cuentas/RBAC reales | Desarrollo y responsable institucional |
| Exposición de datos tras logout | Exclusión de caché privada y purga del namespace antiguo | Clientes viejos pueden conservar SW anterior hasta cerrarse | Operador de terminal |
| Cambio de contenido con mismo ID | Hash canónico y conflicto por payload incompatible | Estado solo de proceso; no cubre reinicio/múltiples servidores | Desarrollo, fase 2 |
| Pérdida/robo de terminal | Minimización inicial y no guardar tokens dentro de eventos | Disco/perfil sin protección del SO siguen accesibles | Custodio de equipos |
| Caída/cuota de proveedor gratuito | Ningún proveedor nuevo requerido para esta entrega | Verificar cuenta y capacidad antes de desplegar | Institución/operación |
| Confusión de lector físico | Un parser y piloto de un lector | Varios HID pueden intercalar caracteres; requiere spike/adaptador | Operación y desarrollo |

No asignar a una persona ficticia ni declarar estos riesgos aceptados. El colegio debe nombrar responsables y decidir tratamiento/aceptación antes de usar datos reales.

## Runbook de esta fase

1. **Fallo de red/503:** mantener el perfil; comprobar pendientes, exportar copia y reintentar después de recuperar servicio. No cambiar ID ni borrar el evento para obtener un verde.
2. **401:** iniciar sesión demo configurada y reanudar explícitamente. La cola permanece guardada. Un 403/409 requiere revisión; no se reenvía automáticamente.
3. **Actualización bloqueada:** cerrar todas las pestañas/ventanas instaladas de SCA-QR y abrir la versión nueva. No borrar IndexedDB para resolver un bloqueo. Si no se puede capturar, usar la planilla de contingencia.
4. **Cola llena o fallo de almacenamiento:** la pantalla no confirma guardado; exportar si es posible, conservar el perfil y avisar al responsable. No sobrescribir registros antiguos.
5. **Exportación:** guardar en ubicación protegida, con acceso restringido y cifrado institucional cuando contenga datos reales. Exportar no libera la cola ni demuestra restauración. Importación administrativa firmada/validada queda para la fase correspondiente.
6. **Cambio de equipo/origen:** no asumir que IndexedDB acompaña a Git, a la cuenta o a un dominio nuevo. Inventariar/exportar antes de mover la terminal y planificar recuperación supervisada.
7. **Sospecha de secreto comprometido:** desactivar demo/exposición, preservar evidencias sin registrar el valor y sustituir el secreto mediante canal seguro. La cuenta/credencial real y su revocación durable se implementarán en fase 2.

## Trazabilidad y siguiente fase

| Hallazgo | Estado de esta entrega |
|---|---|
| F01, F07, F12, F23, F30 | Correcciones de esquema, retención, contexto, registro SW y redirect implementadas; validar con las suites de esta entrega |
| F02 | UI y outbox corregidas para diferenciar pendiente/recepción demo; persistencia institucional depende de F03 |
| F10 | Caché privada excluida en el nuevo worker; requiere cierre/actualización de clientes antiguos |
| F05, F06, F13 | Mitigación de configuración/exposición demo; cuentas institucionales, permisos y revocación pendientes |
| F11, F17 | Parser único, etiquetas honestas y prueba sin marcación; aislamiento físico de varios lectores pendiente |
| F18, F28, F29 | Toolchain/lock/CI actualizados; auditar periódicamente, sin despliegue a VPS |
| F24 | Conflicto de contenido y repetición consistentes dentro del proceso demo; transacción duradera pendiente |
| F26 | Health dinámico implementado |
| Otros hallazgos | No se declaran cerrados por esta entrega |

Siguiente entrega: PostgreSQL con migraciones, usuarios/roles reales, autorización de terminales y transacción durable de evento/recibo/proyección. Antes del piloto se necesita además completar reglas escolares, QR firmado, backups/restauración y validación de hardware. Todo puede desarrollarse con software libre; elegir un plan cloud gratuito requiere comprobar cuenta, cuota y continuidad.
