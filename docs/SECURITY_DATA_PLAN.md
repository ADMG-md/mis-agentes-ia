# PLAN DE SEGURIDAD Y PROTECCIÓN DE DATOS PERSONALES (HVP & LEY 1581 DE 2012)
**Proyecto:** Nuevo Portal Web y Embudo de Conversión COE Caribe IPS  
**Estado:** Borrador Inicial  
**Fecha:** 12 de Junio, 2026  
**Autor:** Oficial de Protección de Datos y Seguridad Informática  

---

## 1. Clasificación del Tipo de Información Recolectada
De acuerdo con la **Ley 1581 de 2012 de la República de Colombia (Protección de Datos Personales)** y su decreto reglamentario:
*   **Datos Personales Generales:** Nombre, correo electrónico y número de teléfono/WhatsApp.
*   **Datos Sensibles (Salud):** Sintomatología metabólica, diagnósticos previos de patologías (diabetes, hipertensión, hígado graso), y hábitos conductuales recolectados en el Quiz.

*De acuerdo con la ley, el tratamiento de datos sensibles requiere de una autorización explícita, previa y debidamente documentada, y el titular no está obligado a responder a ellos a menos que sea estrictamente necesario para la prestación del servicio médico.*

---

## 2. Estrategia de Seguridad e Integridad de Datos

### A. Política de Cero Persistencia Local (Zero-Persistence)
Para mitigar el riesgo de filtración de datos de salud y reducir la responsabilidad de la infraestructura web, se propone:
*   El servidor de Next.js **no almacenará de forma permanente** las respuestas médicas del Quiz en una base de datos local no encriptada.
*   Las respuestas se procesarán en memoria del lado del cliente (`sessionState` o React state) y se utilizarán exclusivamente para construir la redirección parametrizada de WhatsApp y disparar el evento de conversión anónimo.
*   En caso de requerir guardado en base de datos para analítica o CRM, los datos personales identificables (PII) se separarán de los datos de salud mediante tokens anónimos, y se guardarán en bases de datos con cifrado en reposo (ej. Firebase Firestore con reglas de seguridad estrictas y cifrado por defecto).

### B. Seguridad en Tránsito (Cifrado)
*   **HTTPS/TLS 1.3:** Conexión segura obligatoria para todo el dominio. Se configurará HSTS (HTTP Strict Transport Security) para evitar la degradación de conexiones seguras.
*   **Sanitización de Datos de Entrada:** Validación y sanitización estricta de todos los campos del formulario del Quiz en el servidor (API Routes) para mitigar vulnerabilidades de Inyección de Código (XSS) y SQL Injection.
*   **Protección CSRF:** Implementación de tokens CSRF en los formularios y endpoints internos de Next.js para asegurar que las solicitudes provengan exclusivamente del sitio oficial de COE Caribe.

---

## 3. Protocolo Legal de Consentimiento del Paciente

### Requisitos del Checkbox de Autorización (Habeas Data):
El usuario deberá marcar de manera obligatoria y activa un checkbox antes de enviar el Quiz. No se permiten checkboxes pre-marcados.

### Texto del Consentimiento Sugerido:
> *"Autorizo de manera previa, expresa e informada a COE Caribe IPS como Responsable del Tratamiento, para recolectar y tratar mis datos personales y de salud con el fin de contactarme, precalificar mi estado metabólico y agendar mi valoración médica. Conozco que tengo derecho a conocer, actualizar, rectificar y suprimir mi información según la Ley 1581 de 2012. He leído y acepto la Política de Privacidad de Datos."*

---

## 4. Auditoría y Cumplimiento
*   **Políticas de Privacidad Visibles:** Creación de la ruta estática `/privacidad` detallando la Política de Tratamiento de Información de COE Caribe IPS, indicando los canales de atención para que el paciente ejerza sus derechos de Habeas Data (modificación, rectificación o eliminación de sus registros de la base de datos de WhatsApp/CRM).
*   **Cumplimiento de Terceros:** Asegurar que los webhooks y CRMs utilizados para almacenar datos calificados cuenten con certificaciones de seguridad (como cumplimiento SOC 2 o cumplimiento de normas de seguridad de salud como HIPAA en caso de proveedores internacionales).
