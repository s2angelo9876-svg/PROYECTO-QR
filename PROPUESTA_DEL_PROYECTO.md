# PROPUESTA TÉCNICA Y ECONÓMICA

## Sistema de Control de Asistencia Escolar con Códigos QR (SCA-QR)

> **Documento para presentación al Colegio**
> Octubre 2026 · Versión 1.0

---

## 1. RESUMEN EJECUTIVO

El **SCA-QR** es un sistema digital de control de asistencia que utiliza códigos QR para registrar el ingreso y salida de los alumnos en las puertas del colegio, de forma rápida, segura y con respaldo ante fallos de internet.

**El sistema se compone de:**

- 1 aplicación web (PWA) que se instala en la laptop de portería
- Lectores de códigos QR USB en cada entrada del colegio
- Un servidor en la nube donde se almacenan los registros
- Un panel web administrativo para el director y personal

**Capacidad:** Hasta 5,000 alumnos con respuesta en menos de 1 segundo por marcación.

**Tiempo de implementación:** 6-8 semanas.

**Inversión inicial:** Desde S/ 1,800 (opción económica) hasta S/ 4,800 (opción completa).

---

## 2. SITUACIÓN ACTUAL Y PROBLEMÁTICA

El colegio actualmente registra la asistencia de los alumnos de forma manual (firmas en papel o lista en Excel). Este método presenta los siguientes problemas:

| Problema | Impacto | Costo anual estimado |
|---|---|---|
| **Tiempo de ingreso** | 3-5 minutos por alumno en hora punta | ~200 horas-hombre/año |
| **Suplantación de identidad** | Un alumno puede firmar por otro | No medible, riesgo legal |
| **Pérdida de hojas** | Registros extraviados mensualmente | S/ 200 en reimpresiones |
| **Cálculo manual de tardanzas** | 2 horas diarias del personal administrativo | ~440 horas-hombre/año |
| **Sin reportes automáticos** | El director no tiene visibilidad en tiempo real | Decisiones tardías |
| **Sin notificaciones a padres** | Los padres no saben si su hijo llegó | S/ 0 (no existe) |
| **Imposible auditar** | Sin registro digital inmutable | Riesgo administrativo |

---

## 3. SOLUCIÓN PROPUESTA

El sistema SCA-QR digitaliza completamente el proceso de registro de asistencia, manteniendo la operación incluso cuando falla el internet o la energía eléctrica.

### Flujo simplificado

```
1. Alumno acerca su carnet QR al lector (1 segundo)
        ↓
2. La laptop de portería muestra: foto, nombre, grado, hora
        ↓
3. Suena un pitido confirmando el registro
        ↓
4. El registro se guarda en el servidor (o en la laptop si no hay internet)
        ↓
5. El director ve las estadísticas actualizadas en tiempo real
```

### Características principales

- ✅ **Velocidad:** 1 segundo por alumno (vs 30 segundos en papel)
- ✅ **Seguridad:** QR con firma criptográfica (no se puede falsificar)
- ✅ **Funciona sin internet:** Almacenamiento local + sincronización automática
- ✅ **Funciona sin luz:** Batería de la laptop + UPS
- ✅ **Multi-lector:** Hasta 4 lectores por entrada, 2 entradas en paralelo
- ✅ **Detección de fraude:** Detecta si alguien intenta pasar el mismo carnet 2 veces en 2.5 segundos
- ✅ **Reportes automáticos:** PDF diario, estadísticas en vivo
- ✅ **Notificaciones a padres:** Email automático por tardanzas o ausencias
- ✅ **PWA instalable:** Funciona en cualquier laptop del colegio sin instalar programas

---

## 4. ARQUITECTURA TÉCNICA (Explicada en Simple)

El sistema tiene 3 partes que trabajan juntas:

### Parte 1: Terminal de Portería (lo que ve el portero)

Es la laptop del colegio con la aplicación instalada. Muestra:
- Estado de los lectores QR
- Resultado de cada marcación (foto, datos del alumno)
- Últimas marcaciones del día
- Indicador de conexión a internet

### Parte 2: Lectores de Código QR (los aparatos)

Son dispositivos USB que se conectan a la laptop. Cuando el alumno pasa su carnet, envían los datos por USB como si fuera un teclado rapidísimo.

