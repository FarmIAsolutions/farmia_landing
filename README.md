# farmia_landing

Sitio público de FarmIA: <https://www.farmiasolutions.com>.

Es un sitio estático (HTML, CSS y JavaScript, sin framework ni paso de build). Vercel lo despliega solo: cada push a `main` sale a producción y cada PR genera una vista previa.

## Estructura

- `index.html`: la página principal, **generada** desde `templates/home.html` y `content/i18n/es.mjs`. No se edita a mano.
- `templates/home.html`: el marcado de la página principal, con marcadores `{{clave}}` en lugar de texto.
- `content/i18n/es.mjs`: todos los textos del sitio en español: `ui` (encabezado, pie, botones y rótulos compartidos por todas las páginas) y `home` (los de la página principal).
- `content/modules.mjs`: los datos del sitio (`site`: enlaces, email, D-U-N-S) y el contenido de las páginas de módulos (un objeto por módulo).
- `modulos/<slug>/index.html` y `sitemap.xml`: también **generados**. No se editan a mano.
- `scripts/generate-modules.mjs`: genera `index.html`, `modulos/` y `sitemap.xml`; con `--check` solo verifica que estén al día.
- `styles.css`, `module-pages.css`, `script.js`: estilos y comportamiento.
- `assets/`: imágenes y fuentes. La carpeta `assets/product/_source/` (originales pesados) no se versiona.
- `tests/`: pruebas con el runner de Node (`node --test`).

Los archivos generados se versionan: Vercel publica lo que está en el repo, sin paso de build.

## Trabajar en local

Para cambiar un texto, editá `content/i18n/es.mjs` (o `content/modules.mjs` si es de un módulo); para cambiar el marcado de la página principal, `templates/home.html`. Después regenerá:

```bash
node scripts/generate-modules.mjs   # regenera index.html, modulos/ y sitemap.xml
node scripts/generate-modules.mjs --check   # verifica que lo versionado esté al día
node --test tests/                   # pruebas
npx serve .                          # o python -m http.server; abrir http://localhost:3000
```

Un marcador que no existe en `content/i18n/es.mjs` frena la generación con un error que nombra la clave. El repo fuerza finales de línea LF (`.gitattributes`), así que `--check` compara bien también en Windows.

## Reglas

- El repo es público: nunca lleva credenciales, claves ni datos de clientes. GitHub bloquea el push si detecta un secreto.
- Un formulario o integración que necesite claves va a la API de FarmIA, no a este repo.
- Los nombres de rutas (`/modulos/<slug>/`) son enlaces publicados: no se renombran sin redirección.
- Flujo: rama por cambio y PR a `main`; la vista previa de Vercel aparece en el PR. `main` no admite borrado ni push forzado.

## Licencia

Contenido, diseño y marca pertenecen a FarmIA Solutions; ver `LICENSE`.
