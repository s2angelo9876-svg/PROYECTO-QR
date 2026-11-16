# Proyecto SCA-QR

## Sistema de Control de Asistencia Escolar con Códigos QR

> **Documento para estudiantes de 5.° de Secundaria**
> Última actualización: Octubre 2026 · Versión 2.0

---

## Situación actual del colegio

Este proyecto ya cuenta con parte de la infraestructura lista:

| Recurso | Estado | Detalle |
|---|---|---|
| Laptops / Computadoras | Disponible | Para la portería |
| Internet (WiFi o cable) | Disponible | Ya instalado en el colegio |
| Mouse | Disponible | Para la laptop de portería |
| **Lector de QR** | **Por comprar** | S/ 80 - 400 según marca |
| **Servidor (VPS)** | **Por contratar** | S/ 20 - 50/mes |
| **Dominio web** | **Por comprar** | S/ 40 - 150/año |
| **Almacenamiento en la nube** | **Por contratar** | S/ 5 - 20/mes |

**Presupuesto disponible: S/ 2,000 a S/ 3,000**

---

## ¿Qué es SCA-QR?

SCA-QR son las siglas de **Sistema de Control de Asistencia** con códigos QR. Es una aplicación que se instala en la laptop de la puerta del colegio y que, al pasar el carnet de un alumno, registra la hora de entrada o salida en menos de un segundo.

En vez de firmar una lista en papel (lento, se pierde, alguien puede firmar por otro), el alumno acerca su carnet a un lector. Inmediatamente suena un pitido y aparece en pantalla su foto, nombre, grado y la hora exacta. Eso es todo.

### ¿Por qué es mejor que el sistema actual?

| Sistema tradicional (papel) | SCA-QR (digital) |
|---|---|
| 3-5 minutos de fila | 1 segundo por alumno |
| Se puede firmar por otro (suplantación) | Cada carnet es único y se valida |
| Se pierden las hojas | Todo queda en la nube |
| No hay registro de tardanzas | Calcula puntual vs tarde automáticamente |
| No funciona si se va la luz | La laptop tiene batería y la app guarda en memoria local |
| No funciona sin internet | Guarda los datos y sincroniza luego |

---

## ¿Qué es una PWA? (Explicado fácil)

**PWA** significa *Progressive Web App* (Aplicación Web Progresiva). Es como una página web, pero que se comporta como una aplicación de celular o de computadora.

### Comparación con cosas que ya conoces

| Aplicación normal (como WhatsApp) | Página web normal | **PWA (como la nuestra)** |
|---|---|---|
| Se descarga de la tienda | Se abre en el navegador | **Se abre en el navegador PERO se puede "instalar"** |
| Ocupa mucho espacio | No ocupa espacio | **Ocupa muy poco espacio** |
| Necesita internet | Necesita internet | **Funciona sin internet** |
| Hay que actualizarla a mano | Se actualiza sola | **Se actualiza sola** |

### ¿Cómo se "instala"?

1. Abres `http://colegio.sca-qr.com/ingreso` en Chrome o Edge (en la laptop de portería)
2. Aparece un ícono de instalar (parece una pantalla con una flecha) en la barra de direcciones
3. Le das click y se abre como una ventana aparte, sin barra del navegador
4. Listo, ya tienes la app. La próxima vez la abres desde el escritorio como cualquier programa

### Las 3 partes mágicas de una PWA

**1. Service Worker (El vigilante)**
Es un pequeño programa que se ejecuta en segundo plano. Aunque cierres la ventana, él sigue ahí, vigilando. Si te quedas sin internet, él se encarga de que la app siga funcionando. Cuando vuelve el internet, sincroniza todo.

*Analogía:* Es como el guardia nocturno de una tienda. Aunque no haya clientes, él sigue cuidando que todo esté en orden.

**2. IndexedDB (La memoria secreta)**
Es una base de datos que vive dentro del navegador. La app guarda ahí los registros cuando no hay internet, igual que un cuaderno donde anotas las cosas para pasarlas después a la lista oficial.

*Analogía:* Es como la libreta de apuntes del portero. Si se le olvida algo, ahí lo tiene guardado.

**3. Manifest (La tarjeta de presentación)**
Es un archivo que le dice al navegador: "Hola, soy una app, mi ícono es este, mi nombre es SCA-QR, cuando me abras quiero estar en pantalla completa". Es lo que hace que el navegador te ofrezca "instalarla".

