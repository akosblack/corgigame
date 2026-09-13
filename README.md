# Corgi Quest

Playable one-level 2D action platformer built with HTML5 Canvas, CSS, and
vanilla JavaScript. No external assets or runtime CDN dependencies required.

## Run locally

From this directory:

```sh
python3 -m http.server 8088
```

Open <http://localhost:8088>.

## Run with Docker

```sh
docker compose up -d --build
```

Open <http://localhost:8088>.

The container serves static files with Nginx on port 80. Change the host port
in `docker-compose.yml` if port `8088` is already in use. Cloudflare Tunnel
should target the host service on port `8088`; TLS stays at Cloudflare.

## Controls

| Action | Keys |
|---|---|
| Move | `A/D` or left/right arrows |
| Jump | `Space`, `W`, or up arrow |
| Dash | `Shift` or `K` |
| Attack | `J` or `X` |
| Pause | `Esc` |

## Level

Park Patrol includes platforms, hazards, treats, squirrels, a checkpoint,
health, score, dash invulnerability, hit flashes, particles, parallax scenery,
screen shake, a boss fight, and a victory screen.

All game logic and programmatic pixel-art drawing live in `game.js`. Add levels
by extending the platform, enemy, collectible, and boss data near the top of
the file.
