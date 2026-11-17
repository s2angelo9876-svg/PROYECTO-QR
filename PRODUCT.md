# SCA-QR

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Portería registra entradas y salidas, incluso durante cortes de conexión. Secretaría gestiona alumnos y matrículas; dirección consulta asistencia y resuelve incidencias. Administración controla usuarios, terminales y configuración.

## Product Purpose

Mantener un registro verificable de asistencia escolar, sin perder capturas durante desconexiones y sin confundir una captura pendiente con una asistencia confirmada.

## Operating Context

Aplicación Next.js existente, lectores QR de teclado y laptops de entrada. El SDD usa America/Lima y contempla un piloto de un lector por laptop. El colegio debe validar horarios, calendario y hardware reales.

## Capabilities and Constraints

El usuario autoriza implementar el diseño y las fases restantes del SDD. Solo servicios gratuitos y software libre; no se autoriza contratar servicios ni publicar un despliegue. PostgreSQL local es la alternativa documentada para desarrollar y operar en un equipo existente. Las capturas conservan identificador, hora original y recibo; las correcciones dejan auditoría. Ningún dato sintético prueba aceptación institucional.

## Evidence on Hand

Código y pruebas de fase 1; docs/SDD_MEJORA_GRATUITA.md y docs/ANALISIS_INTEGRAL.md. Los alumnos de demostración son sintéticos. No hay identidad gráfica institucional, censo real, modelos de lectores ni aprobación de políticas escolares.

## Product Principles

- Confirmar solo después de persistir y verificar el recibo.
- Mostrar el estado y una acción de recuperación concreta.
- Aplicar permisos y ámbito escolar en servidor y base de datos.
- Conservar evidencias de correcciones, sin reescribir eventos originales.
- Mantener una ruta gratuita reproducible y exportable.

## Accessibility & Inclusion

El SDD exige uso por teclado, foco visible, contraste AA, diseño adaptable y respeto por movimiento reducido.
