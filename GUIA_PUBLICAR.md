# 🚀 Guía para publicar tu Academia en internet

**Tiempo estimado:** 1 a 2 horas la primera vez.
**Costo:** $0. Todo con planes gratis.
**Requisitos:** solo una computadora y correo electrónico.

Esta guía te lleva paso a paso para que tus 30 agentes puedan entrar a la
plataforma desde cualquier lugar del mundo con solo un link.

---

## 📋 Resumen de lo que vas a hacer

1. **Crear cuenta en GitHub** (5 min) — donde vive el código
2. **Subir el proyecto a GitHub** (15 min) — arrastrando el ZIP
3. **Crear cuenta en Vercel** (5 min) — el servicio que publica la página
4. **Conectar Vercel con GitHub** (5 min) — un clic
5. **Publicar** (2 min) — Vercel hace todo automáticamente
6. **Compartir el link con tus agentes** (2 min)

Total real: unas **35 minutos** activos, la primera vez.
Cuando quieras actualizar algo, son **3 minutos**.

---

## 🎯 Antes de empezar: cambia la contraseña de tu agencia

Abre el archivo `data/agency_config.js` con cualquier editor de texto
(Bloc de notas, TextEdit, VS Code, lo que tengas).

Verás algo así:

```js
window.AGENCY_CONFIG = {
  agencyPassword: "FLC2026",     // ← cambia esto
  agencyName: "Future Legacy Creators",
};
```

**Cambia `FLC2026` por lo que quieras**. Recomendaciones:
- Usa algo fácil de decir por teléfono (ej. `Legacy2026`, `AgenteVIP`)
- Sin espacios ni caracteres raros
- Al menos 6 caracteres
- Cámbiala cada 3-6 meses

Guarda el archivo. Listo, esa será la contraseña única que compartirás
con tus 30 agentes.

---

## PASO 1️⃣ · Crea tu cuenta de GitHub (5 minutos)

GitHub es donde vamos a guardar el código. Es como Google Drive
pero para código de programación.