*Analogía:* Es la carátula de un álbum de música. Te dice qué es y cómo debe verse.

---

## ¿Cómo funciona el sistema completo?

### Diagrama general

```
   ALUMNOS                    PORTERÍA                       SERVIDOR (VPS)
   -------                    --------                       ---------------
                                
   [Carnet QR]                                                  
        |                                                        
        |  1. Acerca                                           
        v                                                        
   [Lector USB]                                                 
        |                                                        
        |  2. Envía números                                   
        v                                                        
   [Laptop]                                                      
        |                                                        
        |  3. ¿Hay internet?                                   
        |     /          \                                     
        |   NO            SI                                   
        |    |              |                                   
        |    v              v                                   
        |  Guarda      Envía datos ----------------------------> [Base de datos]
        |  local            |                                   [Almacenamiento]
        |    |              |                                          |
        |    v              v                                          |
        |  Muestra      Muestra <-------------------------------------+
        |  resultado    resultado
        |                                                        
        v                                                        
   [Pantalla con foto]                                            
```

### Flujo cuando un alumno pasa su carnet

```
1. Alumno acerca su carnet QR al lector
                |
                v
2. El lector envía los números a la laptop (como si fuera un teclado)
                |
                v
3. La app captura los números y los valida
                |
                v
4. La app consulta al servidor (VPS) por internet
                |
                v
5. El servidor busca al alumno y responde
                |
                v
6. La laptop muestra la foto, nombre y estado (PUNTUAL/TARDE)
                |
                v
7. Suena un pitido de confirmación
                |
                v
8. Se guarda el registro en el servidor
```

### ¿Qué pasa si no hay internet?

```
Sin internet → La app guarda en la memoria local de la laptop
              → Cuando vuelve el internet → Se sincroniza automáticamente al VPS
              → Suena un pitido diferente para que el portero se entere
```

### ¿Qué pasa si alguien intenta suplantar a otro?

El sistema tiene **dos protecciones**:

**Protección 1: Tiempo entre lecturas**
Si alguien intenta escanear 2 carnets en menos de 2.5 segundos, el sistema asume que es trampa y marca una alerta amarilla. (Esta protección es básica, se complementa con la siguiente).

**Protección 2: Firma digital del QR**
Cada QR tiene una "firma" que solo el colegio puede generar. Si alguien imprime un QR falso en papel, el sistema lo detecta y lo rechaza con un cartel rojo: "QR NO AUTÉNTICO".

---

## Lo que necesitamos comprar

### 1. Lector de códigos QR USB

Es un aparatito pequeño que se conecta por USB. Parece una linterna pero con láser rojo. Cuando lees un código, envía los números a la computadora como si estuvieras escribiendo en el teclado, pero rapidísimo.

- **Tipo:** USB HID (teclado)
- **Distancia de lectura:** 5-20 cm
- **Velocidad:** 100 lecturas por segundo
- **Compatibilidad:** Windows, Linux, Mac (todos)

**Marcas recomendadas (de menor a mayor precio):**

| Marca | Modelo ejemplo | Precio aprox. | Calidad |
|---|---|---|---|
| Genérico chino (sin marca) | Tipo Netum básico | S/ 60 - 100 | Funciona, se malogra rápido |
| Netum | NT-1228BC | S/ 120 - 180 | Buena relación calidad/precio |
| Inateck | BCST-50 o BCST-70 | S/ 150 - 220 | Muy confiable |
| Honeywell | HH400 (Youjie) | S/ 350 - 500 | Profesional, casi indestructible |
| Symbol / Zebra | DS2208 | S/ 450 - 700 | El mejor, el más caro |

**¿Cuántos comprar?**
- Mínimo 1 (para la entrada principal)
- Recomendado 2 (uno de backup por si se malogra)
- Si hay varias entradas: 1 por entrada

### 2. UPS / Respaldo de batería (OPCIONAL pero recomendado)

Como la laptop ya tiene batería propia, el UPS no es obligatorio. Sirve para mantener la laptop enchufada y cargada todo el día, sin que se dañe la batería por estar siempre al 100%.

Si el portero usa la laptop desconectada (con su batería), basta con cargarla cada noche.

- **Capacidad sugerida:** 500-1000 VA
- **Tiempo de respaldo:** 10-20 minutos
- **Marcas:** Forza (S/ 130-200), APC (S/ 250-400), CDP (S/ 150-250)

