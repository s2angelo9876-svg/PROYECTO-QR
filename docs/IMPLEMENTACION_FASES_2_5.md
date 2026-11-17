# Implementación técnica de fases 2–5

Fecha: 16 de noviembre de 2026, America/Lima. Entrega sobre la fase 1 existente; rama de desarrollo `work`. El trabajo incluye software, configuración local, pruebas y documentación. No equivale a aceptación del colegio, despliegue público ni certificación ISO.

## Decisión de arquitectura y costo

Se implementa la alternativa local del SDD: Next.js 16/React 19 con API Node, PostgreSQL 17 en un equipo existente y PWA. PostgreSQL, Docker Engine, Public Sans, Lucide, bibliotecas criptográficas y las herramientas de pruebas no requieren una suscripción de aplicación. No se han contratado servicios ni habilitado facturación. Correo, SMS, analítica y servicios de IA están fuera de la operación implementada.

La nube gratuita original permanece como alternativa pendiente de capacidad y elegibilidad. La medición estructural de 100.000 eventos y recibos ocupa aproximadamente 292 MiB; la extrapolación a 880.000 eventos/año supera 2,5 GiB. No cabe en los 500 MiB considerados para Supabase Free. No se aplica una purga para ocultar esa diferencia. La ruta local necesita disco, conectividad y una persona responsable; no promete que esos recursos carezcan de costo.

## Fase 2: persistencia, identidad y permisos

- Migraciones SQL aditivas en `db/migrations/`: colegio, usuarios, sesiones, alumnos, matrículas, calendario, reglas históricas, credenciales, claves, terminales, lectores, eventos, proyección diaria, recibos, decisiones, avisos, auditoría, importaciones e instantáneas.
- `sca_runtime` carece de superusuario y bypass RLS. Cada transacción fija ámbito escolar y request ID. Claves y referencias compuestas impiden relaciones entre colegios. Funciones de autenticación con permisos explícitos, sin registro público.
- Contraseñas bcrypt con costo 12, cambio inicial obligatorio, JWT HttpOnly/Secure/SameSite en producción y sesiones consultadas en base en cada autorización. Desactivación, cambio de contraseña y recuperación revocan sesiones. No se usan contraseñas demo en modo institucional.
- Roles: administración, dirección, secretaría y portería. Los endpoints validan rol; portería solo autoriza terminales asignadas. Roles y sesiones de JWT no sustituyen el estado actual en base.
- Idempotencia durable por terminal/evento y hash canónico. Un advisory lock serializa un recibo antes de que exista su fila. La proyección se crea con ON CONFLICT y después se bloquea FOR UPDATE, incluyendo el primer evento del día.
- Evento, proyección, recibo firmado y auditoría se confirman en una transacción. Un fallo del recibo revierte las otras escrituras. Un replay devuelve el recibo original; otro contenido con el mismo ID genera 409. Rechazos y revisiones conservan su recibo.

Archivos centrales: `src/lib/db.ts`, `institutionAuth.ts`, `institutionApi.ts`, `institutionScan.ts`, `scanContract.ts`. Las APIs ficticias se deshabilitan cuando existe conexión institucional; un error de la base no activa los mocks.

## Fase 3: jornada, QR, terminales y sincronización

La fecha escolar usa America/Lima, con ENTRY/EXIT explícitos. Los horarios tienen tolerancia entera y días semanales; los cambios conservan versiones y se selecciona la regla vigente al capturar. El calendario puede declarar días no lectivos. Los reportes muestran “sin registro” antes del cierre y ausencia después, únicamente para jornadas lectivas y matrículas vigentes.

La puntualidad se clasifica con precisión de segundos completos: para 07:00 y diez minutos, 07:10:00 se acepta como puntual y 07:10:01 se clasifica tarde. Una entrada temprana no se confunde con salida anticipada. Se mantienen hora declarada, recepción, origen y desfase observado; no se reemplaza el dato original con la hora de sincronización. Los valores iniciales de política incluyen ventana de entrada una hora antes del inicio, revisión fuera de jornada, futuro mayor a dos minutos y desfase mayor a dos minutos; datos con más de 72 horas pasan a revisión. Son reglas iniciales que debe validar el colegio.

Los carnets son `SCA1:` seguido de JWS ES256, con issuer escolar, kid confiable, jti aleatorio, iat y exp. No contienen nombre, documento ni teléfono. El backend valida firma, emisor, vigencia y estado en base. Las credenciales revocadas no se reactivan; rotar claves conserva las públicas anteriores. Una firma estática puede copiarse y portería debe cotejar identidad.

