# Future Legacy Creators — Academia de Agentes

Plataforma web interna para la formación de nuevos agentes de seguros
de vida. Bilingüe (español/inglés).

## 📌 ¿Qué incluye?

- **Video de bienvenida** al iniciar sesión por primera vez
- **6 secciones** navegables:
  - Inicio · Menú principal
  - Tutoriales (videos por compañía)
  - Mi progreso (3 módulos + certificado)
  - Recursos (guion de venta, elegibilidad, 50 objeciones, glosario)
  - Compañías (8 carriers con reglas de underwriting)
  - El Matcher (motor de calificación en vivo)

## 🚀 Cómo publicarla

Lee **[GUIA_PUBLICAR.md](GUIA_PUBLICAR.md)** — te lleva paso a paso para
que en 1-2 horas tu plataforma esté en internet, gratis, con un link
que puedes compartir con tus agentes.

## ⚙️ Cambios rápidos

Lee **[CONFIG.md](CONFIG.md)** — te dice qué archivos editar para las
cosas más comunes: cambiar la contraseña, agregar videos, editar guiones.

## 📁 Estructura del proyecto

```
├── index.html                 ← página principal
├── app.jsx                    ← lógica de navegación
├── GUIA_PUBLICAR.md           ← cómo publicarla en internet
├── CONFIG.md                  ← cómo editar contenido
├── README.md                  ← este archivo
│
├── assets/
│   ├── logo.png               ← logo de la agencia
│   ├── resources/             ← PDFs descargables
│   └── uw_pdfs/               ← guías de underwriting
│
├── components/                ← piezas de la interfaz
│   ├── Login.jsx
│   ├── Sidebar.jsx
│   ├── Dashboard.jsx
│   ├── Matcher.jsx
│   ├── Companies.jsx
│   ├── Resources.jsx
│   ├── Tutorials.jsx
│   ├── Progress.jsx
│   ├── Certificate.jsx
│   ├── WelcomeVideo.jsx
│   └── icons.jsx
│
└── data/                      ← contenido editable
    ├── agency_config.js       ← contraseña de agencia
    ├── companies.js           ← reglas de compañías
    ├── matcher.js             ← lógica del matcher
    ├── resources.js           ← tutoriales, checklists, módulos
    ├── resource_content.js    ← guion, objeciones, elegibilidad
    └── i18n.js                ← traducciones ES/EN
```

## 💰 Costo de operación

**$0/mes** con los planes gratis de GitHub + Vercel.

Opcional: dominio propio ~$12/año (ej. `academiaflc.com`).