**Decisión recomendada:** Comprar solo si la laptop se va a quedar enchufada 24/7 en la portería.

### 3. Impresora térmica (OPCIONAL)

Para imprimir comprobantes de asistencia si el alumno o padre lo solicita. **No es obligatoria**, la app funciona perfecto sin ella.

- **Tamaño del papel:** 58 mm
- **Velocidad:** 100 mm por segundo
- **Conexión:** USB

| Marca | Precio aprox. |
|---|---|
| Genérica 58 mm | S/ 100 - 180 |
| Xprinter XP-58 | S/ 180 - 280 |
| Epson TM-T20 | S/ 500 - 800 |

---

## Infraestructura en la nube (lo nuevo)

Esta es la parte que no es física: son servicios que se contratan por internet para que el sistema funcione.

### ¿Qué es un VPS?

**VPS** significa *Virtual Private Server* (Servidor Privado Virtual). Es como una computadora que vive en un datacenter lejano, encendida 24/7, y a la que accedemos por internet.

*Analogía:* Imagina que en vez de tener tu laptop en tu casa, la "alquilas" en una oficina de Lima donde siempre hay luz, internet, aire acondicionado y seguridad. Tú te conectas a ella por internet desde donde estés.

**¿Para qué lo necesitamos?**
- Guardar la base de datos de los alumnos
- Recibir las marcaciones de todas las laptops de portería
- Generar reportes para la dirección
- Servir la página web a los padres que quieran ver la asistencia

**¿Qué características debe tener?**

| Característica | Mínimo | Recomendado |
|---|---|---|
| RAM | 2 GB | 4 GB |
| Procesador (vCPU) | 2 núcleos | 2-4 núcleos |
| Almacenamiento (SSD) | 40 GB | 80 GB |
| Ancho de banda | 1 TB/mes | 2-4 TB/mes |
| Sistema operativo | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Proveedores de VPS recomendados

| Proveedor | Precio mensual | Precio anual | Calidad | Comentario |
|---|---|---|---|---|
| **Hetzner** (Alemania) | $4 USD (S/ 15) | $48 (S/ 180) | Excelente | El más barato, datacenter europeo |
| **Vultr** (USA/Global) | $6 USD (S/ 23) | $72 (S/ 270) | Excelente | Datacenters en USA, fácil de usar |
| **DigitalOcean** (USA) | $6-12 USD (S/ 23-46) | $72-144 (S/ 270-540) | Excelente | El más popular para principiantes |
| **Linode** (USA/Akamai) | $5-12 USD (S/ 19-46) | $60-144 (S/ 225-540) | Muy buena | Estable, buena documentación |
| **Contabo** (Alemania) | $4-7 USD (S/ 15-27) | $48-84 (S/ 180-315) | Buena | Muy barato, soporte regular |
| **Hostinger VPS** (Lituania) | $5-10 USD (S/ 19-38) | $60-120 (S/ 225-450) | Buena | Soporte en español |
| **DonWeb** (Argentina) | $8-15 USD (S/ 30-57) | $96-180 (S/ 360-680) | Buena | Datacenter en Argentina (cerca) |
| **GoDaddy VPS** | $20-30 USD (S/ 76-114) | $240-360 (S/ 900-1350) | Regular | Caro para lo que ofrece |

**Recomendación para el colegio:**
- **Si quieres lo más barato y bueno:** Hetzner o Contabo (S/ 15-27/mes)
- **Si quieres lo más fácil de usar:** DigitalOcean o Vultr (S/ 23-46/mes)
- **Si quieres datacenter en Latinoamérica:** DonWeb (Argentina) (S/ 30-57/mes)

**Para nuestro sistema alcanza con un VPS de 2 GB de RAM y 2 vCPU.** El más barato de cualquier proveedor funciona.

### ¿Qué es un dominio?

Un **dominio** es la dirección que la gente escribe en el navegador para entrar a tu página. Es como el "nombre" de tu casa en internet.

- En vez de escribir una IP rara (como `192.168.1.50:3000`)
- Escribes algo fácil: `colegio.sca-qr.com`

*Analogía:* Tu casa tiene una dirección (Av. Lima 123) y no unas coordenadas GPS. El dominio es la "dirección bonita" de tu servidor.

**Extensiones de dominio:**

