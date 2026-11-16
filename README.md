# SCA-QR · Control de asistencia escolar

Prototipo PWA con datos ficticios. Primera entrega técnica del [SDD](docs/SDD_MEJORA_GRATUITA.md), con [controles de seguridad y límites documentados](docs/IMPLEMENTACION_FASE_1.md).

**El backend actual usa memoria volátil.** No utilizar con datos reales hasta completar persistencia, cuentas/roles institucionales, credenciales QR y recuperación. El frontend conserva copias locales; una respuesta del demo no se presenta como asistencia institucional definitiva.

## Inicio local

Requisitos: **Node 24.x y npm 11.x**. Versión de referencia en `.nvmrc`.

```bash
npm ci
node scripts/setup-demo.mjs
npm run dev
```

El helper crea `.env.local` con un secreto JWT aleatorio, sin mostrarlo ni sobrescribir archivos existentes. No lo subas a Git. Si ya existe configuración, revisa de forma segura `SCA_DEMO_MODE` y `JWT_SECRET`.

En desarrollo el demo está habilitado. Fuera de desarrollo necesita `SCA_DEMO_MODE=true` explícito; sin activación las APIs ficticias responden 503. El acceso administrativo necesita un secreto configurado de al menos 32 caracteres. No hay secretos de respaldo.

El demo incluye ocho alumnos ficticios; acceso de prueba `admin` / `admin123`, disponible exclusivamente en el modo demo. Abre la pantalla de ingreso y usa búsqueda manual o los botones de simulación. Los sonidos y avatares de demostración son assets locales, sin proveedores externos.

## Captura y desconexión

- Toda captura admitida se guarda primero en IndexedDB con un único ID y su lector/entrada.
- Ámbar significa pendiente, recepción demo o revisión. El prototipo no confirma persistencia institucional ni puntualidad definitiva.
- Red caída, timeout y 503 conservan los registros para reintento. Un conflicto/rechazo permanece visible y no se borra después de tres intentos.
- Un 401 pausa el envío hasta iniciar sesión y reanudar. No borrar el perfil del navegador para solucionar la cola.
- `Exportar copia local` descarga los comandos y recibos retenidos; exportar no libera pendientes. La restauración administrativa completa es una fase posterior.
- El SW registra automáticamente el shell y assets públicos compilados. No cachea APIs, administración, sesiones ni reportes.
- Para actualizar desde una versión anterior, cerrar todas las pestañas/ventanas de SCA-QR y abrir de nuevo. No se fuerza una recarga durante una lectura.

El piloto configura **un lector por terminal**. Un frame de teclado válido puede ser `N1|72345678|SCAQR723` + Enter; sin prefijo se admite solo si hay un lector configurado. Las firmas son de demostración: ocho caracteres no prueban autenticidad. Varios HID simultáneos pueden intercalar caracteres y requieren validación/adaptador por dispositivo. El botón de prueba de hardware solo produce sonido y respuesta visual, sin crear asistencia.

## Verificación

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run test:e2e
```

Para E2E se necesita Chromium: `npx playwright install chromium` si no está instalado. La suite usa el build de producción, un puerto local exclusivo y un secreto efímero. No requiere Supabase, correo ni servicios de pago.

Para ejecutar el build manualmente:

```bash
npm run build
npm start
```

No ejecutar `dev` y `build` sobre la misma carpeta `.next` al mismo tiempo. CI ejecuta validaciones, auditoría de dependencias de producción y pruebas de navegador; no despliega a VPS ni publica la aplicación.

## Stack actual

- Next.js 16 y React 19; TypeScript y Tailwind.
- IndexedDB mediante `idb`, esquema único con migraciones conservadoras.
- Zod 4 para contratos y ACK vinculados al comando con SHA-256.
- JWT con `jose`; credenciales/usuarios ficticios aislados por el modo demo.
- Vitest, fake-indexeddb y Playwright.

## Skills de diseño

Disponibles en `.agents/skills`: Unslop, Impeccable y `emil-design-eng`, con Playwright como herramienta de verificación. Consulta [su función y procedencia](docs/SKILLS_DISENO.md) antes de trabajar en el dashboard.

## Alcance pendiente

PostgreSQL transaccional, usuarios/roles reales, RLS y autorización de terminales; QR JWS revocable; calendario/entrada-salida escolar; exportación completa de reportes; backups/restauración, privacidad institucional y hardware real.

El PDF demo conserva su límite de 80 filas y el correo está deshabilitado por defecto. Redis es un adaptador opcional no requerido ni validado para esta entrega. Los planes cloud gratuitos se evaluarán con sus cuotas antes de desplegar; no se ha contratado ni creado ningún servicio.

Aplicar controles alineados con ISO 27001/27002 no equivale a certificación ni a un SGSI institucional completo. Consulta el registro de riesgos, evidencias y procedimientos de la entrega.