1. Abre [github.com](https://github.com) en tu navegador
2. Clic en **"Sign up"** (arriba a la derecha)
3. Usa tu correo, crea una contraseña, elige un usuario
   (ej. `futurelegacy-admin`)
4. Verifica tu correo (te llega un email con un código)
5. Cuando te pregunte plan, elige **"Free"** (gratis para siempre)
6. Cuando te pregunte cosas como *"cómo planeas usar GitHub"*, elige
   cualquier opción — puedes marcar "Student" o "Other"

✅ **Ya tienes cuenta.** Anota tu usuario y contraseña — la vas a necesitar.

---

## PASO 2️⃣ · Sube el proyecto a GitHub (15 minutos)

### A) Crea un nuevo repositorio

1. En github.com, arriba a la derecha, clic en el **`+`** → **"New repository"**
2. Llena los campos:
   - **Repository name:** `academia-flc` (o el nombre que quieras)
   - **Description:** "Academia interna de Future Legacy Creators" (opcional)
   - Selecciona **"Public"** (es más fácil; el contenido no se ve sin la contraseña)
     - *Si prefieres "Private", también funciona pero necesitas plan Pro de Vercel*
   - **NO** marques "Add a README file" ni las otras opciones
3. Clic en **"Create repository"**

### B) Sube los archivos del proyecto

En la página que aparece, verás algo como *"Quick setup — if you've done this kind of thing before"*.

**Ignora todo eso.** Busca al final un enlace pequeño que dice
**"uploading an existing file"** — clic ahí.

1. **Arrastra la carpeta completa** del proyecto (todos los archivos: `index.html`, `app.jsx`, las carpetas `assets`, `components`, `data`) a la zona que dice *"Drag files here to add them to your repository"*.
2. Espera a que suban (puede tardar 1-3 minutos)
3. Abajo, en **"Commit changes"**, deja el mensaje por defecto
4. Clic en el botón verde **"Commit changes"**

✅ **Ya está en GitHub.** Vas a ver todos los archivos listados en tu repositorio.

---

## PASO 3️⃣ · Crea tu cuenta de Vercel (5 minutos)

Vercel es el servicio que va a tomar tu código de GitHub y publicarlo en
internet, con un link real que puedes compartir.

1. Abre [vercel.com](https://vercel.com)
2. Clic en **"Sign Up"**
3. Elige **"Continue with GitHub"** ← esto es importante, es lo que conecta ambas cuentas
4. Autoriza a Vercel a acceder a tu GitHub (clic en "Authorize Vercel")
5. Cuando te pida el plan, elige **"Hobby"** (gratis para siempre)
6. Cuando te pregunte por el nombre del "team" o "workspace", pon lo que quieras (ej. tu nombre)

✅ **Ya tienes Vercel.**

---

## PASO 4️⃣ · Publica tu proyecto (5 minutos)

1. En Vercel, verás un botón grande que dice **"Add New..."** → **"Project"**
2. Verás una lista de tus repositorios de GitHub. Encuentra `academia-flc`
   y clic en **"Import"**
3. Aparecerá una pantalla con opciones. **NO cambies nada** — Vercel detecta
   automáticamente que es una web sencilla.
   - Framework Preset: "Other" (está bien así)
   - Root Directory: `./` (déjalo así)
   - Build Settings: no toques nada
4. Clic en el botón grande **"Deploy"**
5. Espera 30-60 segundos… verás un ✨ cuando termine
6. Verás una pantalla de celebración con un **link tipo `academia-flc.vercel.app`**

✅ **¡Tu plataforma está EN VIVO!**

Clic en el link para probarla. Deberías ver el login con el logo verde.
Prueba entrar con tu nombre, tu correo, y la contraseña de agencia que pusiste.

---

## PASO 5️⃣ · (Opcional) Cambia el dominio a algo más bonito

El link por defecto es `academia-flc.vercel.app` — funcional pero largo.

### Opción gratis: cambia el subdominio de Vercel

1. En tu proyecto de Vercel, ve a **Settings** → **Domains**
2. Verás tu dominio actual. Puedes editarlo por algo como
   `flc-academia.vercel.app` o `academia-legacy.vercel.app`
3. Guarda

### Opción con dominio propio (~$12/año)

1. Compra un dominio en [Namecheap](https://namecheap.com) o [Porkbun](https://porkbun.com)
   (ej. `academiaflc.com`)
2. En Vercel → Settings → Domains → agrega tu dominio
3. Vercel te da 2 líneas que debes copiar en el panel de tu proveedor de dominio
4. Espera 5-30 minutos y tu dominio funciona con https automático

---

## PASO 6️⃣ · Comparte con tus agentes

Manda un WhatsApp / email al grupo de agentes con este mensaje
(cámbialo a tu gusto):

> **¡Hola equipo! 🎉**
>
> Ya está lista nuestra academia interna. Ahí encontrarán todo lo que
> necesitan para arrancar:
>
> 🔗 **Link:** https://academia-flc.vercel.app
> 🔑 **Contraseña:** `FLC2026` (o la que hayas puesto)
>
> Al entrar por primera vez, pongan su nombre completo (aparecerá en su
> certificado al terminar). Empiecen por el video de bienvenida.
>
> ¡Cualquier duda, me escriben!

---

## 🔄 Cómo actualizar la plataforma después

Cuando quieras cambiar algo (agregar un video nuevo, cambiar la contraseña,
etc.), el proceso es súper rápido:

1. Modifica el archivo que necesites en tu computadora
2. Ve a tu repositorio en github.com
3. Abre el archivo modificado, clic en el lápiz ✏️
4. Pega el nuevo contenido y clic en "Commit changes"
5. Vercel detecta el cambio automáticamente y **re-publica en 30 segundos**

**No necesitas hacer nada más.** El link se queda igual, pero con la
nueva versión.

---

## 🆘 Solución de problemas

### "Mi agente no puede entrar"
- Confirma que le diste la contraseña correcta
- Confirma que estén escribiendo su nombre + email + contraseña
- La contraseña distingue mayúsculas y minúsculas

### "El video de bienvenida no se ve"
- Abre tu Google Drive
- Encuentra el archivo de bienvenida
- Clic derecho → Compartir → "Cualquier persona con el enlace" → "Lector"
- Guarda
- Espera 1 minuto y vuelve a probar

### "Los tutoriales no cargan"
- Mismo problema: verifica que cada video en Drive esté como
  "Cualquier persona con el enlace"
- Un video con permisos restringidos rompe el modal

### "Vercel me dice que falló el deploy"
- Revisa que subiste TODOS los archivos a GitHub
- Especialmente: `index.html`, la carpeta `assets`, `components`, `data`, y `app.jsx`
- Si falta uno, súbelo y Vercel re-publica solo

### "Perdí mi contraseña de GitHub / Vercel"
- Recupérala con "Forgot password" en cada sitio
- Usa el correo con el que te registraste

---

## 💡 Próximos pasos (cuando quieras)

Cuando la plataforma ya esté rodando con tus agentes y quieras subir
al siguiente nivel:

1. **Comprar dominio propio** (~$12/año) — más profesional
2. **Migrar videos a YouTube** en modo "no listado" — más rápido y sin
   límites de reproducción como Drive
3. **Cuentas reales con Supabase** — que cada agente tenga su propio login
   y su progreso se guarde en la nube (te lleva 8-12 horas de tutoriales
   de YouTube)

---

**¿Necesitas ayuda?** Vuelve al chat donde hicimos esto y pídelo con detalle.

**¡Éxitos con la academia! 🚀**