| Extensión | Ejemplo | Precio anual | Comentario |
|---|---|---|---|
| **.com** | `sca-qr.com` | S/ 38 - 50 | Universal, recomendado |
| **.com.pe** | `colegio.com.pe` | S/ 70 - 130 | Peruano, más serio |
| **.pe** | `colegio.pe` | S/ 80 - 150 | Peruano, corto |
| **.edu.pe** | `colegio.edu.pe` | Gratis o muy barato | Solo para instituciones educativas |
| **.org** | `sca-qr.org` | S/ 45 - 60 | Para organizaciones |
| **.net** | `sca-qr.net` | S/ 45 - 60 | Alternativa al .com |

**Recomendación:**
- Si el colegio tiene `.edu.pe` disponible: úsalo, es profesional y barato
- Si no: comprar un `.com` con el nombre del colegio (ej: `santa-maria-sca.com`)

**Registradores de dominio (dónde comprar el dominio):**

| Registrador | .com | .com.pe | Comentario |
|---|---|---|---|
| **Porkbun** | S/ 38 - 50 | No vende | El más barato para .com |
| **Namecheap** | S/ 42 - 55 | No vende | Buena interfaz, soporte |
| **Cloudflare** | S/ 50 - 60 | No vende | El más seguro, sin markups |
| **GoDaddy** | S/ 80 - 120 | S/ 90 - 130 | El más conocido, más caro |
| **NIC.pe** (Perú) | No vende | S/ 70 - 100 | El oficial para dominios .pe |
| **Hostinger** | S/ 50 - 65 | S/ 80 - 120 | Soporte en español |

**Tip:** Comprar el dominio en Porkbun o Cloudflare. Comprar el VPS aparte. No comprar todo en GoDaddy (es más caro).

### ¿Qué es el almacenamiento?

El **almacenamiento** es donde se guardan los datos: fotos de alumnos, registros de asistencia, backups. Hay dos tipos:

**1. Almacenamiento del VPS (incluido)**
El VPS ya trae 40-80 GB de SSD. Esto es suficiente para:
- Sistema operativo: ~5 GB
- Aplicación backend: ~1 GB
- Base de datos: ~10 GB (1 año de registros)
- Fotos de alumnos: ~5 GB (1000 alumnos x 5MB)
- Backups: ~10 GB

**Conclusión: El espacio del VPS es suficiente. No necesitas comprar almacenamiento adicional por separado.**

**2. Almacenamiento adicional en la nube (opcional, para backups)**
Si quieres guardar una copia de seguridad en otro lugar (por si el VPS se cae o se pierde), puedes contratar un servicio extra:

| Servicio | Precio | Capacidad | Comentario |
|---|---|---|---|
| **Cloudflare R2** | Gratis hasta 10 GB, luego $0.015/GB/mes | Ilimitada | Lo más barato, ideal para backups |
| **Backblaze B2** | $6 USD/TB/mes | Ilimitada | Muy confiable |
| **Wasabi** | $7 USD/TB/mes | Ilimitada | Rápido para restaurar |
| **AWS S3** | $23 USD/TB/mes | Ilimitada | El más usado, el más caro |
| **Google Drive** | S/ 8 - 30/mes según plan | 100 GB - 2 TB | Familiar, pero no profesional |

**Recomendación:** No comprar almacenamiento extra en la primera fase. El VPS alcanza. Si más adelante quieren backups en otro lugar, usar Cloudflare R2 (gratis hasta 10 GB).

### Resumen de costos en la nube

| Servicio | Mensual | Anual | Frecuencia de pago |
|---|---|---|---|
| VPS (Hetzner básico) | S/ 15 - 20 | S/ 180 - 240 | Mensual o anual (con descuento) |
| Dominio .com | - | S/ 40 - 50 | Anual |
| Almacenamiento extra | S/ 0 - 20 | S/ 0 - 240 | Mensual |
| **Total nube/mes** | **S/ 15 - 40** | **S/ 220 - 530** | |

---

## Opciones de presupuesto (actualizado)

### Opción A: Mínima (S/ 2,000 aprox)

**Lo justo para empezar. Todo lo necesario, nada más.**

| Concepto | Qué | Precio | Pago |
|---|---|---|---|
| 1 Lector QR | Genérico chino tipo Netum | S/ 90 | Único |
| 1 Dominio .com | Por 1 año (Porkbun) | S/ 45 | Anual |
| 1 VPS Hetzner | 2 vCPU, 2GB RAM, 40GB SSD - 2 años prepagados | S/ 400 | Cada 2 años |
| 1 UPS básico | Forza 500VA (opcional) | S/ 150 | Único |
| Cable USB extensor | Por si el lector queda lejos | S/ 20 | Único |
| Imprevistos (10%) | - | S/ 70 | - |
| **Subtotal año 1** | | **S/ 775** | |
| **Subtotal año 2** | (solo renovar VPS) | S/ 200 | |
| **TOTAL disponible para 2 años** | | **S/ 1,225** | |