Los permisos de terminal duran ocho horas y vinculan colegio, operador, terminal y dirección. Los lectores y la entrada se verifican en servidor. `captured_by` y `submitted_by` se conservan por separado. El snapshot mínimo distribuye únicamente claves públicas; las privadas quedan en el backend. Los recibos usan una clave separada de QR y permisos.

La cola conserva comandos y recibos, usa lease para varias pestañas, reintentos acotados por pasada, Retry-After y pausa ante 401. El ACK se vincula a ID/hash/credencial y su firma completa se verifica antes del verde. Revisiones y rechazos tienen estados distintos; una resolución adicional firmada permite cerrar la incidencia local sin cambiar el recibo original ni borrar evidencia. Las claves públicas rotadas se recuperan por una API autenticada.

El endpoint batch limita 20 eventos, los ordena y usa una transacción por evento. La implementación inicial procesa secuencialmente para preservar el orden, dentro del límite de concurrencia máximo previsto. No se declara que un lote completo sea atómico.

HID: un flujo de teclado por estación. Web Serial: parsers y streams independientes para lectores configurados. Las pruebas intercalan chunks de dos canales y verifican framing, longitud y timeout. No se ha probado un lector físico ni se garantiza que lectores exclusivamente HID puedan convertirse en seriales. Ese gate de hardware permanece abierto.

## Fase 4: diseño y operación

El panel incorpora navegación lateral, resumen de jornada, histograma de entradas reales, registro paginado, alumnos y matrículas, importación CSV con vista previa/confirmación, carnets, incidencias, reportes, avisos, auditoría y configuración. Usa superficies claras, un acento verde, cifras tabulares, Public Sans autoalojada y una familia de iconos Lucide. No se inventan porcentajes de crecimiento ni disponibilidad de dispositivos. Fixtures y demo se identifican como sintéticos.

Los formularios tienen etiquetas asociadas, estados de carga/error/vacío, foco visible y comportamiento por teclado. La navegación se adapta a móvil; las tablas se desplazan dentro de su región. El movimiento se limita a respuestas breves y respeta reduced-motion. El manifiesto permite orientación móvil y modo standalone.

CSV: máximo 5.000 filas/2 MB, columnas exactas, referencias del colegio, códigos únicos, preview completa validada y confirmación idempotente por lote. Las exportaciones neutralizan fórmulas de hojas de cálculo. Los cambios se auditan.

Registro manual: administración/secretaría y portería con su permiso de terminal asignada, fecha y hora explícitas en Lima, motivo requerido y borrador recuperable con el mismo ID. Se conserva un recibo firmado antes de cerrar el borrador. Dirección/administración acepta/rechaza revisiones o justifica un día sin presencia; la decisión añade before/after y responsable. Los eventos originales permanecen inmutables.

Reportes: una transacción con snapshot consistente genera todas las filas de matrícula, resumen, ID y SHA-256. PDF y CSV reutilizan esa instantánea; la descarga completa no depende de la paginación del panel y supera el antiguo límite de 80 filas. Las instantáneas previas no cambian después de una corrección.

PWA: solo shell y assets públicos compilados, incluidas fuentes. APIs, panel, sesiones y reportes no se almacenan en Cache Storage. Actualizaciones esperan una acción explícita o el cierre de clientes; no hay recarga forzada durante captura.

## Fase 5: seguridad, recuperación y evidencias

Las copias de PostgreSQL usan un snapshot consistente y cifrado AES-256-GCM con scrypt, sin dump claro durante la creación. La restauración aislada compara conteos y huellas de todas las tablas antes de habilitar permisos. Conserva claves de firma, usuarios, sesiones, evidencias e historial. No sustituye automáticamente la base activa.

La copia local institucional usa AES-GCM/PBKDF2 y contraseña separada, en bloques de hasta 5.000 capturas. La importación preserva IDs/hash; los ACK importados requieren reconciliación. El servidor solo reconstruye una confirmación firmada cuando mantiene el contexto y el resultado coincide. Si falta contexto crea un caso visible para administración, sin inventar asistencia ni emitir un ID nuevo. Una firma cuya clave no está en el respaldo requiere recuperar esa clave institucional.

CSP: nonce en administración y hashes de scripts del build en el shell público; sin scripts externos. Se mantiene estilo inline para el layout de React/gráficos. La ruta local usa la distribución completa de `next build`/`next start`, que contiene el HTML usado para calcular hashes. Headers adicionales restringen framing, MIME, referer y capacidades. Login y operaciones tienen límites PostgreSQL; los contadores se confirman aunque falle la operación de negocio. No dependen de Redis.