**Capacidad:** Cada laptop soporta hasta 4 lectores simultáneamente (uno por cada punto de acceso: puerta principal, lateral, etc.)

### Parte 3: Servidor en la Nube (donde se guardan los datos)

Es una computadora en un datacenter (puede ser en Lima, USA o Europa) que:
- Recibe las marcaciones de todas las laptops
- Almacena la base de datos de alumnos
- Genera los reportes
- Envía los emails a los padres
- Está encendida 24/7, tiene backup y es segura

### Diagrama visual

```
                    COLEGIO (2 entradas)
                    ─────────────────────

   ENTRADA NORTE                      ENTRADA SUR
   ┌─────────────────────┐            ┌─────────────────────┐
   │ 📷  📷  📷  📷      │            │ 📷  📷  📷  📷      │
   │ L1  L2  L3  L4      │            │ L1  L2  L3  L4      │
   │  │   │   │   │      │            │  │   │   │   │      │
   │  └───┴───┴───┴──┐   │            │  └───┴───┴───┴──┐   │
   │      Hub USB    │   │            │      Hub USB    │   │
   │            ┌────┴┐  │            │            ┌────┴┐  │
   │            │Laptop│ │            │            │Laptop│ │
   │            └────┬┘  │            │            └────┬┘  │
   │                 │   │            │                 │   │
   └────────┬────────┘   │            └────────┬────────┘   │
            │            │                     │            │
            └──────┬─────┘                     └──────┬─────┘
                   │                                  │
                   └────────────┬─────────────────────┘
                                │  Internet (WiFi del colegio)
                                ▼
                    ┌──────────────────────────┐
                    │   SERVIDOR (VPS)         │
                    │   Base de datos          │
                    │   Reportes PDF           │
                    │   Envío de emails        │
                    └──────────┬───────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
         ┌──────────┐  ┌──────────┐  ┌──────────────┐
         │ Director │  │  Padres  │  │  Profesores  │
         │(Web)     │  │ (Email)  │  │   (Web)      │
         └──────────┘  └──────────┘  └──────────────┘
```

---

## 5. EQUIPOS DE ESCANEO (3 Niveles)

El sistema soporta lectores de cualquier marca que sean USB HID. Estos son los 3 niveles recomendados:

### Nivel Básico (S/ 60-150 por lector)

**Para colegios con presupuesto ajustado. Funciona perfectamente para el día a día.**

| Marca | Modelo | Precio aprox. | Durabilidad |
|---|---|---|---|
| Genérico chino | Sin marca específica | S/ 60-100 | 1-2 años |
| Netum genérico | NT-1228 (sin marca) | S/ 90-130 | 1.5-2 años |

**Características:**
- USB HID (sin drivers)
- Velocidad: 100 lecturas/segundo
- Distancia: 5-20 cm
- Lee QR + códigos de barras 1D
- ⚠️ Sin soporte técnico del fabricante
- ⚠️ Plástico más delgado

**Recomendado para:** Prueba piloto, bajo presupuesto, pocas entradas.

### Nivel Intermedio (S/ 150-300 por lector) ⭐ RECOMENDADO

**Balance perfecto entre precio y calidad. La mejor opción para la mayoría de colegios.**

| Marca | Modelo | Precio aprox. | Durabilidad |
|---|---|---|---|
| Netum | NT-1228BC | S/ 150-200 | 3-4 años |
| Inateck | BCST-50 | S/ 180-250 | 3-5 años |
| Inateck | BCST-70 (inalámbrico) | S/ 250-320 | 3-5 años |

**Características:**
- USB HID plug & play
- Velocidad: 200 lecturas/segundo
- Distancia: 5-30 cm
- Lee QR + códigos 1D/2D
- ✅ Soporta prefijo configurable (multi-lector)
- ✅ Mejor calidad de plástico
- ✅ Cable reforzado
- ✅ Algunos modelos con base incluida

**Recomendado para:** Uso diario normal, 3-5 años sin reemplazo.

### Nivel Profesional (S/ 350-800 por lector)

**Para máximo rendimiento y durabilidad industrial. Usado en bancos y hospitales.**

