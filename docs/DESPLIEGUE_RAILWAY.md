# Preparación y despliegue en Railway

17 de noviembre de 2026, America/Lima. Código en la rama `work`. La preparación técnica no equivale a un despliegue en Railway.

## Revisión de la cuenta y del destino — 17 de noviembre

Revisión de solo lectura a las 09:43, America/Lima, mediante el plugin Railway. El proyecto indicado sí existe y es el más reciente de los dos visibles: `adventurous-rejoicing` (`901ba0b1-7151-451e-bdb7-cf1c3a279614`), en el espacio `Seynng09's Projects`. El entorno solicitado es `production` (`d3af507f-f13e-48e3-9263-5b2275ebef60`); ese nombre no acredita aceptación para datos reales.

- Único servicio: `PROYECTO-QR` (`a802f7ca-eb8f-4f02-a850-38fbd6b911b2`), conectado a `s2angelo9876-svg/PROYECTO-QR`, rama **`main`**, con Railpack. No tiene variables, dominio público, proxy TCP ni volumen. No hay PostgreSQL, buckets ni cambios pendientes en el entorno.
- Último despliegue: `9ad71433-2945-453f-9724-e5f530be246f`, estado **FAILED**, iniciado el 17 de noviembre a las 08:59:42, America/Lima. El log de build bloquea `next@14.2.15` por CVE-2025-55184 y CVE-2025-67779. Este fallo corresponde al origen `main`; no es una prueba del Dockerfile de `work`.
- La rama remota `work` se comprobó en `a3aa808abbdf52f2cc6f43774c0bedf4a45af4ea`, con Next `16.4.6`, Dockerfile y `railway.toml` preparados. No se rehizo el rediseño ni se mezclaron ramas.
- **Presupuesto sin verificar:** las herramientas disponibles del plugin no exponen plan, saldo, vencimiento de créditos ni un límite efectivo sin cobro. El panel del navegador requiere una sesión adicional que no quedó disponible. No se puede afirmar que la cuenta exija pago ni que permita este despliegue sin cargos.

Por la condición de costo cero, se detuvo el despliegue antes de modificar Railway. No se ejecutó Railway Agent, no se crearon servicios o dominios, no se ejecutó el bootstrap y no se activaron facturación ni planes. No existe una URL pública del servicio que se pueda entregar como operativa. Esta revisión no ejecutó pruebas HTTP, de PostgreSQL ni de la aplicación remota.

Para continuar, verificar primero el plan y los créditos del espacio propietario, su vencimiento y el mecanismo que impide cargos. Si requiere pago o no garantiza el límite, conservar la ruta local. Si supera esa comprobación, continuar sobre el servicio existente con `work` y el Dockerfile, aprovisionar PostgreSQL 17 dedicado con volumen y ejecutar el instalador desde mantenimiento. Obtener cualquier acceso faltante mediante inicio de sesión seguro o secretos del entorno, nunca por chat ni Git. Mantener la conexión administrativa fuera del servicio web y configurar allí únicamente la conexión `sca_runtime` y sus variables de ejecución.

Los respaldos remotos con restauración probada, los lectores físicos y el piloto institucional siguen pendientes antes de usar datos reales. El registro de esta revisión es documental; no sustituye las comprobaciones de despliegue previstas más abajo.

## Qué está preparado

- `Dockerfile`: Node 24, build completo de Next, dependencias de producción y ejecución sin root. Se conservan el HTML y los recursos requeridos por CSP y la PWA.
- `.dockerignore`: excluye configuración privada, claves, copias, datos locales y herramientas de diseño.
- `railway.toml`: Docker, healthcheck `/api/ready` y reinicios acotados. La imagen arranca con el puerto `PORT` de Railway y escucha en `0.0.0.0`.
- `SCA_PUBLIC_ORIGIN`: origen HTTPS público explícito para comprobar Origin y generar redirecciones detrás del proxy. No se autoriza un dominio por confiar en `Host` o `X-Forwarded-Host` enviados por el cliente.
- `npm run setup:database`: inicialización de un clúster PostgreSQL dedicado y vacío, sin contenedores locales. Crea una institución sin alumnos ficticios, credenciales iniciales aleatorias, claves separadas y una cuenta `sca_runtime` sin superusuario, creación de roles o bypass RLS. Rechaza una institución ya inicializada.

