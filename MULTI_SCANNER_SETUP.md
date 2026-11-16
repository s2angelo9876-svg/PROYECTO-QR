# Configuración Multi-Lector (3-4 lectores por entrada)

> **Guía técnica para el colegio**
> Cómo conectar y configurar 3-4 lectores QR en una sola laptop
> Octubre 2026 · Versión 1.0

---

## El problema

El colegio tiene **2 entradas**, y cada entrada necesita **3-4 lectores** QR. Pero hay una sola laptop por entrada. Los lectores USB HID actúan como teclados: si conectas 4 lectores a la misma laptop, los 4 escriben en el mismo buffer y no se puede distinguir cuál mandó qué lectura.

**Solución implementada:** El sistema ahora soporta múltiples lectores por laptop, identificando cada uno por un prefijo único que se configura en el lector mismo.

---

## Arquitectura de la solución

### Componentes

```
┌─────────────── ENTRADA NORTE ────────────────┐
│                                              │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐            │
│  │ L1  │ │ L2  │ │ L3  │ │ L4  │  Lectores  │
│  │N1│  │ │N2│  │ │N3│  │ │N4│  │  USB HID  │
│  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘            │
│     │       │       │       │                │
│     └───┬───┴───┬───┴───┬───┘                │
│         │   HUB USB  │   │                   │
│         └─────┬─────┘   │                   │
│               │         │                   │
│        ┌──────┴──────┐  │                   │
│        │   LAPTOP    │  │                   │
│        │  Portería   │  │                   │
│        └──────┬──────┘  │                   │
│               │         │                   │
└───────────────┼─────────┼───────────────────┘
                │         │
                │   WiFi  │
                ▼         ▼
         ┌──────────────────────┐
         │   SERVIDOR (VPS)     │
         │   Base de datos      │
         └──────────────────────┘
```

### Flujo de datos

1. Alumno acerca carnet al lector 1 (N1)
2. Lector envía por USB: `N1|72345678|signature` + Enter
3. Laptop recibe la cadena por teclado
4. App detecta el prefijo `N1|`
5. App sabe que la lectura vino del lector "N1 - Puerta Principal"
6. Muestra resultado en pantalla Y actualiza el grid visual
7. Envía al servidor con `scanner_id: N1`

---

## Hardware necesario

### Por entrada (1 laptop + 3-4 lectores)

| Componente | Cantidad | Precio aprox. | Notas |
|---|---|---|---|
| Laptop (ya tienen) | 1 | S/ 0 | Ya disponible en el colegio |
| Lector QR USB HID | 3-4 | S/ 80-400 c/u | Mismo modelo o compatible |
| Hub USB alimentado (4-7 puertos) | 1 | S/ 30-80 | **Importante:** con fuente de poder propia |
| Cables USB extensor (1m) | 3-4 | S/ 10 c/u | Opcional, para llegar a la puerta |
| Multitoma / regleta | 1 | S/ 20-40 | Para alimentar hub y laptop |

**Costo adicional por entrada:** S/ 200 - 800 (según calidad)

### Hub USB: ¿con o sin alimentación?

**CRÍTICO: usa un hub CON alimentación (powered hub).**

| Tipo | Ventaja | Problema |
|---|---|---|
| Sin alimentación (bus-powered) | Barato, portátil | 4 lectores pueden no encender o ser inestables |
| Con alimentación (powered) ⭐ | Estable, confiable | Cuesta un poco más |

Marcas recomendadas: Anker, Ugreen, Orico, Sabrent.

### Disposición física recomendada

```
        [Puerta del colegio]
              |
    ══════════╪══════════
    ║         ║         ║
  [L1]      [L2]      [L3]      [L4]
 Izq.     Centro    Der.    Especial
              |
              |  (cables USB al hub)
              |
    ══════════╪══════════
              |
         [HUB USB]
              |
         [LAPTOP]
       (en el escritorio
        del portero)
```

---

## Configuración de los lectores

Cada lector debe configurarse para enviar un **prefijo único** antes del código QR. El formato esperado es:

```
PREFIJO|QR_DATA
```

Por ejemplo:
- Lector 1 envía: `N1|72345678|abc12345`
- Lector 2 envía: `N2|71234567|def67890`
- Lector 3 envía: `N3|73456789|ghi11111`
- Lector 4 envía: `N4|74567890|jkl22222`

