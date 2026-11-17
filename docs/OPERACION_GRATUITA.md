# Operación local gratuita y recuperación

Fecha: 16 de noviembre de 2026, America/Lima. Esta guía describe la ruta implementada, sin contratar proveedores. Equipo existente, energía, conexión y administración siguen siendo recursos necesarios.

## Instalación y límites de exposición

`npm ci` y `npm run setup:local` preparan PostgreSQL 17 en Docker, puerto `127.0.0.1:54329`, volumen `sca-qr-postgres-data` y servidor Next. Variables opcionales del instalador: `SCA_DB_PORT`, `SCA_DB_CONTAINER`, `SCA_SCHOOL_NAME`; `SCA_BOOTSTRAP_PASSWORD` solo cuando un proceso institucional seguro suministra la contraseña, sin escribirla en comandos ni logs compartidos.

El puerto PostgreSQL solo escucha en loopback. Ejecutar Next sobre localhost para la operación en el mismo equipo. Para varias laptops, configurar HTTPS con un proxy gratuito como Caddy y un certificado confiable para esos equipos; probar cookies Secure, PWA y Web Serial antes del piloto. Un HTTP de red local no ofrece las garantías de localhost/HTTPS. No exponer directamente la base ni abrir puertos del router como parte de esta instalación.

Ejecutar el servicio con una cuenta del sistema que tenga acceso a la configuración de aplicación y carezca de acceso a archivos de mantenimiento y claves de backup. El instalador protege archivos con modos 0600/directorios 0700 donde el sistema lo admite; en Windows configurar permisos de la carpeta institucional. La separación de archivos no reemplaza la separación de cuentas del sistema operativo.

La aplicación usa `sca_runtime`, sin superusuario, creación de roles ni bypass RLS. El propietario de migración se guarda en `var/maintenance.env` y se carga exclusivamente en los comandos de mantenimiento. No se guarda en `.env.local` ni se pasa al servidor de pruebas como credencial de ejecución.

## Primera jornada

- Cambiar contraseña inicial. Crear cuentas personales; evitar compartir la cuenta administradora.
- Confirmar nombre institucional, calendario y horarios. Los valores iniciales son preparación técnica, no aprobación del horario escolar.
- Revisar códigos y matrículas vigentes. No se recopilan documentos nacionales ni teléfonos para esta operación.
- Asignar portería a terminales; cada terminal tiene dirección ENTRY o EXIT explícita y lectores autorizados.
- Imprimir un carnet de prueba y comprobar lectura, identidad, reloj, desconexión, recarga y reconexión.
- Medir almacenamiento y conectividad del equipo. No usar modo incógnito ni borrar el perfil del navegador como solución a un error de cola.

Un permiso de terminal dura ocho horas. El snapshot mínimo conserva alumnado, relación con credenciales y claves públicas. La captura original se guarda antes del envío. La hora offline no es una prueba contra manipulación: desfases, futuros, secuencias y sesiones revocadas se envían a revisión. El padrón del navegador necesita protección física del equipo; IndexedDB no aporta por sí mismo cifrado del disco.

## Lectores

HID: un único flujo de teclado por estación; prefijo opcional del lector configurado y terminador Enter. Los prefijos no separan caracteres simultáneos de varios teclados.

Serial: Configuración → Terminales permite añadir identificadores seriales distintos. Cada botón de conexión abre el selector nativo de Web Serial, mantiene un stream y parser independiente y conserva el identificador del canal. La configuración inicial utiliza 9600 baudios. Confirmar compatibilidad, modo de salida y velocidad en el manual del lector; modificar la configuración del dispositivo con personal autorizado. Chrome/Edge y contexto seguro son requisitos del adaptador. La presencia de código y las pruebas con chunks no acreditan compatibilidad con un modelo físico.

No se implementa un WebSocket local abierto ni se necesita un agente con acceso a todos los dispositivos. Si los lectores disponibles solo tienen modo HID y se requieren varios por laptop, el objetivo completo permanece bloqueado hasta validar una estrategia compatible con esos modelos. El piloto de un HID por estación continúa disponible.

## Copia de base de datos

1. Mantener `var/maintenance.env` y una clave de backup institucional de al menos 32 caracteres en un archivo protegido. Por defecto se usa `var/backup.key`; se puede indicar otra ruta con `SCA_BACKUP_KEY_FILE`.
2. Ejecutar `npm run backup -- backups/asistencia-AAAA-MM-DD.sca` desde la raíz del proyecto. El nombre de destino debe ser nuevo.
3. El comando mantiene un snapshot PostgreSQL consistente, incluye datos, usuarios, sesiones, auditoría y claves de firma; transmite el dump directamente al cifrado AES-256-GCM, con scrypt y salt/IV nuevos. No deja un dump claro de la copia.
4. Copiar el archivo cifrado a dos soportes institucionales independientes y conservar la clave por separado. No confiar en dos archivos del mismo volumen como dos respaldos independientes.
5. Registrar responsable, fecha, ubicación y verificación. La clave no va en Git, en el chat ni dentro del archivo cifrado.

