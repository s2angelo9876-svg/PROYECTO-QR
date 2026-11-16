# Skills para el diseño de SCA-QR

Las skills son instrucciones locales de trabajo; su incorporación no crea un servicio externo ni modifica por sí sola la interfaz.

| Recurso | Ubicación | Función |
|---|---|---|
| Unslop | [SKILL.md](../.agents/skills/unslop/SKILL.md) | Auditar patrones genéricos y definir una dirección propia para el dashboard; trabajar espaciado, color, iconos, texto, tipografía, composición, detalles y movimiento |
| Impeccable | [SKILL.md](../.agents/skills/impeccable/SKILL.md) | UX, jerarquía visual, accesibilidad, estados y coherencia del sistema de diseño |
| Emil Kowalski | [emil-design-eng](../.agents/skills/emil-design-eng/SKILL.md) | Comportamiento de componentes, microinteracciones y movimiento que ayude a usar la interfaz |
| Playwright | [Configuración](../playwright.config.ts) y [pruebas](../tests/e2e/phase-one.spec.ts) | Herramienta de navegador para validar la implementación; no es una skill de estilo |

## Uso en este proyecto

1. Revisar la pantalla real, los datos disponibles y las funciones que ya existen; conservar los controles de seguridad y los estados de demo/pendientes implementados.
2. Usar la auditoría y dirección de Unslop como punto de partida; aplicar las instrucciones pertinentes de las otras skills sin mezclar reglas visuales incompatibles.
3. Dar prioridad a lectura de cifras, asistencia, incidencias, navegación, teclado y accesibilidad. No inventar métricas, funcionalidades ni identidad institucional.
4. Verificar desktop y móvil con el navegador y mantener las pruebas funcionales de Playwright.

El presupuesto continúa siendo de servicios gratuitos. No activar Railway, servicios de generación pagada, nuevos proveedores ni publicaciones por instalar estas instrucciones. Para un dashboard, las gráficas y componentes del producto son la referencia principal; no se necesita contratar generación de imágenes.

Unslop incluye scripts opcionales de snapshot y story video. Playwright/Chromium se reutilizan cuando estén disponibles; ffmpeg solo es necesario para video. Ninguno de esos scripts se ejecutó como parte de la instalación y no se instaló ninguna dependencia nueva.

## Atribución

Unslop fue creado por Damir Sokolovsky ([@heydamir](https://x.com/heydamir)) y se distribuye bajo [CC BY 4.0](../.agents/skills/unslop/LICENSE). La definición aportada por el usuario y los recursos originales se conservan junto a su [procedencia y versión](../.agents/skills/unslop/IMPORT.md).