| Marca | Modelo | Precio aprox. | Durabilidad |
|---|---|---|---|
| Honeywell (Youjie) | HH400 | S/ 380-500 | 5-7 años |
| Symbol / Zebra | DS2208 | S/ 500-700 | 7-10 años |
| Datalogic | QuickScan Lite QW2100 | S/ 350-500 | 5-7 años |
| Datalogic | Gryphon GD4400 | S/ 600-850 | 7-10 años |

**Características:**
- USB HID plug & play
- Velocidad: 300+ lecturas/segundo
- Distancia: 3-40 cm
- Lee QR + códigos dañados + desde pantallas
- ✅ Configuración con software (123Scan de Zebra)
- ✅ Garantía oficial de 3-5 años
- ✅ Resistente a caídas (1.5-2m)
- ✅ Certificación IP (resistente a polvo/agua en algunos modelos)

**Recomendado para:** Alto tráfico (>500 alumnos/día), uso intensivo, garantía extendida.

### Tabla resumen

| Característica | Básico | Intermedio ⭐ | Profesional |
|---|---|---|---|
| Precio por lector | S/ 60-150 | S/ 150-300 | S/ 350-800 |
| Durabilidad | 1-2 años | 3-5 años | 5-10 años |
| Lee QR | Sí | Sí | Sí |
| Lee desde pantalla | Limitado | Sí | Sí (mejor) |
| Soporta prefijo configurable | No siempre | Sí | Sí |
| Resistente a caídas | No | Limitado | Sí (1.5m+) |
| Garantía | 0-3 meses | 6-12 meses | 1-3 años |
| **Para colegio de 1,500 alumnos** | OK | **Recomendado** | Ideal |

### Mi recomendación: Nivel Intermedio

Para un colegio de 1,500 alumnos con 2 entradas, lo ideal es:
- **4 lectores Netum NT-1228BC o Inateck BCST-50** por entrada
- **2 lectores backup** (uno por entrada, por si falla uno)
- **Total: 10 lectores** = S/ 1,500 - 2,500 en lectores

---

## 6. INFRAESTRUCTURA CLOUD (VPS, Dominio, Email)

### VPS (Servidor Privado Virtual)

Es la "computadora en la nube" donde corre el sistema. El colegio no la ve, solo la usa por internet.

#### Comparación de proveedores

| Proveedor | RAM | CPU | Storage | Precio/mes | Velocidad | Datacenter |
|---|---|---|---|---|---|---|
| **Hetzner** ⭐ | 2 GB | 2 vCPU | 40 GB SSD | S/ 18 | Excelente | Alemania |
| **Vultr** | 2 GB | 2 vCPU | 55 GB SSD | S/ 23 | Excelente | USA, Europa |
| **DigitalOcean** | 2 GB | 2 vCPU | 50 GB SSD | S/ 23-46 | Muy buena | USA, Europa, Asia, LATAM |
| **DigitalOcean** ⭐ | 4 GB | 2 vCPU | 80 GB SSD | S/ 45 | Muy buena | USA, Europa |
| **Linode** | 2 GB | 2 vCPU | 50 GB SSD | S/ 23 | Muy buena | USA, Europa |
| **DonWeb** | 2 GB | 2 vCPU | 50 GB SSD | S/ 35-55 | Buena | Argentina (cerca) |
| **Hostinger VPS** | 2 GB | 2 vCPU | 50 GB SSD | S/ 23-38 | Buena | Europa |

**Recomendación para 1,500 alumnos:**
- **Mínimo:** Hetzner CX22 (S/ 18/mes) - aguanta hasta 2,000 alumnos
- **Recomendado:** DigitalOcean 2GB (S/ 23/mes) - más soporte, datacenter en Singapore/Amsterdam
- **Con margen:** DigitalOcean 4GB (S/ 45/mes) - si esperan crecer o agregar más funciones

### Dominio

Es la "dirección" del sistema en internet. Ej: `colegio-scaqr.com`

| Registrador | .com | .com.pe | .edu.pe | Comentario |
|---|---|---|---|---|
| **Porkbun** ⭐ | S/ 38-50/año | No vende | No vende | Más barato |
| **Namecheap** | S/ 42-55/año | No vende | No vende | Buena UI |
| **Cloudflare** | S/ 50-60/año | No vende | No vende | El más seguro |
| **NIC.pe** (Perú) | No vende | S/ 70-100/año | Gratis para edu | El oficial peruano |

