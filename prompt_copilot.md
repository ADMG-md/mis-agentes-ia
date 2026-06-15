# PROMPT PARA COPILOT / CHAT EN NAVEGADOR: DESPLIEGUE DEL ECOSISTEMA COE CARIBE

Copia y pega el siguiente prompt completo en tu IA del navegador (Copilot, Claude o ChatGPT) para guiar el desarrollo de la web, la API y la conexión con el VPS:

```markdown
Actúa como un Ingeniero de Software Principal y Arquitecto de Soluciones Cloud. Necesito que me guíes paso a paso para configurar y desplegar un ecosistema web y de agentes de IA en mi nuevo servidor VPS. Aquí tienes las especificaciones técnicas y requerimientos del proyecto:

### 1. Especificaciones de la VPS (Ubuntu Server - KVM 2):
- CPU: 2 Cores
- RAM: 8 GB
- Disco: 100 GB SSD
- Ancho de Banda: 8 TB

### 2. Componentes del Ecosistema a Desplegar:
- **Frontend / Backend Web:** Una aplicación Next.js 15+ (App Router) que aloja la landing page de COE Caribe IPS y un Quiz Precalificador dinámico para pacientes metabólicos.
- **Orquestación de Agentes (Ruflo / Swarm):** Un servidor MCP local/remoto basado en Ruflo (Node.js/TypeScript) que almacena la memoria vectorial en SQLite y ejecuta tareas en segundo plano.
- **Canal de Comunicación (WhatsApp):** Integración mediante Evolution API (contenedor Docker en el VPS) que conecta una línea móvil de WhatsApp para enviar reportes automáticos de leads calificados.

### 3. Requerimientos de Next.js (Embudo de Captación):
- Rutas optimizadas para SEO local (/tratamiento-resistencia-insulina-barranquilla, etc.).
- Quiz dinámico multipaso que calcula un "Severity Score" (escala 0-10) sumando síntomas (+1 punto) y diagnósticos previos (+2 puntos).
- Filtro estricto: Si el lead selecciona que busca atención por EPS, se le redirige a una página de descarte con artículos informativos. Si selecciona que acepta el modelo particular/privado, se clasifica como lead PREMIUM y se guarda en base de datos.
- Redirección o envío de mensaje automático a WhatsApp con los datos formateados.

### 4. Lo que necesito que me des paso a paso:
1. Las instrucciones exactas de consola para desplegar Evolution API en Docker en mi VPS y escanear el código QR para vincular mi línea de WhatsApp.
2. El código completo para un API Route de Next.js (`/api/prequalify/route.ts`) que reciba los datos del Quiz en JSON, los valide, calcule el "Severity Score" y, si es PREMIUM, envíe una petición POST a la Evolution API en el VPS para mandar el mensaje de WhatsApp automático al paciente.
3. La configuración de PM2 para mantener activo el servidor de agentes Ruflo (`npx ruflo@latest mcp start`) y cómo puedo tunelar el puerto 3000 de forma segura desde mi máquina local al VPS usando SSH.
```