**Te sobran S/ 775 para emergencias o mejoras.**

**Lo que tienes:** Sistema funcionando 2 años completos
**Limitación:** Lector genérico (puede fallar)

---

### Opción B: Recomendada (S/ 2,500 aprox)

**El balance perfecto. Calidad profesional sin gastar de más.**

| Concepto | Qué | Precio | Pago |
|---|---|---|---|
| 1 Lector QR | Netum NT-1228BC (buena calidad) | S/ 150 | Único |
| 1 Lector QR backup | Genérico (por si se malogra el principal) | S/ 90 | Único |
| 1 Dominio .com | Por 1 año (Porkbun) | S/ 45 | Anual |
| 1 VPS DigitalOcean | 2 vCPU, 2GB RAM, 50GB SSD - 2 años prepagados | S/ 540 | Cada 2 años |
| 1 UPS | Forza 1000VA | S/ 200 | Único |
| 1 Impresora térmica | Xprinter XP-58 | S/ 220 | Único |
| Cables y adaptadores | USB extensor, HDMI (si usan monitor extra) | S/ 50 | Único |
| Imprevistos (10%) | - | S/ 130 | - |
| **Subtotal año 1** | | **S/ 1,425** | |
| **Subtotal año 2** | (renovar dominio + VPS) | S/ 315 | |
| **TOTAL disponible para 2 años** | | **S/ 1,740** | |

**Te sobran S/ 760 para próximos pagos o mantenimiento.**

**Lo que tienes:** Sistema robusto, con backup de lector, UPS, impresora y 2 años de servidor
**Limitación:** No tiene almacenamiento en la nube extra (no lo necesita aún)

---

### Opción C: Premium (S/ 3,000 aprox)

**Lo mejor: equipo profesional, infraestructura robusta, todo cubierto por 3 años.**

| Concepto | Qué | Precio | Pago |
|---|---|---|---|
| 2 Lectores QR | Honeywell HH400 (profesionales) | S/ 800 | Único |
| 1 Dominio .com | Por 3 años (Porkbun) | S/ 130 | Cada 3 años |
| 1 VPS DigitalOcean | 2 vCPU, 4GB RAM, 80GB SSD - 3 años prepagados | S/ 990 | Cada 3 años |
| 1 UPS APC | 600VA (marca líder) | S/ 280 | Único |
| 1 Impresora térmica | Xprinter XP-Q200 | S/ 280 | Único |
| Cloudflare R2 | Almacenamiento extra para backups (3 años) | S/ 200 | Cada 3 años |
| Cables premium | USB, HDMI, extensiones de calidad | S/ 80 | Único |
| Imprevistos (10%) | - | S/ 240 | - |
| **TOTAL** | | **S/ 3,000** | |

**Lo que tienes:**
- Lectores profesionales que duran 5+ años
- Servidor potente por 3 años
- Almacenamiento extra para backups
- UPS de marca reconocida

**Limitación:** No hay dinero sobrante (todo invertido)

---

## Comparación de las 3 opciones

| Concepto | Opción A | Opción B | Opción C |
|---|---|---|---|
| Lector principal | Genérico (S/ 90) | Netum (S/ 150) | Honeywell (S/ 400 c/u) |
| Lectores de backup | 0 | 1 genérico | 1 profesional |
| VPS | Hetzner 2GB | DigitalOcean 2GB | DigitalOcean 4GB |
| Duración prepagada | 2 años | 2 años | 3 años |
| UPS | Básico (S/ 150) | Forza (S/ 200) | APC (S/ 280) |
| Impresora | No | Sí (S/ 220) | Sí (S/ 280) |
| Almacenamiento extra | No | No | Sí (Cloudflare R2) |
| Costo total | ~S/ 1,225* | ~S/ 1,740* | ~S/ 3,000 |
| Dinero sobrante | S/ 775 | S/ 760 | S/ 0 |
| Recomendado para | Probar el sistema | Uso diario normal | Colegio exigente |

*Los costos indicados cubren 2-3 años completos, no es solo el primer año.