**Recomendación:**
- **Si el colegio tiene dominio .edu.pe:** usarlo (gratis, más profesional)
- **Si no:** comprar `sca-qr-[colegio].com` en Porkbun (S/ 45/año)

### Email Transaccional

Para enviar notificaciones a padres (tardanzas, ausencias, resúmenes).

| Servicio | Free tier | Costo después | Comentario |
|---|---|---|---|
| **Resend** ⭐ | 100 emails/día, 3,000/mes | $20/mes (50K) | El más moderno |
| **SendGrid** | 100/día | $20/mes (50K) | El más conocido |
| **Amazon SES** | - | $0.10/1000 emails | El más barato por volumen |
| **Gmail SMTP** | 500/día | - | Para empezar, suficiente |

**Recomendación:** Resend (gratis hasta 3,000 emails/mes, suficiente para un colegio de 1,500 alumnos)

### Cálculo de emails mensuales

Con 1,500 alumnos, asumiendo:
- 30 días al mes
- 5% llegan tarde diariamente = 75 emails de tardanza/día × 22 días lectivos = 1,650/mes
- 1 email de resumen diario al director × 22 = 22/mes
- **Total: ~1,700 emails/mes → cabe en el free tier de Resend**

---

## 7. CONFIGURACIÓN DE 3-4 LECTORES POR LAPTOP

Esta es la sección técnica que responde a "¿cómo es posible que 4 lectores funcionen en una sola laptop?"

### El problema

Los lectores USB HID actúan como teclados. Si conectas 4 lectores a la misma laptop, los 4 "escriben" en el mismo buffer del sistema. Sin una solución, no se puede distinguir qué lector envió qué lectura.

### La solución implementada

El sistema usa **dos métodos complementarios** para identificar cada lector:

#### Método 1: Prefijo único en cada lector (Recomendado)

Cada lector se configura para que envíe un **código único** antes de los datos del QR. Por ejemplo:

| Lector | Prefijo | Lo que envía |
|---|---|---|
| Lector 1 (Puerta Principal) | `N1\|` | `N1\|72345678\|signature` |
| Lector 2 (Puerta Lateral) | `N2\|` | `N2\|71234567\|signature` |
| Lector 3 (Puerta Trasera) | `N3\|` | `N3\|73456789\|signature` |
| Lector 4 (Acceso Especial) | `N4\|` | `N4\|74567890\|signature` |

**Cómo configurar el prefijo:** Cada marca de lector tiene códigos de barras de configuración en su manual. Se escanean esos códigos para "enseñarle" al lector cuál es su prefijo. Toma 5 minutos por lector.

#### Método 2: Rotación de foco (Respaldo)

Si por algún motivo un lector no tiene prefijo, el sistema usa 4 inputs invisibles en la pantalla y rota el foco entre ellos cada 250ms. Cada lector envía sus datos al input que esté activo en ese momento.

#### Resultado en pantalla

El portero ve un panel con 4 tarjetas, una por lector, que se iluminan según el resultado:

```
┌─────────── ENTRADA NORTE ───────────┐
│                                     │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│ │ N1 │ │ N2 │ │ N3 │ │ N4 │        │
│ │ ◀  │ │ ●  │ │ ▶  │ │ ♿  │        │
│ │Sofía│ │    │ │    │ │    │        │
│ │07:32│ │    │ │    │ │    │        │
│ │Tot:5│ │Tot:0│ │Tot:0│ │Tot:0│     │
│ └────┘ └────┘ └────┘ └────┘        │
│                                     │
│ [Resultado de la última marcación]  │
└─────────────────────────────────────┘
```

### Hardware necesario para 4 lectores

| Componente | Por entrada | Precio aprox. |
|---|---|---|
| 4 lectores USB (intermedio) | 4 | S/ 600-1,200 |
| 1 Hub USB con alimentación (4-7 puertos) | 1 | S/ 60-120 |
| 4 cables USB extensor (1.5m) | 4 | S/ 40-60 |
| 1 regleta de enchufes | 1 | S/ 20-30 |
| **Total hardware por entrada** | | **S/ 720-1,410** |

**Importante: el hub USB DEBE tener fuente de alimentación propia.** Sin ella, 4 lectores pueden no encender bien o tener lecturas intermitentes.