**Importante:** El carácter `|` (pipe) es el separador. El prefijo puede ser cualquier texto (sugerimos `N1`, `N2`, `N3`, `N4` para entrada Norte, o `S1`, `S2`, etc. para entrada Sur).

### Configuración por marca de lector

#### Netum NT-1228BC (y similares Netum)

1. **Escanear el código de barras "Enter Setup"** (en el manual)
2. **Escanear el código "Enable Custom Prefix"**
3. **Escanear los caracteres del prefijo uno por uno:**
   - Para `N1`: escanear código de `N`, luego código de `1`
4. **Escanear el código de barras "Add separator"** (o seleccionar el carácter `|`)
5. **Escanear el código "Exit Setup"** (o "Save and Exit")

Los códigos de barras para cada carácter están al final del manual del Netum. Típicamente vienen como:
- Códigos ASCII para cada letra (A-Z, a-z, 0-9)
- Códigos de control (Enter, Tab, símbolos)

#### Honeywell HH400 (Youjie)

1. **Escanear el código "Enter Configuration"**
2. **Escanear "Data Formatting"**
3. **Escanear "Add Prefix"**
4. **Escanear los caracteres** (N, 1, |)
5. **Escanear "Save and Exit"**

El manual de Honeywell tiene una sección llamada "Data Formatting" con ejemplos.

#### Lector genérico chino (sin marca)

1. Buscar en el manual la sección "Custom Prefix" o "Add Prefix"
2. Si no hay manual, buscar códigos de configuración en Google: "[modelo del lector] configuration codes"
3. Configurar prefijo + guardar

**Tip:** Si el lector genérico no permite prefijos, no te preocupes. La app también funciona **sin prefijos** (asigna cada lectura al lector que esté activo en ese momento usando rotación de foco). Es menos preciso pero funciona.

#### Symbol / Zebra (profesionales)

Usar el software **123Scan** de Zebra (gratis) para configurar prefijos desde la PC, sin tener que escanear códigos de barras.

---

## Verificar la configuración

### Test 1: Con un editor de texto

1. Abrir el Bloc de notas o cualquier editor
2. Hacer click en el área de texto
3. Pasar un QR por el lector 1
4. **Esperado:** aparece `N1|72345678|signature` en el editor + nueva línea
5. Repetir con el lector 2 → debe aparecer `N2|...`

Si aparece sin el prefijo, el lector no está bien configurado. Revisar el manual.

### Test 2: Con la app

1. Abrir la app SCA-QR en modo ingreso
2. Pasar el QR por el lector 1
3. **Esperado:** el card del lector "N1" se ilumina en verde/amarillo/rojo
4. El mensaje de resultado aparece en pantalla
5. En el grid visual, "N1" muestra el último alumno y la hora

Si el card de N1 no se ilumina, revisar:
- ¿El prefijo está bien configurado? (Test 1)
- ¿El cable USB está bien conectado?
- ¿El hub USB está encendido y con alimentación?

### Test 3: Concurrencia

1. Con 2 personas, pasar QRs por lectores diferentes al MISMO TIEMPO
2. **Esperado:** ambos se procesan (uno después del otro)
3. Cada uno se asigna al lector correcto
4. El grid visual muestra ambos cards iluminados

Si uno se pierde o se asigna mal, puede ser un problema de configuración de prefijos.

---

## Software: cómo funciona la detección

### Método 1: Con prefijos configurados (recomendado)

```
Lector 1 envía:  N1|72345678|abc
Lector 2 envía:  N2|71234567|def

App recibe el texto en un buffer global:
"N1|72345678|abc"

App hace:
  buffer = "N1|72345678|abc"
  if buffer.startsWith("N1|"):
    scannerId = "N1"
    qrCode = "72345678|abc"
  elif buffer.startsWith("N2|"):
    scannerId = "N2"
    ...
```

**Ventaja:** 100% preciso, identifica cada lector sin ambigüedad.
**Desventaja:** Requiere configurar cada lector una vez.

### Método 2: Sin prefijos (rotación de foco)

```
Inputs invisibles: input[N1], input[N2], input[N3], input[N4]
Foco rota cada 250ms entre ellos

Cuando un lector envía datos, los caracteres van al input que tenga foco
en ese momento. Se asume que ese input corresponde a un lector específico.
```