Evidencias agregadas, sin contraseñas ni claves, en `docs/evidencia/`:

- `instalacion.json`: instalación desde un clúster nuevo, RLS y separación de credenciales.
- `captura-concurrente.json`: 100 capturas reales de dominio, ocho workers, todas confirmadas; excluye HTTP, navegador, red y hardware.
- `capacidad.json`: 100.000 eventos/recibos estructurales, tamaños e índice/EXPLAIN; no es una historia escolar válida ni una validación de firmas de esos registros masivos.
- `restauracion.json`: restauración aislada y huellas coincidentes; su tiempo de prueba no es un RTO institucional.

La suite incluye 82 pruebas de lógica/almacenamiento/criptografía, 14 de PostgreSQL, seis E2E demo y nueve E2E institucionales. Verificar los resultados finales en CI y en el resumen de la entrega; los números deben actualizarse si cambia la suite. Se comprobaron lint, TypeScript, build y auditoría de dependencias de producción sin vulnerabilidades conocidas en la ejecución registrada.

El [registro final de verificación](evidencia/verificacion-final.json) resume las 111 pruebas aprobadas en el entorno de desarrollo. El sistema visual implementado se documenta en [DESIGN.md](../DESIGN.md), con capturas y comprobaciones de foco, menú móvil y desbordamiento en `.impeccable/review/`.

## Trazabilidad orientativa con ISO/IEC 27001 y 27002

Los identificadores del Anexo A de 27001:2022 sirven para ubicar controles; no son una declaración de conformidad ni sustituyen el texto normativo o un análisis institucional.

| Control                     | Medida implementada                                                                  | Evidencia                                   | Responsabilidad institucional pendiente                       |
| --------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------- |
| A.5.9 / A.8.9               | Configuración explícita, terminales/lectores y reglas versionadas                    | Migraciones, configuración, auditoría       | Inventario físico y responsables                              |
| A.5.15–A.5.18 / A.8.2–A.8.5 | Roles, RLS, ámbito escolar, cuentas personales, sesiones revocables y cambio inicial | Pruebas de denegación y aislamiento         | Revisión periódica de accesos y altas/bajas                   |
| A.8.24                      | QR, permisos y recibos con claves separadas; copias cifradas                         | Vectores alterados/revocados y restore      | Custodia, rotación de emergencia y entrega de claves          |
| A.8.15–A.8.16               | Eventos/recibos/auditoría inmutables, request ID y correcciones append-only          | Tests de mutación y rollback                | Revisión de alertas e incidentes                              |
| A.8.13 / A.5.30             | Dump consistente, restore aislado, conciliación por hash y firma                     | Huellas y recuperación del evento original  | Dos copias externas, frecuencia, RPO/RTO y simulacro          |
| A.8.8 / A.8.25–A.8.29       | Dependencias actualizadas, validación, límites, CSP y pruebas de seguridad           | Auditoría npm y CI                          | Parches recurrentes y evaluación del riesgo                   |
| A.8.31–A.8.33               | Bases aisladas y datos sintéticos; rama de desarrollo sin deploy automático          | Scripts de test y workflow                  | Separación operativa de cuentas/equipos                       |
| A.5.24 / A.5.34             | Procedimientos de recuperación y minimización de PII                                 | Guía operativa, QR opaco, logs sin secretos | Base legal, privacidad, conservación y respuesta a incidentes |

No se ejecutan correos, purgas automáticas ni transferencias a proveedores. Las cláusulas organizativas del SGSI —alcance, evaluación de riesgos, aprobación de tratamientos, formación, auditoría interna y mejora— requieren responsables y decisiones del colegio. Se pueden desarrollar sin contratar servicios técnicos de pago; una certificación externa no forma parte de esta entrega.

## Puertas de aceptación que siguen abiertas

1. Censo, reglas, excepciones, retención y privacidad aprobados por la institución.
2. Validación de cada lector, sistema operativo, modo serial y legibilidad de carnets impresos.
3. HTTPS y permisos del sistema operativo comprobados para cualquier operación entre varios equipos.
4. Dos copias institucionales independientes y un simulacro con pendientes de todas las terminales.
5. Piloto de cinco jornadas, revisión de incidentes y acta de aceptación.

Estas puertas no bloquean la implementación local, pero impiden afirmar que el sistema ya está aceptado para datos reales o que se completó el SGSI.
