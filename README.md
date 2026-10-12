# Tomo Como Rey · Mezcla músicos

Panel web para pedir cambios de mezcla de monitores al sonidista de monitor cuando no hay talkback.

**Flujo del técnico:** 1) elige músico → 2) elige un elemento y toca **−** o **+** (se agrega al pedido; repite con otros elementos) → 3) **Enviar pedido**. Todo llega como un solo pedido con varios cambios. Tocar varias veces el mismo signo suma (+2). Tocar un cambio del pedido lo quita.
**Sonidista monitor:** ve la cola de pedidos, con aviso sonoro y vibración, y toca **Hecho** cuando lo aplica. Cada pedido aparece como una tarjeta con todos sus cambios; tocar una línea la tacha para ir llevando el control, y **Hecho** cierra el pedido completo.

**Músicos:** pueden entrar con el rol *Músico*, elegir quién son y pedir cambios de su propia mezcla (sin paso de elegir músico). El sonidista monitor los ve marcados como "Pedido personal del músico".

**Batería:** al tocar *Batería* se despliegan los canales (bombo, caja, hi-hat, toms, timbales, campanas, platillos OH). Si no abres el submenú, el pedido es para todo el kit.

Roles: Sonidista monitor, Drumtech, Guitartech, Técnico RF, Director / secuenciador y Sonidista sala (este último no participa en la mezcla de músicos).

## Bandas y plantillas

La pantalla de inicio es un catálogo de bandas. Cada plantilla tiene sus **músicos**, **canales** (con subcanales opcionales) y **staff / roles**.

- **Usar:** elige la banda, tu sala y tu rol. Al entrar, la plantilla se publica en la sala y el resto del equipo la recibe automáticamente.
- **Editar:** cambia nombre, músicos, canales, subcanales y roles. Cada rol tiene un tipo: recibe pedidos (monitor), envía pedidos (técnico), músico (pedidos personales) o sin mezcla de músicos. Al guardar, si estás conectado a la sala, los demás reciben los cambios en vivo.
- **Nueva banda, Duplicar, Eliminar:** el catálogo se guarda en cada dispositivo.
- **Exportar / Importar:** guarda una plantilla como archivo .json para respaldarla o pasarla a otro equipo.
- **Unirme a una sala existente:** con Firebase configurado, escribe el código de sala y se descarga la plantilla que publicó el equipo.

## Cómo conectar al equipo (Firebase, gratis)

GitHub Pages solo sirve archivos estáticos, así que los pedidos viajan por una base de datos en tiempo real.

1. Entra a https://console.firebase.google.com y crea un proyecto.
2. Menú **Build → Realtime Database → Create database**.
3. En la pestaña **Rules** pega esto y publica:

```json
{
  "rules": {
    "rooms": {
      "$room": { ".read": true, ".write": true }
    }
  }
}
```

4. Copia la URL de la base (algo como `https://tu-proyecto-default-rtdb.firebaseio.com`) en `config.js`:

```js
firebaseUrl: "https://tu-proyecto-default-rtdb.firebaseio.com",
```

Importante: con esas reglas cualquiera que conozca la URL y el código de sala puede leer y escribir. Usa un código de sala poco obvio (por ejemplo `tcr-7k2x`). Para un panel de pedidos de mezcla es un riesgo bajo, pero no pongas nada sensible ahí.

## Publicar en GitHub Pages

1. Crea un repositorio y sube estos archivos (`index.html`, `app.js`, `style.css`, `config.js`).
2. **Settings → Pages → Deploy from a branch → main / root**.
3. Abre la URL que te entrega GitHub en cada teléfono o tablet y elige tu rol. Todos deben usar el mismo código de sala.

## Probar sin Firebase

Con `firebaseUrl` vacío funciona en modo local: abre dos pestañas del mismo navegador, una como monitor y otra como técnico.

## Editar la banda

Músicos, elementos y roles están al inicio de `app.js` (`MUSICIANS`, `SOURCES`, `ROLES`).
