# ALEX IO - WhatsApp AI SaaS Platform v2.1.0

![Version](https://img.shields.io/badge/version-2.1.0-blue)
![Status](https://img.shields.io/badge/status-Production--Ready-success)

ALEX IO is a powerful, multi-tenant WhatsApp SaaS platform that allows entrepreneurs and businesses to deploy specialized AI assistants via WhatsApp.

## 🚀 Key Features

- **Multi-Tenancy**: Complete data isolation between clients using JWT and Supabase RLS.
- **AI Orchestrator (alexBrain)**: Hybrid cascade model (Gemini Flash, GPT-4o Mini, DeepSeek) with an automatic **Circuit Breaker** for failed API keys.
- **WhatsApp Integration**: High-stability connection using Baileys (QR-based) and Meta Cloud API support.
- **AI Memory**: Conversations have long-term context memory stored in Supabase.
- **CRM Sync**: Native automated integration with Copper CRM for lead capturing.
- **Automated Billing**: Stripe integration with webhooks that automatically update user plans and quotas.
- **Advanced Analytics**: Intent-based chat tracking (Sales, Support, Greeting) and usage metrics.
- **AI Support Chat**: Built-in support assistant for SaaS users driven by Gemini Flash.

## 📁 Project Structure

```
├── client/                 # React + Vite + Tailwind CSS Frontend
├── server/                 # Node.js + Express Backend
│   ├── config/             # Templates and Personas
│   ├── middleware/         # Auth and Rate Limiting
│   ├── routes/             # API and Payment Routes
│   ├── services/           # Core AI and WhatsApp Logic
│   └── sql/                # Database schemas and setup
└── documentation/          # Extensive guides and roadmaps
```

## 🛠️ Getting Started

For detailed instructions on setup, environment variables, and deployment to Render, please refer to:
- **[Deployment Guide](GUIA_ANTIGRAVITY_V2.md)**
- **[Technical Documentation](DOCUMENTACION_TECNICA_V2.md)**
- **[Recent Improvements](INFORME_EJECUTIVO_MEJORAS_V2.md)**

## 🛡️ Security

This platform is built with a "Security-First" approach:
- Zero hardcoded secrets.
- Mandatory environment variables for production.
- Isolated session storage per instance.
- Intentional group message filtering to prevent bot loops.

## 🗺️ Roadmap

Future enhancements include:
- **RAG Implementation**: Upload PDFs to train individual bots.
- **Live Chat Console**: Browser-based interface for human intervention.
- **White Label**: Ability for agencies to rebrand the dashboard.

---
**Developed by:** Antigravity AI
**Version:** 2.1.0 - February 2026
