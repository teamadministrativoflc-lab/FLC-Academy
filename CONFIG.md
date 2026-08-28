# ⚙️ Guía rápida de cambios

Esta guía te dice **qué archivo editar** para las cosas más comunes.
No necesitas saber programar — solo cambiar textos entre comillas.

## 📝 Reglas generales antes de editar

1. **Guarda una copia** del archivo antes de editar (por si te equivocas)
2. **Nunca borres las comillas** `"..."` ni las comas `,`
3. **Los cambios en GitHub se publican automáticamente** en 30 segundos
   una vez que hagas "Commit changes"
4. Si algo se rompe, revierte al commit anterior desde GitHub

---

## 🔑 Cambiar la contraseña de la agencia

**Archivo:** `data/agency_config.js`

Encuentra esta línea:

```js
agencyPassword: "FLC2026",
```

Cambia `FLC2026` por lo que quieras. Ejemplos:
- `"Legacy2026"`
- `"AgenteVIP"`
- `"FLCsecure2027"`

**Recomendación:** cambiar cada 3-6 meses y avisar a los agentes.

---

## 🎬 Cambiar el video de bienvenida

**Archivo:** `components/WelcomeVideo.jsx`

Encuentra esta línea cerca del inicio:

```js
const WELCOME_VIDEO_URL = 'https://drive.google.com/file/d/...../view?usp=drive_link';
```

Reemplázala con el nuevo link de Google Drive.

**Importante:** el video en Drive debe estar compartido como
*"Cualquier persona con el enlace" → "Lector"*.

---

## 📺 Agregar / cambiar tutoriales de una compañía

**Archivo:** `data/resources.js`

Busca la sección `window.TUTORIAL_GROUPS`. Verás bloques como:

```js
{
  companyId: 'nlg',
  company: 'National Life Group',
  color: '#1e5b8f',
  sections: [
    {
      title_es: 'Portales',
      title_en: 'Portals',
      videos: [
        {
          id: 'nlg-portal',
          title_es: 'Tu portal',
          title_en: 'Your portal',
          url: 'https://drive.google.com/file/d/XXXXXXX/view?usp=drive_link',
        },
        // ← agrega otro video aquí siguiendo el mismo formato
      ],
    },
  ],
},
```

### Para AGREGAR un video nuevo:

Copia y pega uno de los bloques `{ id: ..., title_es: ..., ... }` completo
(con la coma final), y cambia el `id`, `title_es`, `title_en` y `url`.

### Para CAMBIAR un video:

Solo cambia el `url:` del video correspondiente.

### Para agregar una nueva SECCIÓN:

Copia un bloque `{ title_es: ..., title_en: ..., videos: [...] }` completo
dentro de una compañía.

### Para activar una compañía "próximamente":

Encuentra la compañía (ej. Aetna) que tiene `sections: []` y `pending: true`.
Quita `pending: true` y agrega secciones con videos.

---

## 🏢 Editar la información de una compañía

**Archivo:** `data/companies.js`

Cada compañía tiene un bloque como este:

```js
{
  id: 'nlg',
  name: 'National Life Group',
  tag_es: 'Líder en IUL con living benefits',
  tag_en: 'IUL leader with living benefits',
  ...
  strengths_es: [
    'IUL líder con living benefits...',
    // ← agrega/edita puntos aquí
  ],
  watchouts_es: [
    'Declina VIH/SIDA...',
    // ← agrega/edita cuidados aquí
  ],
  ...
}
```

Cambia los textos entre comillas.
Puedes agregar más puntos copiando líneas y cambiando el texto.

---

## 🎯 Ajustar el motor del Matcher

**Archivo:** `data/matcher.js`

Este archivo tiene la lógica de calificación. Es más complejo — si
necesitas cambiar reglas específicas, avísale a alguien que sepa
programar. Ellos entenderán rápido con los comentarios que dejé.

Cosas simples que sí puedes cambiar:

- **Qué carriers ofrecen qué producto** — busca `CARRIERS_BY_PRODUCT`
  en `data/companies.js`
- **Qué documentos acepta cada carrier** — busca `CARRIERS_BY_DOCUMENT`
  en `data/companies.js`

---

## 📄 Editar el guion de venta

**Archivo:** `data/resource_content.js`

Busca `window.SALES_SCRIPT`. Es un array con los 9 pasos.

Cada paso tiene:
```js
{
  step: 1,
  title: "Saluda",
  tag: "Rompe el hielo",
  body: "«Hola XXXX, ¿cómo está?»\n\nNormalmente van a responder..."
}
```

Cambia el `body:` con el texto nuevo. Usa `\n\n` para saltos de línea.

---

## 🛡 Editar las 50 objeciones

**Archivo:** `data/resource_content.js`

Busca `window.OBJECTIONS_50`. Cada objeción es:

```js
{ n: 1, obj: "No tengo dinero.", resp: "Entiendo cómo te sientes..." },
```

Cambia `obj:` (la objeción) y `resp:` (la respuesta).

---

## 📖 Editar la presentación "Seguros de Vida"

**Archivo:** `data/resource_content.js`

Busca `window.SEGUROS_VIDA_SLIDES`. Es un array de slides. Cada slide es:

```js
{
  kicker: "Concepto",
  title: "¿Qué es un seguro de vida?",
  body: "Un seguro de vida es...",
}
```

O con bullets:
```js
{
  kicker: "Mecánica",
  title: "¿Cómo funciona?",
  bullets: [
    { term: "Contrato", text: "Se establece un contrato..." },
  ],
}
```

Puedes agregar más slides copiando y pegando bloques.

---

## 🎓 Cambiar los módulos de Mi Progreso

**Archivo:** `data/resources.js`

Busca `window.PROGRESS_MODULES`. Actualmente son 3 módulos conectados
a los recursos. Puedes cambiar títulos, descripciones, o agregar más.

---

## 🌐 Cambiar traducciones (Español/Inglés)

**Archivo:** `data/i18n.js`

Al inicio está `DICT.es` (todo en español) y `DICT.en` (todo en inglés).
Cada línea es `clave: "texto"`. Cambia el texto entre comillas.

---

## ¿Necesitas algo más complejo?

Cambios como agregar una nueva sección al menú, cambiar el diseño,
o conectar cuentas reales con base de datos necesitan un desarrollador.

Cuando llegues a ese punto, este proyecto está bien estructurado y
un dev puede continuarlo sin problema.
