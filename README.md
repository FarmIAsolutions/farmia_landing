# farmia_landing

Sitio público de FarmIA: <https://www.farmiasolutions.com>.

Es un sitio estático (HTML, CSS y JavaScript, sin framework ni paso de build). Vercel lo despliega solo: cada push a `main` sale a producción y cada PR genera una vista previa.

## Estructura

- `index.html`, `styles.css`, `script.js`: la página principal.
- `content/modules.mjs`: el contenido de las páginas de módulos (un objeto por módulo).
- `modulos/<slug>/index.html`: páginas de módulos **generadas** desde `content/modules.mjs`. No se editan a mano.
- `scripts/generate-modules.mjs`: genera `modulos/` a partir del contenido; con `--check` solo verifica que estén al día.
- `assets/`: imágenes y fuentes. La carpeta `assets/product/_source/` (originales pesados) no se versiona.
- `tests/`: pruebas con el runner de Node (`node --test`).

## Trabajar en local

```bash
node scripts/generate-modules.mjs   # regenera modulos/ si tocaste content/modules.mjs
node --test tests/                   # pruebas
npx serve .                          # o python -m http.server; abrir http://localhost:3000
```

## Reglas

- El repo es público: nunca lleva credenciales, claves ni datos de clientes. GitHub bloquea el push si detecta un secreto.
- Un formulario o integración que necesite claves va a la API de FarmIA, no a este repo.
- Los nombres de rutas (`/modulos/<slug>/`) son enlaces publicados: no se renombran sin redirección.
- Flujo: rama por cambio y PR a `main`; la vista previa de Vercel aparece en el PR. `main` no admite borrado ni push forzado.

## Licencia

Contenido, diseño y marca pertenecen a FarmIA Solutions; ver `LICENSE`.
