# SCA-QR · Demo PWA de Control de Asistencia

Sistema de Control de Asistencia Escolar con códigos QR, implementado como **PWA** con soporte offline completo.

## 🚀 Inicio Rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Generar archivos de audio (tonos sintéticos para el demo)
node scripts/generate-sounds.js

# 3. Modo desarrollo
npm run dev

# 4. Abrir en el navegador
# http://localhost:3000
```

## 📋 Códigos QR de Prueba

El demo incluye 8 estudiantes mockeados. Usa estos códigos (formato `DNI|firma`):

| DNI | Firma | Estudiante |
|-----|-------|------------|
| 72345678 | SCAQR723 | Sofía Quispe Mamani |
| 71234567 | SCAQR712 | Mateo Huamán Rivera |
| 73456789 | SCAQR734 | Valentina Chávez López |
| 74567890 | SCAQR745 | Sebastián Rojas (SUSPENDIDO) |
| 75678901 | SCAQR756 | Camila Vargas Salazar |
| 76789012 | SCAQR767 | Diego Mendoza Aguilar |
| 77890123 | SCAQR778 | Isabella Castillo Núñez |
| 78901234 | SCAQR789 | Lucas Paredes (GRADUADO) |

**Para probar la app**, abre la búsqueda manual y selecciona cualquier estudiante, o usa el lector USB y escanea los códigos impresos.

## 🧪 Escenarios de Prueba

### 1. Marcación Exitosa (Verde)
- Abre `/ingreso`
- Click en "Búsqueda Manual" → selecciona un estudiante
- Verás el estado **SUCCESS** con datos del alumno, foto, grado, sección, turno
- Sonido agudo ascendente

### 2. Anti-Suplantación / Ráfaga (Amarillo)
- Selecciona 2 estudiantes en menos de 2.5 segundos
- El segundo marcará **WARNING** con mensaje "Ráfaga detectada"
- Sonido de alerta medio

### 3. Modo Offline
- Abre DevTools → Network → Throttling → **Offline**
- Intenta marcar un estudiante
- Verás badge "MODO OFFLINE" + badge "📦 1 pendiente"
- Mensaje: "Registro guardado localmente"
- Vuelve a **Online** desde DevTools
- Automáticamente sincroniza y muestra "✓ Sincronizados N registros"

### 4. QR Inválido (Rojo)
- Click en Búsqueda Manual y escribe cualquier texto no listado
- Verás estado **ERROR** con sonido grave
- No se guarda en cola offline

### 5. Estudiante Suspendido
- Selecciona a Sebastián Rojas (DNI 74567890)
- Aparecerá badge rojo "SUSPENDED" sobre la foto

### 6. Doble Marcación
- Marca al mismo estudiante 2 veces en menos de 1 minuto
- Verás **WARNING** con mensaje "ya marcó entrada hace menos de 1 minuto"

## 🏗️ Arquitectura

```
src/
├── app/
│   ├── page.tsx                    # Landing con info
│   ├── ingreso/page.tsx            # Terminal de portería
│   ├── api/attendances/scan/       # Endpoint POST con mock
│   └── api/health/                 # Health check
├── components/
│   ├── ScannerInput.tsx            # Capturador HID (sr-only)
│   ├── StudentDisplay.tsx          # Tarjeta visual del alumno
│   ├── ConnectivityBadge.tsx       # Estado red + cola pendiente
│   ├── RecentScans.tsx             # Últimas 5 marcaciones
│   └── ManualSearch.tsx            # Búsqueda por DNI/nombre
├── lib/
│   ├── audio.ts                    # SoundManager (WAV precargados)
│   ├── offlineQueue.ts             # IndexedDB con UUID + retry
│   ├── qrValidator.ts              # Parse + verify signature
│   ├── api.ts                      # Cliente HTTP tipado
│   ├── constants.ts                # Magic numbers centralizados
│   ├── serviceWorkerRegistration.ts
│   └── mockData.ts                 # 8 estudiantes demo
└── types/
    └── attendance.ts               # Tipos compartidos

public/
├── manifest.json                   # PWA manifest
├── sw.js                           # Service Worker
├── icons/                          # Iconos SVG
└── sounds/                         # success/warning/error.wav
```

## 🔑 Mejoras vs Plan Original

| Característica | Plan Original | Esta Versión |
|---|---|---|
| Service Worker | ❌ No existe | ✅ Precache + network-first |
| Manifest | Básico | Con shortcuts + orientation |
| Cola offline | Sin UUID, rompe si falla | Con UUID, retry, dead-letter |
| Idempotencia | ❌ Duplicados posibles | ✅ Map en servidor |
| Validación QR | Ninguna | Parse + verify signature |
| Búsqueda manual | ❌ | ✅ Fallback completo |
| Tipos TypeScript | Parciales | ✅ Estrictos en todo |
| Accesibilidad | `opacity-0` + `aria-hidden` | `sr-only` correcto |
| Idempotencia servidor | ❌ | ✅ Cache 24h |
| Modo oscuro | OK | Refinado con glass morphism |

## 🛠️ Stack

- **Next.js 14** (App Router)
- **TypeScript** (strict)
- **Tailwind CSS** (utility-first)
- **idb** (IndexedDB wrapper)
- **Zod** (validación de payloads)
- **Service Worker** nativo (sin Workbox para demo simple)

## 📱 Cómo Probar como PWA

1. Ejecuta `npm run dev`
2. Abre Chrome/Edge en `http://localhost:3000/ingreso`
3. Click en el ícono de "instalar" (⊕) en la barra de direcciones
4. La app se abre en modo **fullscreen** sin barra del navegador
5. Desconecta el Wi-Fi → la app sigue funcionando
6. Reconecta → sincroniza automáticamente

> ⚠️ El Service Worker solo funciona en `https://` o `localhost`

## 🔊 Personalizar Sonidos

Los tonos se generan sintéticamente. Para reemplazarlos:
1. Coloca tus MP3/WAV en `public/sounds/`
2. Actualiza las rutas en `src/lib/audio.ts`

## 🐛 Debug

```bash
# Ver la cola offline
# DevTools → Application → IndexedDB → SCA_OFFLINE_DB

# Simular offline
# DevTools → Network → Throttling → Offline

# Ver el Service Worker
# DevTools → Application → Service Workers

# Logs de la API mock
# Terminal donde corre `npm run dev`
```

## 📦 Build de Producción

```bash
npm run build
npm start
```

## 🚧 Para Llevar a Producción

Pendiente (fuera del demo):
- [ ] Reemplazar mock data con BD real (PostgreSQL/Prisma)
- [ ] Implementar firma RSA real para QRs (clave pública del colegio)
- [ ] Autenticación de porteros (NextAuth + JWT)
- [ ] HTTPS obligatorio
- [ ] Certificados para Service Worker
- [ ] Sentry/PostHog para errores y métricas
- [ ] Tests E2E con Playwright
- [ ] CI/CD (GitHub Actions)
- [ ] Reportes de asistencia (PDF/Excel)
- [ ] App móvil nativa (opcional, Capacitor)