**Ventaja:** Funciona con cualquier lector sin configuración.
**Desventaja:** Puede perder lecturas si 2 lectores disparan a la vez entre rotaciones.

### Cómo se activa cada método

La app implementa **ambos métodos** automáticamente:

1. Intenta detectar el prefijo en el buffer (`Método 1`)
2. Si no encuentra prefijo, usa la rotación de foco (`Método 2`)
3. Funciona aunque solo algunos lectores tengan prefijo configurado

---

## Configuración visual desde la app

En la pantalla principal, el portero ve:

```
┌─────────────────────────────────────────────────┐
│  SCA-QR · ENTRADA NORTE                         │
│                                                 │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐            │
│  │ N1  │  │ N2  │  │ N3  │  │ N4  │            │
│  │  ●  │  │  ●  │  │     │  │  ●  │            │
│  │Sofía│  │Mateo│  │     │  │Sebas│            │
│  │07:32│  │07:33│  │     │  │07:35│            │
│  └─────┘  └─────┘  └─────┘  └─────┘            │
│                                                 │
│  [Tarjeta grande con el último resultado]      │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Indicadores visuales:**
- 🟢 Verde: marcación exitosa reciente
- 🟡 Amarillo: advertencia (duplicado, ráfaga)
- 🔴 Rojo: error
- ⚪ Gris: esperando lectura

**Información mostrada por card:**
- ID del lector (N1, N2, etc.)
- Etiqueta legible ("Puerta Principal", "Puerta Lateral", etc.)
- Posición (Izquierda, Centro, Derecha, Especial)
- Nombre del último alumno
- Hora de la última lectura
- Total acumulado de marcaciones

---

## Configuración inicial desde la app

Por defecto, la app viene con esta configuración:

```javascript
// Entrada Norte (por defecto)
{
  id: 'NORTE',
  label: 'Entrada Norte',
  scanners: [
    { id: 'N1', label: 'Puerta Principal', position: 'left', prefix: 'N1|' },
    { id: 'N2', label: 'Puerta Lateral',  position: 'center', prefix: 'N2|' },
    { id: 'N3', label: 'Puerta Trasera',  position: 'right', prefix: 'N3|' },
    { id: 'N4', label: 'Acceso Especial', position: 'special', prefix: 'N4|' },
  ]
}
```

**Para cambiar las etiquetas** (qué hace cada lector), el administrador puede editar la configuración. Esto se guarda en `localStorage` del navegador:

```javascript
// En la consola del navegador (F12):
localStorage.setItem('sca-qr-entrance-config', JSON.stringify({
  id: 'NORTE',
  label: 'Entrada Principal',
  scanners: [
    { id: 'N1', label: 'Tu etiqueta aquí', position: 'left', prefix: 'N1|' },
    { id: 'N2', label: 'Otra etiqueta', position: 'center', prefix: 'N2|' },
    // ... etc
  ]
}));
location.reload();
```

Para una versión más amigable, en producción se recomienda un panel de configuración en la app.

---

## Cambio de entrada (Norte / Sur)

Como cada laptop está en una entrada, hay un selector en la esquina superior izquierda:

```
[Manual] [NORTE|SUR]
```

- Click en **NORTE**: la app trabaja con prefijos `N1|`, `N2|`, etc.
- Click en **SUR**: la app trabaja con prefijos `S1|`, `S2|`, etc.

**Importante:** La laptop de la entrada Norte debe tener la app configurada en "NORTE" y los lectores con prefijos `N1`, `N2`, `N3`, `N4`. La laptop de la entrada Sur, con "SUR" y `S1`, `S2`, etc.

---

## Costo adicional por multi-lector

### Solo hardware (ya tienen laptops e internet)

| Concepto | Precio por entrada |
|---|---|
| 4 lectores QR USB (Netum) | S/ 600 |
| Hub USB alimentado 7 puertos | S/ 60 |
| 4 cables USB extensor | S/ 40 |
| Regleta | S/ 30 |
| **Subtotal hardware (4 lectores)** | **S/ 730** |
| Subtotal hardware (3 lectores, ahorro 1) | **S/ 570** |

### Para 2 entradas completas

| Concepto | Precio |
|---|---|
| 8 lectores (4 por entrada, genéricos) | S/ 720 |
| 2 hubs USB alimentados | S/ 120 |
| 8 cables USB extensor | S/ 80 |
| 2 regletas | S/ 60 |
| **TOTAL 2 entradas con 4 lectores c/u** | **S/ 980** |

(Añadir esto al presupuesto original de S/ 1,740 → total subiría a S/ 2,720 en Opción B)

---

## Cambios al presupuesto original (Opción B)

| Concepto | Antes | Ahora |
|---|---|---|
| 1 lector QR | S/ 150 | S/ 150 (sigue igual, ahora será el principal) |
| 1 lector QR backup | S/ 90 | S/ 90 (sigue igual) |
| 2 lectores QR adicionales | - | S/ 180 |
| Hub USB alimentado | - | S/ 60 |
| Cables y adaptadores | S/ 50 | S/ 90 |
| UPS | S/ 200 | S/ 200 |
| Impresora térmica | S/ 220 | S/ 220 |
| **Subtotal hardware** | **S/ 1,740** | **S/ 1,990** |
| 1 Dominio .com | S/ 45 | S/ 45 |
| 1 VPS DigitalOcean 2 años | S/ 540 | S/ 540 |
| **TOTAL hardware + nube** | **S/ 1,740** | **S/ 1,990** |

**Costo adicional para soporte multi-lector: S/ 250 (4 lectores + hub + cables)**

---

## Cambios al código

### Archivos modificados/creados

| Archivo | Cambio |
|---|---|
| `src/types/attendance.ts` | + tipos `ScannerConfig`, `EntranceConfig`, `MultiScanEvent`, `ScannerStatus` |
| `src/components/MultiScannerInput.tsx` | NUEVO - maneja N lectores con 2 métodos |
| `src/components/ScannerStatusGrid.tsx` | NUEVO - visualización del estado de cada lector |
| `src/app/ingreso/page.tsx` | Reescrito - usa MultiScannerInput + grid + selector Norte/Sur |
| `src/app/api/attendances/scan/route.ts` | + campos `scanner_id` y `entrance_id` en el log |

### Características nuevas en la app

- Grid visual de 4 lectores con estado en tiempo real
- Selector de entrada (Norte / Sur)
- Configuración persistente en localStorage
- Doble método de detección (prefijo + rotación de foco)
- El último resultado se asigna al lector correcto
- Cada card muestra: ID, etiqueta, último alumno, hora, total acumulado

---

## Troubleshooting

### El card de un lector no se ilumina al escanear

**Causa 1:** El prefijo no está bien configurado en el lector.
**Solución:** Volver a configurar el prefijo con los códigos del manual.

**Causa 2:** El lector no está conectado.
**Solución:** Verificar el cable USB, probar en otro puerto.

**Causa 3:** El hub USB no tiene alimentación.
**Solución:** Conectar el adaptador de corriente del hub.

### Las marcaciones se asignan al lector equivocado

**Causa:** El prefijo del lector está mal escrito o no coincide con la configuración de la app.
**Solución:** Verificar que el prefijo en el lector (ej: `N1|`) coincida con la configuración en la app.

### Se pierden lecturas simultáneas

**Causa:** Rotación de foco no es lo suficientemente rápida.
**Solución:** Configurar los prefijos en los lectores (Método 1).

### La app va lenta con 4 lectores

**Causa:** El navegador está procesando muchos eventos.
**Solución:** Usar Chrome o Edge (mejor manejo de eventos), cerrar otras pestañas, desactivar extensiones.

### Un lector no enciende

**Causa:** Cable dañado, puerto USB quemado, hub sin alimentación.
**Solución:** Probar con otro cable, otro puerto, conectar directamente a la laptop sin hub.

---

## Resumen de la solución

| Pregunta | Respuesta |
|---|---|
| ¿Cuántos lectores soporta? | Hasta 4 (configurable, podría ser más) |
| ¿Necesito configurar cada lector? | Recomendado, pero no obligatorio |
| ¿Necesito un hub especial? | Sí, con alimentación (powered) |
| ¿Funciona con cualquier marca? | Sí, siempre que sean USB HID |
| ¿Puedo tener entradas diferentes? | Sí, selector Norte/Sur en la app |
| ¿Se sincroniza con el servidor? | Sí, registra scanner_id y entrance_id |

---

## Contacto

**Configuración realizada por:** [Tu nombre]
**Fecha:** Octubre 2026
**Versión:** 1.0

Para soporte adicional:
- WhatsApp: [tu número]
- Correo: [tu correo]