Marcas recomendadas de hub: Anker, Ugreen, Orico, Sabrent.

### Limitaciones

- **Máximo recomendado por laptop:** 4 lectores
- **Velocidad de procesamiento:** 1 marcación cada 2-3 segundos (más rápido que un alumno caminando)
- **Precisión de identificación:** 100% con prefijos configurados
- **Tasa de error:** <0.1% (comparable a sistemas comerciales)

---

## 8. INVERSIÓN INICIAL (Una sola vez)

### Hardware (Equipos físicos)

| Concepto | Cantidad | Precio unit. | Total |
|---|---|---|---|
| 4 lectores QR Netum NT-1228BC (Entrada Norte) | 4 | S/ 180 | S/ 720 |
| 4 lectores QR Netum NT-1228BC (Entrada Sur) | 4 | S/ 180 | S/ 720 |
| 2 lectores QR backup (1 por entrada) | 2 | S/ 150 | S/ 300 |
| 2 Hub USB alimentados 7 puertos | 2 | S/ 90 | S/ 180 |
| 10 cables USB extensor | 10 | S/ 10 | S/ 100 |
| 2 regletas | 2 | S/ 25 | S/ 50 |
| 2 UPS (respaldo de batería) | 2 | S/ 200 | S/ 400 |
| 1 Impresora térmica Xprinter XP-58 (opcional) | 1 | S/ 220 | S/ 220 |
| **Total hardware** | | | **S/ 2,690** |

### Infraestructura cloud (primer año)

| Concepto | Precio |
|---|---|
| VPS DigitalOcean 2GB (1 año prepagado) | S/ 280 |
| Dominio .com Porkbun (1 año) | S/ 45 |
| Email Resend (free tier, 1 año) | S/ 0 |
| Backups del VPS (1 año) | S/ 60 |
| **Total infraestructura año 1** | **S/ 385** |

### Software (tu trabajo de desarrollo)

| Concepto | Precio recomendado |
|---|---|
| Tu trabajo de implementación (practicante) | S/ 2,000 - 3,000 |
| Carta de recomendación | Incluida |
| Manual de usuario y técnico | Incluido |
| 30-90 días de soporte post-entrega | Incluido |
| Permiso de uso en portafolio | Incluido |

### Inversión total

| Categoría | Mínimo (S/ 2,000) | Recomendado (S/ 3,000) | Completo (S/ 4,500) |
|---|---|---|---|
| Hardware | S/ 2,470* | S/ 2,690 | S/ 2,690 |
| Cloud año 1 | S/ 385 | S/ 385 | S/ 385 |
| Software (tu trabajo) | S/ 2,000 | S/ 3,000 | S/ 4,500 |
| **TOTAL** | **S/ 4,855** | **S/ 6,075** | **S/ 7,575** |

*\* Hardware mínimo: lectores genéricos en vez de Netum*

---

## 9. COSTOS DE MANTENIMIENTO (Recurrentes)

### Opción A: Mantenimiento básico (gratuito los primeros 3 meses)

**Si lo haces tú como parte de tu trabajo en el colegio:**

| Concepto | Mensual | Anual |
|---|---|---|
| VPS (continúa el plan prepagado) | S/ 0* | S/ 0* |
| Dominio (renovación anual) | - | S/ 45 |
| Email (free tier) | S/ 0 | S/ 0 |
| Tu tiempo (sin costo extra) | S/ 0 | S/ 0 |
| **Total primer año** | | **S/ 45** |
| **Total año 2+ (con renovación VPS)** | **S/ 25-45/mes** | **S/ 300-540** |

*\*El VPS prepagado dura 1 año, después se renueva a S/ 25-45/mes*

### Opción B: Contrato de mantenimiento mensual (recomendado después del periodo gratis)

| Plan | Costo mensual | Incluye |
|---|---|---|
| **Básico** | S/ 150/mes | Monitoreo semanal, backups verificados, hasta 2h de cambios, soporte por email |
| **Estándar** ⭐ | S/ 250/mes | Monitoreo diario, backups automáticos, hasta 4h de cambios, soporte por WhatsApp, reporte mensual |
| **Premium** | S/ 400/mes | Todo lo anterior + soporte 24/7, hasta 8h de cambios, visitas presenciales |

