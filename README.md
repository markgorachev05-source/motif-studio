# MOTIF® — independent creative studio

An original creative-studio site inspired by the supplied motion reference: a near-black editorial canvas, capsule navigation, fine serif typography, and glossy botanical forms that bloom as the page moves from studio story to capabilities, selected work, and contact.

## Run locally

Requires Node.js 18 or newer. From this folder, run:

```powershell
node server.mjs
```

Then open <http://127.0.0.1:4173>. Stop the server with `Ctrl+C`.

## Show it to someone on the same Wi‑Fi

In PowerShell, set the server to listen on the local network before starting it:

```powershell
$env:HOST = "0.0.0.0"
node server.mjs
```

Find this computer's IPv4 address with `ipconfig`, then share `http://<IPv4-address>:4173` (for example, `http://192.168.1.25:4173`). Both devices need to be on the same network. The `127.0.0.1` address works only on this computer.

For people outside your local network, publish the site files (`index.html`, `styles.css`, `scene.js`, and `ui.js`) to a web host and share its public URL. The local preview server is not a public deployment.

The site has no npm packages or image assets. Its 3D scene is drawn with native WebGL; if WebGL is unavailable, the page keeps a quiet CSS illustration. The page adapts the scene for phone screens and reduces animation when `prefers-reduced-motion` is enabled. Google Fonts are an optional typographic enhancement; system serif and sans-serif fonts are used as fallbacks.