Propuesta institucional: copia diaria; restauración de prueba mensual y después de cambios de esquema. RPO 24 h/RTO 4 h son objetivos de aceptación, no resultados garantizados por este código. Un temporizador del sistema puede ejecutar el comando; no se crea un trabajo programado ni se inventa un historial de copias realizadas.

## Restauración aislada y corte administrado

`npm run restore:verify -- copia.sca` descifra a un temporal privado, restaura en una base con nombre aleatorio, compara conteos y huellas de todas las tablas, elimina el temporal y la base de prueba. La clave incorrecta o una alteración de ciphertext abortan la operación. El resumen privado queda en `var/last-restore-verification.json`.

Con `--keep`, conservar la base restaurada para revisión. La comprobación de huellas se hace antes de aplicar los grants de ejecución. Si falla una comparación no debe usarse esa base como recuperación aprobada, aunque se haya pedido conservarla.

Para sustituir una base activa: detener capturas online, preservar el volumen original y las copias locales, verificar una restauración con `--keep`, revisar esquema/roles y cambiar las URLs de aplicación y mantenimiento al nombre de esa base. Reiniciar el servicio, verificar `/api/ready`, login, permisos, consulta de alumnos y un flujo sintético controlado. Mantener la base original para reversión hasta cerrar la reconciliación. No se automatiza un reemplazo destructivo. Antes de reabrir el acceso, revisar cuentas y roles restaurados y revocar las sesiones HTTP del respaldo; renovar JWT_SECRET si corresponde. Emitir permisos de terminal nuevos y conservar las claves anteriores de QR/recibos para la reconciliación. Las capturas con permisos revocados se conservan para revisión. No asumir que el respaldo contiene las revocaciones de acceso realizadas después de su fecha.

## Reconciliación de terminales

Exportar **todos los bloques** de la copia cifrada de cada navegador y conservar sus contraseñas aparte. Cada bloque contiene hasta 5.000 capturas con sus IDs originales; los borradores/recibos manuales también se conservan. Importar no reemplaza un ID existente con otro payload ni genera identificadores nuevos. Los ACK importados quedan pendientes de reconciliación, aunque su estado previo fuera confirmado.

Administración inicia sesión, prepara el contexto de terminal y utiliza “Reconciliar recibos”. El servidor valida la firma institucional, ámbito y hash. Si ya existe el recibo devuelve el resultado original. Si falta, solo reconstruye automáticamente cuando conserva el contexto necesario y el resultado coincide con el firmado; conserva identidad de evento, hora de recepción y recibo original. Si cambió o falta contexto, conserva un caso de recuperación para revisión. Si no se restauró la clave que permite verificar una firma, recuperar el respaldo de claves; no confiar en una clave pública propuesta por un archivo no autenticado.

No reenviar una captura confirmada como una captura nueva. No borrar registros locales después de descargar una copia. La retención y una futura purga dependen de política institucional y recuperación comprobada; esta entrega no ejecuta purgas automáticas.

## Incidencias y acceso

- PostgreSQL no disponible: conservar comandos en RETRY, corregir el servicio y reintentar con los mismos IDs. `/api/health` indica proceso vivo; `/api/ready` verifica conexión de base.
- Sesión vencida: iniciar sesión y reanudar. No limpiar IndexedDB. Una sesión de captura revocada conserva el intento válido para revisión cuando puede verificarse su contexto.
- Token o contenido alterado: no confirmar; preservar la copia y revisar hash, clave y procedencia.
- Carnet extraviado: revocar credencial y emitir otra; actualizar terminales. La revocación de una credencial es irreversible en la base.
- Cuenta comprometida: desactivar cuenta, revocar sesiones, revisar auditoría y comprobar las capturas pendientes. Rotar claves de emisión cuando corresponda; rotación ordinaria no equivale a invalidar todos los carnets anteriores.
- Recuperación de acceso sin correo: verificar identidad y aprobación institucional; crear una contraseña temporal en un archivo protegido, indicar `SCA_PASSWORD_FILE` y ejecutar `npm run user:reset -- usuario`. El comando fuerza cambio, revoca sesiones y deja auditoría. Entregar la contraseña por el canal verificado de la institución y retirar el archivo temporal.

## Cierre del piloto

Documentar censo real, equipo, lectores, calendario, incidentes, latencias, ocupación, responsable de backups y una restauración reconciliada. Repetir durante cinco jornadas con el colegio. Aprobar o ajustar las ventanas temporales, retención, privacidad y condiciones de operación. Ninguna prueba sintética sustituye esta aceptación.