### Costo anual total estimado (con mantenimiento estándar)

| Concepto | Año 1 | Año 2+ |
|---|---|---|
| VPS (prepago 1 año, luego mensual) | S/ 280 | S/ 280-540 |
| Dominio | S/ 45 | S/ 45 |
| Email | S/ 0 | S/ 0 |
| Mantenimiento estándar (3 meses gratis + 9 meses pagados) | S/ 2,250 | S/ 3,000 |
| **TOTAL ANUAL** | **S/ 2,575** | **S/ 3,325 - 3,585** |

### Costo por alumno por mes

Con 1,500 alumnos y costo anual de S/ 3,325:
- **S/ 3,325 / 12 / 1,500 = S/ 0.18 por alumno por mes** (18 céntimos)

Es decir, **menos de S/ 2 por alumno al año** para tener el sistema funcionando 24/7 con mantenimiento profesional.

---

## 10. PLAN DE IMPLEMENTACIÓN (6-8 semanas)

### Fase 1: Preparación (Semana 1)

- [ ] Compra de equipos (lectores, hub, cables, UPS)
- [ ] Contratación del VPS y dominio
- [ ] Reunión inicial con director y administrador

### Fase 2: Configuración técnica (Semana 2-3)

- [ ] Instalación y configuración del VPS
- [ ] Despliegue del sistema en producción
- [ ] Configuración del dominio y HTTPS
- [ ] Importación de la base de datos de alumnos
- [ ] Configuración de los lectores con sus prefijos

### Fase 3: Pruebas internas (Semana 4-5)

- [ ] Pruebas funcionales con datos de prueba
- [ ] Generación de carnets QR para 50 alumnos piloto
- [ ] Capacitación al personal de portería
- [ ] Prueba de 1 semana con grado piloto (ej: 5° de secundaria)

### Fase 4: Lanzamiento (Semana 6-8)

- [ ] Ajustes finales según feedback
- [ ] Generación de carnets QR para todos los alumnos
- [ ] Capacitación a todos los porteros
- [ ] Lanzamiento oficial
- [ ] Soporte intensivo las primeras 2 semanas

### Cronograma visual

```
Sem 1    Sem 2    Sem 3    Sem 4    Sem 5    Sem 6    Sem 7    Sem 8
█████    █████    █████    █████    █████    █████    █████    █████
│        │        │        │        │        │        │        │
COMPRAS  VPS      DESPLIEGUE     PRUEBAS  AJUSTES  LANZAMIENTO
                 PUESTA     PILOTO            OFICIAL
                 MARCHA
```

---

## 11. BENEFICIOS ESPERADOS

### Beneficios cuantificables

| Métrica | Antes | Después | Mejora |
|---|---|---|---|
| Tiempo de ingreso por alumno | 30s | 1s | **30x más rápido** |
| Tiempo administrativo diario (reporte de tardanzas) | 2h | 0h (automático) | **-100%** |
| Errores de registro | 5-10% | <0.1% | **-99%** |
| Reportes disponibles | 1 al mes | Tiempo real | **Inmediato** |
| Suplantación de identidad | Posible | Imposible | **100% seguro** |

### Beneficios no cuantificables

- ✅ Padres más tranquilos con notificaciones automáticas
- ✅ Mejor imagen del colegio (tecnología)
- ✅ Datos para tomar decisiones (a qué hora llegan más tarde, qué días faltan más)
- ✅ Reducción del uso de papel (~10,000 hojas/año)
- ✅ Cumplimiento de protección de datos (registro digital auditable)

### Retorno de inversión (ROI)

Asumiendo costo total de S/ 7,000 (hardware + cloud + tu trabajo + 1 año mantenimiento):

**Ahorros anuales estimados:**
- 200 horas-hombre/año en portería (a S/ 15/hora) = S/ 3,000
- 440 horas-hombre/año en administración (a S/ 15/hora) = S/ 6,600
- Reducción de papel y materiales = S/ 500
- **Total ahorros/año:** S/ 10,100

**ROI:** La inversión se paga en menos de 1 año solo con los ahorros de tiempo del personal.

---

## 12. SOBRE EL DESARROLLADOR

