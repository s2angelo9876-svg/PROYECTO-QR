# SCA-QR · Control de asistencia escolar

PWA para registrar entradas y salidas con QR firmado, conservar capturas sin conexión, gestionar matrículas y resolver incidencias con auditoría. Incluye un panel adaptable y una ruta de operación local sin contratar servicios de pago.

## Inicio institucional gratuito

Requisitos: **Node 24.x, npm 11.x y Docker con contenedores Linux**. Versiones de referencia en `.nvmrc` y `package.json`. En Windows se puede usar Docker Engine dentro de WSL2; Docker Desktop no es un requisito de esta ruta gratuita.

```bash
npm ci
npm run setup:local
npm run dev
```

Abre `http://localhost:3000/admin/login`. El usuario inicial es `admin`; su contraseña aleatoria está en el archivo privado `var/bootstrap.txt`. Debes cambiarla desde Configuración → Cuenta. El instalador crea PostgreSQL 17, volumen persistente, migraciones, claves de firma y configuración local; no sobrescribe `.env.local` ni publica servicios.

- `.env.local` contiene únicamente la configuración de ejecución y la cuenta PostgreSQL restringida.
- `var/maintenance.env` conserva el acceso de mantenimiento. `var/backup.key` protege las copias; guarda una copia institucional separada.
- `.env.local`, `var/`, backups y evidencias del navegador se excluyen de Git.
- `npm run setup:local -- --fixtures` crea una instalación **sintética** de 120 alumnos para pruebas; no usar esa opción para un padrón real.
- Si ya existe un `.env.local` de demostración, consérvalo de forma privada antes de preparar una instalación institucional nueva. No elimines el almacenamiento del navegador ni un volumen con datos para cambiar de modo.

Para una instalación existente:

```bash
npm run db:migrate
npm run build
npm start
```

No ejecutar `dev` y `build` sobre la misma carpeta `.next` al mismo tiempo. Las APIs ficticias quedan deshabilitadas cuando hay `DATABASE_URL`; una caída de PostgreSQL no activa el demo como alternativa.

## Operación

1. Configura institución, usuarios, horarios, calendario y terminales. Asigna los operadores a cada terminal.
2. Registra alumnos con su matrícula anual o importa CSV después de revisar la vista previa.
3. Emite y, cuando corresponda, revoca carnets desde Alumnos y matrículas. El QR contiene identificadores opacos; portería coteja la identidad.
4. En portería, inicia sesión y autoriza una terminal por ocho horas. Se descarga un padrón mínimo y las claves públicas.
5. Utiliza un lector HID por estación. El modo de varios lectores admite canales seriales independientes con Web Serial; el modelo, modo serial, velocidad y sistema operativo requieren prueba física.
6. Revisa incidencias y genera una instantánea para exportar el mismo reporte completo en PDF y CSV.

El verde de asistencia requiere un recibo durable con firma válida. Ámbar indica captura local, revisión o demostración. Un 401 pausa la cola; los reintentos conservan ID, contexto y hora. Las resoluciones son registros adicionales y no cambian los recibos originales.

La PWA guarda únicamente el shell y recursos públicos en Cache Storage. El padrón mínimo y los comandos viven en IndexedDB; su autorización expira. Las copias locales institucionales se cifran con contraseña y se exportan por bloques de hasta 5.000 capturas. Descarga todos los bloques y conserva la contraseña aparte. Una restauración no confirma asistencia por sí sola: administración debe reconciliar los recibos.

## Copias y recuperación

```bash
npm run backup -- backups/asistencia-AAAA-MM-DD.sca
npm run restore:verify -- backups/asistencia-AAAA-MM-DD.sca
```

La verificación restaura en una base aislada, compara conteos y huellas de todas las tablas y elimina esa base al terminar. `--keep` conserva la base aislada para una recuperación administrada. No reemplaza automáticamente la base activa.

Consulta [operación y recuperación](docs/OPERACION_GRATUITA.md), [implementación de fases 2–5 y controles ISO](docs/IMPLEMENTACION_FASES_2_5.md) y [SDD vigente](docs/SDD_MEJORA_GRATUITA.md).

## Railway

El repositorio incluye `Dockerfile` y `railway.toml`, arranque con el `PORT` asignado, origen HTTPS explícito y un instalador para PostgreSQL externo sin Docker local. Consulta la [guía de preparación y despliegue en Railway](docs/DESPLIEGUE_RAILWAY.md). La aplicación web usa la cuenta restringida generada por el instalador; las credenciales de mantenimiento se guardan aparte.

La configuración preparada no crea servicios ni activa un plan. Antes de desplegar hay que disponer de una cuenta conectada, crear el proyecto y verificar sus créditos, límites y facturación. El software libre del proyecto no garantiza alojamiento gratuito permanente en Railway.

## Verificación

```bash
npm run typecheck
npm run lint
npm run test:run
npm run test:integration
npm audit --omit=dev --audit-level=high
npm run build
npm run test:e2e
npm run test:e2e:institution
npm run measure:capacity
```

Las pruebas institucionales necesitan la instalación PostgreSQL local y crean bases aisladas con datos sintéticos. No escriben en el padrón activo. Para navegador: `npx playwright install chromium` si no hay Chromium instalado. CI valida; no despliega.

La medición de 100.000 eventos y recibos y la prueba concurrente se guardan en [docs/evidencia](docs/evidencia). La proyección de 880.000 eventos/año supera la cuota de 500 MiB contemplada para Supabase Free; la implementación usa PostgreSQL local. La nube gratuita permanece como alternativa que requiere revisar capacidad y elegibilidad antes de habilitarla.

## Demostración

En un directorio de configuración separado, sin `.env.local` institucional:

```bash
node scripts/setup-demo.mjs
npm run dev
```

Incluye ocho alumnos sintéticos y acceso `admin` / `admin123`, exclusivo del demo. Las firmas simplificadas y recibos en memoria del demo no acreditan asistencia institucional. Las pruebas E2E de fase 1 mantienen este modo aislado.

## Diseño y alcance

Unslop, Impeccable y Emil guían el diseño; [procedencia y licencias](docs/SKILLS_DISENO.md). Public Sans y Lucide se sirven desde el proyecto. No se usan imágenes generadas, analítica externa, correo, SMS ni servicios de pago en la operación implementada. Redis continúa siendo opcional y no es necesario.

Los controles técnicos se alinean con ISO/IEC 27001 y 27002; no constituyen certificación ni sustituyen el SGSI y las decisiones de la institución. El piloto, hardware real, política legal de conservación, responsables y objetivos operativos deben validarse con el colegio.
