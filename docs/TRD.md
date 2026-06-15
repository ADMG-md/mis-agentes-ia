# TECHNICAL REQUIREMENT DOCUMENT (TRD)
**Proyecto:** Nuevo Portal Web y Embudo de Conversión COE Caribe IPS  
**Estado:** Borrador Inicial  
**Fecha:** 12 de Junio, 2026  
**Autor:** Dirección de Tecnología y Desarrollo Web  

---

## 1. Arquitectura y Stack Tecnológico

### Frontend Framework:
*   **Tecnología Principal:** **Next.js 15+ (App Router)**.
*   **Razón:** Necesitamos un óptimo posicionamiento SEO (generado mediante *Server-Side Rendering* - SSR y *Static Site Generation* - SSG para páginas estáticas de servicios) combinado con alta velocidad en la renderización del lado del cliente para el Quiz dinámico.

### Estilos y UI:
*   **CSS:** **Vanilla CSS** con CSS Variables para variables del sistema de diseño (Design Tokens) o **TailwindCSS** (según necesidades de velocidad de desarrollo).
*   **Fuentes:** Google Fonts cargadas de forma local en Next.js (`next/font`) para eliminar el renderizado acumulativo de diseño (CLS).

### Infraestructura y Hosting (Self-Hosted VPS):
*   **Servidor de Despliegue:** Servidor VPS Propio (ej. DigitalOcean, Hetzner, Contabo) corriendo Ubuntu Server.
*   **Motor de Ejecución:** Node.js autohospedado (gestionado con PM2 o mediante contenedores Docker).
*   **PaaS Self-Hosted (Recomendado):** Coolify o CapRover para gestionar despliegues automáticos (CI/CD) vía Git de forma gratuita.
*   **Proxy Inverso y SSL:** Caddy o Nginx con emisión y renovación automática de certificados SSL gratuitos mediante Let's Encrypt.
*   **Dominio y DNS:** Nuevo dominio registrado, apuntado mediante registros A/AAAA al VPS, con Cloudflare en modo "Proxy" activo para protección DDoS básica.

---

## 2. Requerimientos de Performance y SEO Técnico

### Core Web Vitals (Límites Estrictos):
*   **LCP (Largest Contentful Paint):** < 1.8 segundos (carga del Hero principal).
*   **INP (Interaction to Next Paint):** < 150 milisegundos (especialmente crítico en los clics del Quiz).
*   **CLS (Cumulative Layout Shift):** < 0.05 (sin saltos visuales al renderizar fuentes o imágenes del equipo médico).

### SEO Técnico On-Page:
*   **Schema Markup (JSON-LD):** Estructura del marcado clínico dinámico integrada en cada ruta.
*   **Metadatos de Ruta:** Generación dinámica de títulos, descripciones, y tags OpenGraph en `layout.tsx` y `page.tsx` para garantizar que cada landing page de patología tenga sus keywords optimizadas.

---

## 3. Integraciones y APIs de Terceros
1.  **WhatsApp Link Generator / API:** Redirección parametrizada en la etapa final del quiz que contenga las respuestas del paciente codificadas en la URL (`encodeURIComponent`).
2.  **Tracking y Píxeles de Conversión:**
    *   **Google Tag Manager (GTM) / Google Analytics 4 (GA4):** Configuración de eventos de conversión personalizados para leads que completen el paso del quiz que indica que aceptan el modelo particular (High-Value Lead).
    *   **Meta Pixel:** Evento personalizado `LeadParticular` para retroalimentar el algoritmo de Meta Ads de forma precisa con leads de alta conversión, optimizando el costo por adquisición (CPA).
3.  **Captura y Respaldo de Datos (CRM):** Integración mediante webhook (ej. Zapier, Make o un API Route de Next.js) hacia el CRM interno de la clínica para no depender exclusivamente de WhatsApp en caso de pérdida de conexión.

---

## 4. Accesibilidad y Estándares Web (UI/UX)
*   **Estándar de Accesibilidad:** Cumplimiento con las pautas **WCAG 2.1 Nivel AA**.
*   **Requisitos de Accesibilidad:**
    *   Uso estricto de elementos HTML5 semánticos (`<main>`, `<header>`, `<section>`, `<article>`).
    *   Uso de atributos `aria-label` en los botones transaccionales y de navegación móvil.
    *   Contrastes mínimos de color de 4.5:1 para el texto secundario.
    *   Soporte completo para navegación mediante teclado en el formulario del Quiz.