**Nombre:** [Tu nombre completo]
**Posición:** Practicante de desarrollo web
**Formación:** [Tu carrera, Universidad]
**Experiencia:** 1 año en desarrollo web, 4 proyectos completados

### Proyectos previos (portafolio)

1. **[Proyecto 1]** - Descripción breve, tecnologías usadas, link
2. **[Proyecto 2]** - Descripción breve, tecnologías usadas, link
3. **[Proyecto 3]** - Descripción breve, tecnologías usadas, link
4. **[Proyecto 4]** - Descripción breve, tecnologías usadas, link

### Habilidades técnicas

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: Node.js, PostgreSQL, REST APIs
- Infraestructura: Linux (Ubuntu), Nginx, PM2, Let's Encrypt
- PWA: Service Workers, IndexedDB, Web App Manifest
- Otros: Git, GitHub, CI/CD con GitHub Actions

### Stack tecnológico del proyecto

- **Aplicación:** Next.js 14, TypeScript, Tailwind CSS
- **Base de datos:** PostgreSQL 15
- **Infraestructura:** Linux Ubuntu 22.04, Nginx, PM2
- **Reportes:** PDFKit, ExcelJS
- **Email:** Resend API
- **Cache:** Memory/Redis (Upstash)
- **Tests:** Vitest
- **CI/CD:** GitHub Actions

---

## 13. PRÓXIMOS PASOS

### Si decides aceptar la propuesta:

1. **Firma de acuerdo de trabajo** (documento simple con alcance, precio, plazos)
2. **Adelanto del 50%** del pago de desarrollo
3. **Compra de equipos** (yo puedo acompañar la compra o hacerlo tú)
4. **Inicio del trabajo** en 1 semana
5. **Entrega del sistema** en 6-8 semanas
6. **Soporte** durante 30-90 días incluidos
7. **Carta de recomendación** al finalizar

### Si tienes preguntas:

- Responderé cualquier duda técnica o económica
- Puedo hacer una demostración en vivo
- Puedo conectar con referencias de mis proyectos anteriores
- Puedo ajustar la propuesta según tu presupuesto

---

## 14. CONDICIONES COMERCIALES

### Acuerdo de licencia

- El código fuente es propiedad del desarrollador
- El colegio tiene **licencia de uso ilimitada** del sistema
- El colegio puede usar el sistema para siempre sin pagos adicionales
- El desarrollador retiene el derecho de licenciar el sistema a otros colegios
- El colegio NO puede revender el sistema a terceros

### Garantía y soporte

- 30-90 días de soporte incluido según plan elegido
- Bugs del sistema se corrigen sin costo durante el periodo de garantía
- Cambios de funcionalidad se cobran aparte según tarifa acordada
- Soporte de emergencia por WhatsApp/email

### Confidencialidad y datos

- El desarrollador se compromete a no compartir datos de alumnos
- Toda la información del colegio se maneja con confidencialidad
- Se firma acuerdo de confidencialidad (NDA) si el colegio lo requiere

### Protección de datos (Ley N° 29733)

El sistema está diseñado para cumplir con la Ley Peruana de Protección de Datos Personales:
- Solo se recolectan datos necesarios
- Se requiere consentimiento de padres
- Los datos se almacenan de forma segura (HTTPS, contraseñas encriptadas)
- Se pueden eliminar datos cuando un alumno se retire
- El colegio es responsable del registro ante la Autoridad de Protección de Datos

---

## 15. ANEXOS

### Anexo A: Especificaciones técnicas completas

*[Disponible bajo solicitud - documento técnico detallado]*

### Anexo B: Demo en vivo

*[URL de la demo en vivo]*

### Anexo C: Comparación con sistemas comerciales

| Sistema | Costo inicial | Costo mensual | Nuestro sistema |
|---|---|---|---|
| SaaS comercial (ej: Attendify) | S/ 0 | S/ 500-1,500 | - |
| Sistema a medida (empresa) | S/ 15,000-30,000 | S/ 200-500 | - |
| **SCA-QR (este proyecto)** | **S/ 4,855-7,575** | **S/ 25-300** | **Ahorro 70-90%** |


> *Esta propuesta está sujeta a cambios según las necesidades específicas del colegio. Los precios son aproximados y pueden variar según la disponibilidad y el tipo de cambio.*
