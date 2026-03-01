# 🗺️ Roadmap de Evolución: ALEX IO SaaS

## Fase 1: Inteligencia de Datos (RAG)
*   **Objetivo:** Permitir que los bots "lean" documentos de la empresa.
*   **Tareas:**
    *   Implementar `pgvector` en Supabase para almacenar embeddings.
    *   Crear endpoint `/api/saas/knowledge/upload` para procesar PDFs/TXT.
    *   Modificar `alexBrain.js` para buscar en la base de conocimientos antes de generar la respuesta.

## Fase 2: Centro de Control de Mensajería
*   **Objetivo:** Intervención humana y chat en vivo.
*   **Tareas:**
    *   Crear interfaz de "Live Chat" en React.
    *   Implementar WebSockets (Socket.io) para recibir mensajes en tiempo real en el dashboard.
    *   Añadir tabla `chat_metadata` para controlar el estado `bot_paused: boolean`.

## Fase 3: Automatización Avanzada
*   **Objetivo:** Agendamiento y pagos nativos.
*   **Tareas:**
    *   Integración profunda con Calendly API para confirmar citas sin salir de WhatsApp.
    *   Generación de links de pago dinámicos de Stripe directamente en el chat.

## Fase 4: Growth y Retención
*   **Objetivo:** Herramientas de marketing.
*   **Tareas:**
    *   Módulo de Campañas Masivas (Broadcast).
    *   Analytics avanzado: Tasa de conversión de bot a lead calificado.
