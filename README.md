# FOCO — Android (Vite + React + Capacitor)

## Qué es esto, exactamente

Este proyecto NO es una maqueta. Es la app real:

- `src/App.jsx` = copia **byte a byte** de `foco.jsx` (verificado con `diff`, 0 diferencias).
  No se tocó una sola línea de lógica: diagnóstico, historial, score, Contrato
  Diario, Resumen Semanal, Modo Testigo, Pomodoro, logros, cifrado local, todo
  igual.
- `src/main.jsx` = 6 líneas que solo montan `<App/>` en el DOM. Cero lógica propia.
- `index.html`, `vite.config.js`, `package.json`, `capacitor.config.ts` = la
  configuración estándar mínima para que ese código corra bajo Vite y se pueda
  empaquetar con Capacitor. Nada de esto agrega funciones nuevas a la app.

## Lo que pude hacer acá vs. lo que hace falta en tu máquina

Sé honesto con esto porque importa: **este entorno donde te escribo no tiene
acceso a internet para npm ni a Android SDK.** Lo comprobé con comandos reales
antes de escribir esto, no lo supongo. Por eso:

- ✅ Hecho y verificado acá: estructura del proyecto, `App.jsx` copiado e
  íntegro, sintaxis JSX auditada sin errores, configuración de Vite y
  Capacitor escrita correctamente.
- ❌ No pude ejecutar acá (requieren internet + Android SDK que no tengo):
  `npm install`, `npx cap add android`, la compilación de Gradle que genera
  el `.apk` real.

Esos pasos los corrés vos, en tu computadora, con los comandos exactos de
abajo. Necesitás tener instalado: **Node.js** (18 o más nuevo), y
**Android Studio** (que ya trae el Android SDK y Gradle incluidos — es la
forma más simple de tener todo lo necesario).

## Comandos exactos, en orden

Desde la carpeta `foco-android/` (esta carpeta):

```bash
# 1. Instalar dependencias de Node (React, Vite, Capacitor)
npm install

# 2. Generar la carpeta android/ (usa la plantilla oficial de Capacitor)
npx cap add android

# 3. Compilar la app web (genera dist/, que Capacitor empaqueta)
npm run build

# 4. Copiar el build web adentro del proyecto Android
npx cap sync android
```

## El único ajuste manual que falta — el fix #1 del audit

Después del paso 2 (`npx cap add android`), abrí este archivo:

```
android/app/src/main/AndroidManifest.xml
```

Y agregá esta línea junto a los demás `<uses-permission>` (Capacitor ya pone
`INTERNET` ahí por defecto — sumás esta al lado):

```xml
<uses-permission android:name="android.permission.VIBRATE" />
```

Sin esto, la app compila y funciona igual, pero el haptic feedback (las
vibraciones cortas al hacer check-in) no van a sentirse en el teléfono. Con
esto, sí.

*(El fix #2 — que WhatsApp/Twitter abran la app externa en vez de quedarse
adentro de FOCO — ya está resuelto en `capacitor.config.ts`, no requiere que
hagas nada más.)*

## Generar el APK

Con Android Studio instalado:

```bash
npx cap open android
```

Esto abre el proyecto en Android Studio. Ahí:

- **Para un APK de prueba (debug, instalable directo, sin firmar):**
  Menú `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`.

- **Para un APK de verdad, listo para repartir (release, firmado):**
  Menú `Build` → `Generate Signed Bundle / APK` → elegís `APK` → creás o
  usás una keystore (Android Studio te guía) → `release`.

### Dónde va a quedar el archivo

**Debug (prueba rápida):**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

**Release (firmado, el que compartís de verdad):**
```
android/app/build/outputs/apk/release/app-release.apk
```

Ese archivo, renombralo a `FOCO.apk` — es el que subís a la web.

## Cómo subir el APK a la landing page

1. Renombrá el archivo generado a `FOCO.apk`.
2. Subilo a la misma carpeta donde está tu `index.html` de la landing (en
   Netlify: arrastralo junto con los demás archivos al hacer el deploy, o
   agregalo al repositorio si usás GitHub Pages).
3. La landing ya tiene los botones "Descargar para Android" apuntando a
   `./FOCO.apk` (ver más abajo — ya está hecho el cambio).
4. Cuando alguien lo descargue e instale, Android le va a avisar "app de
   origen desconocido" — es normal para APKs fuera de Play Store, el usuario
   tiene que aceptar esa advertencia una vez.

## Estructura final

```
FOCO/
├── web/
│   └── foco-landing.html          ← landing, proyecto separado, sin tocar la app
│
└── app/                            ← esta carpeta (foco-android/)
    ├── package.json
    ├── vite.config.js
    ├── capacitor.config.ts
    ├── index.html
    ├── .gitignore
    ├── src/
    │   ├── main.jsx
    │   └── App.jsx                ← = foco.jsx, sin modificar
    └── android/                    ← se genera con `npx cap add android`
        └── app/build/outputs/apk/
            ├── debug/app-debug.apk
            └── release/app-release.apk   ← este es FOCO.apk
```