**Mi recomendación: Opción B.** Es el balance perfecto. Te dura 2 años sin preocupaciones y tienes dinero guardado para emergencias.

---

## Dónde comprar

### Lector QR

| Tienda | Qué encuentras | Rango de precios | Garantía |
|---|---|---|---|
| **MercadoLibre Perú** | Todas las marcas, el más usado | S/ 60 - 600 | Según vendedor |
| **Amazon (con envío a Perú)** | Honeywell, Symbol originales | S/ 350 - 800 | 1 año del fabricante |
| **AliExpress** | Genéricos baratos (Netum, Inateck) | S/ 50 - 200 | 6 meses del vendedor |
| **AliExpress (envío rápido)** | Igual pero en 7-15 días | S/ 80 - 250 | 6 meses |
| **Distribuidor Honeywell Perú** | Solo Honeywell profesional | S/ 400 - 700 | 1 año |

**Tip:** Comprar el lector por MercadoLibre con vendedores que tengan buena reputación y "MercadoLíder".

### Dominio

| Registrador | .com | .com.pe | Pago | Comentario |
|---|---|---|---|---|
| **Porkbun** | S/ 38 - 50 | No vende | Anual | El más barato |
| **Namecheap** | S/ 42 - 55 | No vende | Anual | Buena UI |
| **Cloudflare** | S/ 50 - 60 | No vende | Anual | El más seguro, sin sobrecargos |
| **NIC.pe** | No vende | S/ 70 - 100 | Anual | El oficial peruano |

### VPS

| Proveedor | Costo mensual | Mín. de contrato | Pago | Datacenter |
|---|---|---|---|---|
| **Hetzner** | S/ 15 - 20 | 1 mes | Mensual | Alemania, Finlandia |
| **Vultr** | S/ 23 - 30 | 1 mes | Mensual | USA, Europa, Asia |
| **DigitalOcean** | S/ 23 - 46 | 1 mes | Mensual | USA, Europa, Asia |
| **Linode** | S/ 19 - 46 | 1 mes | Mensual | USA, Europa, Asia |
| **Contabo** | S/ 15 - 27 | 1 mes | Mensual | Alemania |
| **Hostinger** | S/ 19 - 38 | 1 mes | Mensual | Europa, USA |
| **DonWeb** | S/ 30 - 57 | 1 mes | Mensual | Argentina |

**Tip:** Casi todos permiten pagar con tarjeta de crédito/débito peruana o PayPal. Algunos aceptan Yape o Plin (Hetzner no, pero puedes usar PayPal).

---

## Costos mensuales (operación)

| Concepto | Costo mensual | Costo anual |
|---|---|---|
| VPS (Hetzner básico) | S/ 15 - 20 | S/ 180 - 240 |
| Internet (ya está pagado) | S/ 0 | S/ 0 |
| Luz (ya está pagado) | S/ 0 | S/ 0 |
| Mantenimiento (limpieza, actualizaciones) | S/ 0 (lo hace el equipo) | S/ 0 |
| Repapel térmico (si hay impresora) | S/ 20 | S/ 240 |
| **TOTAL mensual realista** | **S/ 15 - 40** | **S/ 180 - 480** |

**Dato importante:** Si compran el dominio por 1-3 años, ese costo se paga una vez al año (no mensualmente).

---

## Cronograma del proyecto (actualizado)

Como ya no hay que comprar laptops, el cronograma es más corto:

| Semana | Actividad | Responsable |
|---|---|---|
| **1** | Comprar lector(es) QR y contratar VPS + dominio | Tesorería + delegado |
| **2** | Configurar el VPS (instalar Ubuntu, Node.js, PostgreSQL) | Equipo técnico |
| **3** | Subir la app al servidor y conectar la laptop de portería | Equipo técnico |
| **4** | Generar los carnets QR para todos los alumnos | Secretaría |
| **5** | Capacitar al portero (1 hora) | Equipo técnico |
| **6** | Prueba piloto: solo 5.° de secundaria | Portero + observador |
| **7** | Ajustes según comentarios | Equipo técnico |
| **8** | Lanzamiento oficial | Dirección |

**Tiempo total: 2 meses**

---

## Pasos detallados para configurar el servidor (para el equipo técnico)

### 1. Contratar el VPS

