# farmia_landing

Sitio público de FarmIA: <https://www.farmiasolutions.com>.

Es un sitio estático (HTML, CSS y JavaScript, sin framework ni paso de build). Vercel lo despliega solo: cada push a `main` sale a producción y cada PR genera una vista previa.

## Idiomas

El sitio se publica en tres idiomas con el mismo diseño. **El español es el idioma fuente**: todo texto nuevo nace en español y en el mismo cambio recibe su versión en inglés y en portugués de Brasil.

| Idioma | Página principal | Módulos |
|---|---|---|
| Español (`es-AR`) | `/` | `/modulos/<slug>/` |
| Inglés (`en`, EE. UU.) | `/en/` | `/en/modules/<slug-en>/` |
| Portugués (`pt-BR`) | `/pt/` | `/pt/modulos/<slug-pt>/` |

- Cada página enlaza su equivalente en los otros idiomas con el selector de idioma (en el encabezado, un botón con el globo y el código que despliega `Español`, `English`, `Português`, visible también en móvil junto a la hamburguesa; en el pie, los mismos nombres como enlaces) y con `<link rel="alternate" hreflang>`; `x-default` apunta al español. El nombre de cada idioma es `nativeName` en `content/i18n/<código>.mjs`.
- No hay redirección automática por idioma del navegador.
- El slug en español de cada módulo (`analisis-gis`, `monitoreo`, …) es su id interno: catálogo, conexiones y el campo `module_interest` del formulario. Los slugs en inglés y portugués viven en `content/i18n/en.mjs` y `pt.mjs`.
- Las URLs y los anclajes en español (`#modulos`, `#preguntas-frecuentes`, …) son enlaces publicados: no cambian.
- El formulario de demo envía un campo oculto `language` (`es`, `en` o `pt`) y un asunto traducido.
- La terminología sigue el glosario del producto (`docs/i18n/GLOSSARY.md` y `STYLE.md` del repo de la app): Lote → *field* / *talhão*, Campaña → *season* / *safra*, Ambiente → *management zone* / *zona de manejo*, Monitoreo → *scouting* / *monitoramento*, etc. `tests/i18n.test.mjs` rechaza los términos prohibidos del glosario.

### Idioma según el navegador

`vercel.json` redirige **solo la página principal** (`/`) a `/pt/` o `/en/` cuando el primer idioma del navegador (`Accept-Language`) es portugués o inglés. Cualquier otro idioma ve el español.

- Los enlaces directos a `/en/`, `/pt/` o a un módulo nunca se redirigen.
- Al elegir un idioma en el selector, `script.js` guarda la cookie `farmia_lang` por un año y la redirección deja de actuar: quien elige «Español» se queda en español.
- Es una redirección temporal (307) y no depende de la IP.
- No se puede probar con el servidor local ni en las vistas previas protegidas de Vercel: se verifica en producción con `curl -I -H "Accept-Language: pt-BR" https://www.farmiasolutions.com/`.

## Estructura

- `templates/home.html`: el marcado de la página principal, con marcadores `{{clave}}` en lugar de texto. Lo comparten los tres idiomas.
- `content/i18n/es.mjs`, `en.mjs`, `pt.mjs`: un archivo por idioma con
  - `ui`: encabezado, pie, botones y rótulos compartidos por todas las páginas;
  - `home`: los textos de la página principal;
  - `anchors`: los ids de las secciones de la página principal;
  - en `en.mjs` y `pt.mjs`, además, `modules` (el texto de cada módulo, por slug en español, con su slug traducido) y `groups` (los grupos de módulos).
- `content/modules.mjs`: los datos compartidos del sitio (`site`: enlaces, tiendas, Formspree, email, D-U-N-S) y el catálogo de módulos: estructura (imágenes, conexiones, grupos) y su texto en español.
- `scripts/generate-modules.mjs`: genera todas las páginas y `sitemap.xml`; con `--check` solo verifica que estén al día. Antes de generar valida que cada idioma traduzca todo el catálogo con la misma forma que el español.
- Generados (**no se editan a mano**): `index.html`, `modulos/`, `en/`, `pt/` y `sitemap.xml`.
- `styles.css`, `module-pages.css`, `script.js`: estilos y comportamiento. `script.js` tiene sus propios mensajes (menú y formulario) en los tres idiomas y elige por `<html lang>`.
- `assets/`: imágenes y fuentes (los badges de las tiendas, en `assets/store/`, uno por idioma). La carpeta `assets/product/_source/` (originales pesados) no se versiona. Las capturas del producto son las mismas en los tres idiomas (la interfaz que muestran está en español); sus textos alternativos y leyendas sí se traducen.
- `tests/`: pruebas con el runner de Node (`node --test`).

Los archivos generados se versionan: Vercel publica lo que está en el repo, sin paso de build.

## Cambiar o agregar un texto

1. Editá el texto en español: `content/i18n/es.mjs` (página principal y textos compartidos) o `content/modules.mjs` (páginas de módulos).
2. Hacé el mismo cambio en `content/i18n/en.mjs` y `content/i18n/pt.mjs`, en la misma clave (para un módulo, dentro de `modules['<slug-en-español>']`).
3. Si es una clave nueva de la página principal, usala en `templates/home.html` como `{{home.…}}`.
4. Regenerá y probá:

```bash
node scripts/generate-modules.mjs          # regenera todas las páginas y sitemap.xml
node scripts/generate-modules.mjs --check  # verifica que lo versionado esté al día
node --test tests/                         # pruebas
npx serve . -l 4173                        # o python -m http.server 4173; abrir http://localhost:4173
```

Las pruebas fallan si un idioma no tiene exactamente las mismas claves que el español, si una cadena en inglés o portugués quedó igual al español (salvo la lista comentada de excepciones en `tests/i18n.test.mjs`: marcas y palabras que son iguales) o si un enlace interno de `/en/` o `/pt/` sale de su idioma. Un marcador que no existe frena la generación con un error que nombra la clave. El repo fuerza finales de línea LF (`.gitattributes`), así que `--check` compara bien también en Windows.

Al cambiar `styles.css` o `script.js`, subí su `?v=` en `assetVersions` de `scripts/generate-modules.mjs`.

## Reglas

- El repo es público: nunca lleva credenciales, claves ni datos de clientes. GitHub bloquea el push si detecta un secreto.
- Un formulario o integración que necesite claves va a la API de FarmIA, no a este repo.
- Los nombres de rutas (`/modulos/<slug>/`, `/en/modules/<slug>/`, `/pt/modulos/<slug>/`) y los anclajes son enlaces publicados: no se renombran sin redirección.
- Flujo: rama por cambio y PR a `main`; la vista previa de Vercel aparece en el PR. `main` no admite borrado ni push forzado.

## Licencia

Contenido, diseño y marca pertenecen a FarmIA Solutions; ver `LICENSE`.