## Condición de costo cero

La restricción vigente es no contratar servicios de pago. Antes de crear servicios, revisar en la cuenta Railway el plan, los créditos disponibles, su vencimiento, el uso previsto de aplicación/PostgreSQL/disco/red y si existe un mecanismo efectivo para detener consumo sin cobrar. No añadir una tarjeta, cambiar de plan ni activar un cargo como parte implícita del despliegue. Si la cuenta exige pago o no permite garantizar el límite acordado, detener el despliegue y conservar la ruta local gratuita.

Los créditos de prueba o promociones no prueban que el sistema pueda permanecer alojado gratis. La aplicación y PostgreSQL deben estar disponibles durante la jornada; una suspensión afecta API y sincronización. La cola local conserva capturas bajo las condiciones y vigencia documentadas, pero no sustituye un servidor disponible ni habilita captura ilimitada.

Consultar las condiciones vigentes en [Railway Pricing](https://railway.com/pricing) y [planes](https://docs.railway.com/reference/pricing/plans). Durante la preparación inicial el proxy del entorno rechazó acceso directo a Railway y a su API. La revisión posterior descrita arriba pudo leer el proyecto mediante el plugin, pero sigue sin verificar plan y créditos. No se consigna una cuota como si hubiera sido comprobada.

## Cuenta y acceso del operador de despliegue

Usar la cuenta Railway con acceso al repositorio `s2angelo9876-svg/PROYECTO-QR` y al proyecto existente indicado arriba; no crear otro proyecto para continuar esta instalación. El acceso del despliegue debe configurarse mediante una conexión de Railway disponible o un secreto seguro del entorno, nunca pegando credenciales en el chat o en Git.

Para crear un proyecto desde CLI se necesita una sesión de cuenta o un token de cuenta con permisos adecuados; un token limitado a un proyecto existente no resuelve la creación inicial. La API que requiere acceso es `https://backboard.railway.app/graphql/v2`; la cuenta y sus condiciones se revisan antes de arrancar servicios. Si el entorno deniega ese destino, habilitarlo desde los ajustes de red del entorno y verificar una conexión nueva. Esta entrega no modifica la política de red ni publica una nueva configuración del entorno.

## Orden de una instalación nueva

1. Verificar el presupuesto y la cuenta. Para esta continuación usar el proyecto existente indicado arriba. Solo en una instalación distinta sin proyecto se crea uno vacío dentro del espacio de trabajo correcto. No reutilizar ni alterar la base de otro sistema.
2. Crear un servicio PostgreSQL dedicado con almacenamiento persistente. Registrar versión y límites; PostgreSQL 17 es la referencia probada. Este paso consume los recursos o créditos que indique Railway.
3. Inicializar desde un equipo de mantenimiento autorizado, usando la URL de mantenimiento proporcionada por Railway y una conexión alcanzable. No ejecutar `setup:local` en Railway: intenta crear un contenedor Docker y corresponde a la instalación local.
4. Crear el servicio web desde GitHub, seleccionar rama `work` y el `Dockerfile` del repositorio. Generar su dominio HTTPS; completar las variables antes de promover un despliegue como operativo.
5. Comprobar `/api/ready`, acceso inicial, cambio obligatorio de contraseña, alumnos, carnet, terminal, captura, corte de red y reporte. Definir copias independientes y verificar restauración antes de utilizar datos reales.

## Inicialización sin publicar secretos

En el clon del repositorio, con Node 24 y `npm ci`, crear manualmente un archivo privado `var/railway-admin.env`. Proteger su acceso y rellenarlo fuera del chat:

```dotenv
MIGRATION_DATABASE_URL=URL_DE_MANTENIMIENTO_DE_POSTGRESQL
SCA_SETUP_OUTPUT_DIR=var/railway-bootstrap
SCA_SCHOOL_NAME=Nombre de la institución
SCA_RUNTIME_DATABASE_HOST=DOMINIO_PRIVADO_DEL_SERVICIO_POSTGRESQL
SCA_RUNTIME_DATABASE_PORT=5432
```

La URL de mantenimiento debe ser alcanzable desde el equipo que ejecuta el comando. Cuando se inicializa fuera de Railway, usar la conexión pública/túnel autorizada que proporcione la plataforma y su configuración TLS verificada; no desactivar la validación de certificados. El host privado solo se usa para generar la conexión que utilizará la aplicación dentro de Railway. Si el instalador se ejecuta en esa red privada, puede usar una URL de mantenimiento privada.

```bash
node --env-file=var/railway-admin.env scripts/bootstrap-database.mjs
```

El instalador no sobrescribe el directorio de salida y no reinicializa una institución existente. Un fallo deja los archivos para revisión privada; no borrar ni regenerar claves de una institución activa para forzar un reintento. Las migraciones ya confirmadas permanecen en su ledger; investigar la causa antes de repetir.

El directorio generado contiene:

| Archivo           | Uso                                                                     |
| ----------------- | ----------------------------------------------------------------------- |
| `runtime.env`     | Variables exclusivas del servicio web, incluida su URL restringida.     |
| `maintenance.env` | Acceso de mantenimiento y school ID; custodiar fuera del servicio web.  |
| `bootstrap.txt`   | Acceso temporal de `admin`; cambiar la contraseña en el primer ingreso. |
| `backup.key`      | Cifrado de copias; guardar una copia separada de los respaldos.         |

En Railway configurar las variables del servicio web desde `runtime.env` mediante el editor seguro de variables. Añadir `SCA_PUBLIC_ORIGIN=https://DOMINIO_REAL_DEL_SERVICIO`, sin una ruta. Si se cambia el dominio, actualizar este valor y seguir el procedimiento de cambio de origen para preservar pendientes en los navegadores.

**No usar `${{Postgres.DATABASE_URL}}` como conexión web sin adaptar su usuario:** normalmente es la conexión administrativa del proveedor. Utilizar la URL `sca_runtime` generada. No colocar `MIGRATION_DATABASE_URL`, contraseñas de bootstrap ni claves de backup en el servicio web. Railway asigna `PORT`; no fijarlo a 3000 en el panel. Mantener `SCA_DEMO_MODE=false`, `SCA_SYNTHETIC_DATA=false` y `SCA_EMAIL_ENABLED=false`.

## Actualizaciones y copias

Hacer una copia consistente antes de migrar. Aplicar `npm run db:migrate` desde el contexto privado de mantenimiento, con `MIGRATION_DATABASE_URL` de esa base, y después desplegar la versión compatible. No se ejecutan migraciones con privilegios de propietario como hook del servicio web, ni se recrea la institución en cada reinicio.

Los comandos actuales `backup` y `restore:verify` operan sobre el contenedor PostgreSQL local; no se conectan automáticamente a la base de Railway. El procedimiento remoto de exportación cifrada y restauración debe prepararse y probarse con la base y los permisos reales del proveedor antes de pasar de pruebas a datos reales. Se necesita un equipo de mantenimiento con herramientas PostgreSQL compatibles y conectividad autorizada. No se presenta como realizada ni automatizada una copia de Railway. Un volumen persistente o un snapshot del proveedor no sustituye las dos copias independientes de la guía operativa.

La aceptación de reglas, privacidad, lectores físicos y piloto de cinco jornadas continúa en [implementación de fases 2–5](IMPLEMENTACION_FASES_2_5.md).

## Comprobación local de la preparación

```bash
docker build -t sca-qr:railway-check .
node scripts/verify-railway.mjs
```

El ensayo usa contenedores, red y base aislados, y los elimina al terminar. Verifica bootstrap nuevo y rechazo de repetición, RLS, claves, cambio inicial de contraseña, puerto asignado, imagen sin root ni archivos privados, login por origen HTTPS, rechazo de origen falsificado y CSP del shell. Guarda resultados agregados en `docs/evidencia/railway-preparacion.json`. No llama a Railway ni acredita un despliegue remoto.

En esta revisión también aprobaron 90 pruebas unitarias, seis E2E demo, nueve E2E institucionales, TypeScript, lint y el build de producción. La auditoría de dependencias de producción reportó cero vulnerabilidades conocidas. El instalador y la imagen se probaron con una base nueva aislada; no se alteró la instalación local existente.

En el entorno de desarrollo gestionado la primera descarga npm dentro de Docker necesitó la CA del proxy. El ensayo utilizó un Dockerfile temporal equivalente con la CA montada como secreto de BuildKit; esa CA y la adaptación de sesión no se agregan al repositorio ni a la imagen de ejecución. Se mantuvo la verificación TLS.