1. Ir a [hetzner.com](https://www.hetzner.com/cloud) (o el proveedor elegido)
2. Crear cuenta con email
3. Elegir "Cloud Server" → ubicación (Europa más barato)
4. Configurar:
   - **Imagen:** Ubuntu 22.04 LTS
   - **Tipo:** CX22 (2 vCPU, 2GB RAM) o superior
   - **Almacenamiento:** 40 GB SSD
   - **Red:** IPv4 + IPv6
5. Crear y esperar 1-2 minutos a que esté listo
6. Anotar la **IP del servidor** (ej: `138.68.100.50`)

### 2. Comprar el dominio

1. Ir a [porkbun.com](https://porkbun.com) (o NIC.pe si es .com.pe)
2. Buscar el dominio deseado (ej: `sca-qr-colegio.com`)
3. Agregar al carrito y pagar (S/ 40-50 con tarjeta)
4. En la configuración del dominio, cambiar los **nameservers** a los del proveedor de VPS (cada proveedor tiene los suyos, ejemplo para Hetzner: `ns1.first-ns.de`, `ns2.first-ns.de`)
5. Esperar 1-24 horas a que se propague

### 3. Instalar el software en el VPS

Conectarse por SSH (desde la terminal de tu laptop):

```bash
ssh root@138.68.100.50
```

Una vez conectado:

```bash
# Actualizar el sistema
apt update && apt upgrade -y

# Instalar Node.js (versión 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar PostgreSQL
apt install -y postgresql postgresql-contrib

# Configurar PostgreSQL
sudo -u postgres psql
CREATE DATABASE sca_qr;
CREATE USER sca_user WITH PASSWORD 'tu_contraseña_segura';
GRANT ALL PRIVILEGES ON DATABASE sca_qr TO sca_user;
\q

# Instalar Nginx (para que el servidor sea accesible por dominio)
apt install -y nginx

# Instalar PM2 (para mantener la app siempre corriendo)
npm install -g pm2

# Clonar el proyecto
git clone https://github.com/colegio/sca-qr.git
cd sca-qr

# Instalar dependencias
npm install

# Compilar la app
npm run build

# Iniciar la app con PM2
pm2 start npm --name "sca-qr" -- start
pm2 save
pm2 startup
```

### 4. Configurar Nginx (para que el dominio apunte a la app)

Crear el archivo `/etc/nginx/sites-available/sca-qr`:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activar:

```bash
ln -s /etc/nginx/sites-available/sca-qr /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 5. Activar HTTPS (gratis con Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d tu-dominio.com
```

Listo, ahora tu sistema está en `https://tu-dominio.com` 🎉

---

## Posibles problemas y cómo resolverlos

| Problema | Causa probable | Solución |
|---|---|---|
| La app no carga en la laptop | El servidor está caído o el dominio no apunta bien | Revisar VPS, esperar 24h si es nuevo |
| Se va la luz y la laptop se apaga | Sin UPS o UPS descargado | Cargar UPS / comprar uno |
| No suena el pitido | Volumen en 0 o audio bloqueado | Subir volumen, hacer click en la página primero |
| "QR NO AUTÉNTICO" | QR falsificado o mal generado | Verificar con secretaría |
| Lector no enciende | Cable USB dañado o puerto quemado | Cambiar cable o usar otro puerto |
| Internet lento | WiFi saturado | Usar cable de red |
| VPS no responde | Servidor apagado o hackeado | Reiniciar desde panel de Hetzner |
| Dominio no carga | DNS no se ha propagado aún | Esperar 24-48h |
| Error 502 Bad Gateway | App Node.js no está corriendo | SSH al servidor y `pm2 restart sca-qr` |
| Disco lleno en VPS | Backups o logs sin limpiar | SSH y borrar archivos viejos |

---

## Glosario (palabras técnicas explicadas fácil)

- **PWA (Progressive Web App):** Una página web que se comporta como aplicación. Se abre en navegador pero se puede "instalar".
- **VPS (Virtual Private Server):** Una computadora virtual que vive en un datacenter lejano. Encendida 24/7.
- **Dominio:** El "nombre" de tu servidor en internet (como `colegio.com`). Es más fácil de recordar que una IP.
- **API:** Un "mesero digital" que lleva pedidos de la app al servidor y trae la respuesta.
- **Backend:** La parte "invisible" del sistema. Está en el VPS y se encarga de guardar y procesar datos.
- **Frontend:** Lo que ves en pantalla: botones, colores, fotos, textos.
- **Base de datos:** Donde se guarda toda la información. Como un Excel gigante en el servidor.
- **IndexedDB:** Una memoria secreta que tiene el navegador. Para guardar datos cuando no hay internet.
- **Service Worker:** Un programa chiquito que corre en segundo plano. Hace que la app funcione offline.
- **USB HID:** La forma en que el lector QR habla con la computadora. Como si fuera un teclado.
- **QR (Quick Response):** Un código de barras cuadrado.
- **PostgreSQL:** Un tipo de base de datos muy usada. Es la que usaremos.
- **Node.js:** El lenguaje/programa que corre la app en el servidor.
- **Nginx:** Un programa que recibe las visitas del dominio y las redirige a la app.
- **PM2:** Un programa que mantiene la app siempre encendida, aunque haya errores.
- **SSH:** Una forma de conectarse al servidor por línea de comandos (como una terminal remota).
- **HTTPS:** La versión segura de HTTP. Encripta los datos. Sale un candado en el navegador.
- **Let's Encrypt:** Servicio gratuito que da certificados HTTPS.
- **DNS:** El sistema que traduce `colegio.com` a una IP como `138.68.100.50`.
- **Nameservers:** Los servidores que te dicen qué IP tiene un dominio.
- **Datacenter:** Edificio enorme donde viven miles de servidores, con aire acondicionado y seguridad.
- **SSD:** Tipo de disco duro más rápido que el HDD tradicional.
- **Caché:** Memoria temporal que hace que las cosas carguen más rápido.
- **Sincronización:** Cuando los datos guardados sin internet se suben al servidor.
- **Idempotencia:** Cuando envías el mismo dato dos veces, el servidor lo reconoce y no lo duplica.
- **DNS propagation:** El tiempo que tarda un dominio nuevo en estar disponible en todo el mundo (hasta 48h).

---

## Resumen ejecutivo (para presentar a las autoridades)

> **SCA-QR** es un sistema digital para controlar la asistencia de los alumnos en la puerta del colegio. Funciona con un lector de códigos QR y la laptop que ya tiene el colegio, conectada a una aplicación que también puede usarse sin internet.
>
> **Lo que ya tenemos (gratis):** Laptops, internet, mouse.
>
> **Lo que necesitamos comprar:**
> - 1-2 lectores de códigos QR: S/ 90 - 800
> - 1 servidor en la nube (VPS) por 2-3 años: S/ 400 - 990
> - 1 dominio web por 1-3 años: S/ 45 - 130
> - (Opcional) UPS, impresora, almacenamiento extra: S/ 150 - 480
>
> **Inversión total: entre S/ 1,200 y S/ 3,000 (cubre 2-3 años completos)**
>
> **Costos mensuales después: S/ 15 - 40/mes (solo el VPS)**
>
> **Beneficios:**
> - Reduce el tiempo de ingreso de 5 minutos a 1 segundo por alumno
> - Elimina la suplantación de identidad
> - Genera reportes digitales automáticos
> - No se pierde información cuando se va la luz o el internet
> - Es una inversión única, sin licencias mensuales
>
> **Recomendación:** Adquirir la Opción B (S/ 1,740 total para 2 años), que da el mejor balance entre calidad y precio.

---

## Anexo: Equivalencias de precios en dólares (referencia)

| Precio en soles | Precio en USD (aprox.) |
|---|---|
| S/ 50 | ~$13 USD |
| S/ 100 | ~$26 USD |
| S/ 500 | ~$130 USD |
| S/ 1,000 | ~$260 USD |
| S/ 2,000 | ~$525 USD |
| S/ 3,000 | ~$790 USD |

*Tipo de cambio referencial: 1 USD = S/ 3.80 (verificar el actual)*

---

## Contactos y créditos

**Proyecto desarrollado por:** [Nombre del equipo de 5.° de secundaria]
**Asesor:** [Nombre del profesor]
**Año:** 2026

**Si necesitan ayuda técnica:**
- Correo: [correo del equipo]
- WhatsApp: [número del líder del proyecto]

**Soporte de los proveedores recomendados:**
- Hetzner: soporte por email en inglés
- DigitalOcean: soporte por email y chat en inglés
- Porkbun: soporte por email en inglés
- Netum/Honeywell: soporte por email en inglés/chino

---

> **Nota final:** Los precios pueden variar según la fecha y la cotización del dólar. Siempre comparar en al menos 3 proveedores antes de comprar. Para pagar en Perú, casi todos aceptan tarjeta de crédito/débito o PayPal. Para Yape/Plin, es posible que necesites un intermediario.
