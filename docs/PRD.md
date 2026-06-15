# PRODUCT REQUIREMENT DOCUMENT (PRD)
**Proyecto:** Nuevo Portal Web y Embudo de Conversión COE Caribe IPS  
**Estado:** Borrador Inicial  
**Fecha:** 12 de Junio, 2026  
**Autor:** Equipo de Consultoría y Desarrollo de Producto Digital  

---

## 1. Visión y Objetivos del Producto
El nuevo portal digital de COE Caribe IPS no es un sitio corporativo informativo tradicional. Es un **activo digital de captación de pacientes de alto valor (High-Ticket)** y un generador de autoridad médica científica.

### Objetivos Clave:
*   **Captación de Leads Calificados:** Filtrar pacientes con sintomatología metabólica de alta complejidad (resistencia a la insulina, diabetes, hígado graso, dislipidemia) con intención de pago particular/privado.
*   **Reducción de Fricción Operativa Comercial:** Automatizar la precalificación de leads para eliminar solicitudes no aptas (búsqueda de EPS o servicios de bajo costo) antes de que lleguen a WhatsApp.
*   **Posicionamiento de E-E-A-T (Experiencia, Autoridad, Confianza):** Proyectar a los fundadores (Dr. Molina y Dra. Meriño) como referentes científicos en la Costa Caribe.

---

## 2. Usuarios Clave (User Personas)

### Persona A: El Paciente Metabólico Crónico Silencioso
*   **Perfil:** Hombres y mujeres de 40 a 60 años en Barranquilla (estratos 5 y 6). Empresarios, ejecutivos o pensionados con alto poder adquisitivo.
*   **Dolores:** Cansancio crónico, incapacidad de perder grasa abdominal tras múltiples dietas, diagnósticos de hígado graso o prediabetes controlados únicamente con fármacos que generan efectos secundarios.
*   **Necesidades:** Un tratamiento integral que conecte la Medicina Interna con la Nutrición Clínica. Valora el tiempo y el rigor científico.

### Persona B: El Asesor Clínico Comercial (Operador del Embudo)
*   **Perfil:** Personal de atención al cliente de COE Caribe que recibe y agenda citas.
*   **Dolores:** Pierde el 70% de su jornada filtrando mensajes en WhatsApp de personas que preguntan por EPS o tarifas económicas y se retiran cuando conocen el precio particular.
*   **Necesidades:** Recibir leads que ya conozcan el precio de la consulta, estén de acuerdo con el modelo de pago particular y compartan sus antecedentes médicos básicos de forma ordenada.

---

## 3. Requerimientos de Funcionalidades (Scope)

### Módulos de la Fase 1 (MVP):
1.  **Arquitectura de Silos de Contenido Local (SEO Local):**
    *   Landing Pages específicas por patología (`/tratamiento-resistencia-insulina-barranquilla`, `/tratamiento-obesidad-barranquilla`, `/medicina-interna-barranquilla`).
2.  **Diagnosticador de Salud Metabólica (Quiz Precalificador):**
    *   Formulario dinámico multi-paso interactivo.
    *   Lógica condicional para filtrar y educar sobre la consulta particular.
    *   Redirección inteligente a WhatsApp con mensaje parametrizado.
3.  **Módulo de Casos de Estudio Clínico Anonimizados:**
    *   Plantilla estructurada para mostrar la evolución clínica de pacientes reales mediante biomarcadores científicos (HOMA-IR, perfil lipídico, reducción de grasa visceral).
4.  **Módulo de E-E-A-T (Autoridad Médica):**
    *   Sección destacada de credenciales del equipo médico (miembros de sociedades científicas, diplomas validados y trayectoria académica).

### Fuera de Alcance (Fase 2):
*   Integración directa con Historias Clínicas Electrónicas (EMR / EHR).
*   Pasarela de pagos en línea integrada en la web (se gestiona de forma externa por el asesor).
*   Portal de Pacientes para visualización de exámenes.

---

## 4. Métricas de Éxito (KPIs)
*   **Tasa de Conversión de Lead Calificado:** Porcentaje de visitas cualificadas que completan el quiz y llegan a WhatsApp con el perfil completo.
*   **Calidad de los Leads:** Reducción del porcentaje de leads no particulares que llegan al canal comercial de WhatsApp a menos de un 15%.
*   **Posicionamiento Orgánico (SEO):** Indexación y clasificación en el top 5 de Google local para los términos de búsqueda del Clúster A y B (ej. *"tratamiento resistencia a la insulina barranquilla"*).
