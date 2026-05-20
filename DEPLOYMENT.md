# Guia rapida para dejar TultiMarket listo en Azure

## 1. Backend

Carpeta: `back`

Comando de instalacion:

```bash
npm install
```

Comando de inicio:

```bash
npm start
```

Variables importantes en Azure:

- `NODE_ENV=production`
- `PORT` lo puede asignar Azure automaticamente
- `CORS_ORIGIN` con la URL publica del frontend
- `SESSION_SECRET` con una clave larga y privada
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=none`
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
- `PGSSL=true` si Azure exige SSL
- `IA_BASE_URL` si el servicio de IA se publica aparte

Chequeo rapido despues de publicar:

```text
GET https://TU-BACKEND.azurewebsites.net/health
```

Debe responder `status: ok` y `database: ok`.

## 2. Frontend

Carpeta: `TultiMarket/Marketplace website design`

Antes de compilar, configurar:

```text
VITE_API_URL=https://TU-BACKEND.azurewebsites.net
```

Comando de instalacion:

```bash
npm install
```

Comando de build:

```bash
npm run build
```

La carpeta que se publica es:

```text
dist
```

## 3. Base de datos

Antes de probar la app en Azure, confirmar que la base tiene:

- tablas completas
- datos base como roles y categorias
- triggers necesarios para inventario
- extensiones necesarias para IA o busqueda, si aplican

## 4. Servicio de IA

Si la IA se publica como servicio separado, usar la carpeta:

```text
back/IA
```

Instalacion:

```bash
pip install -r requirements.txt
```

Comando de inicio sugerido:

```bash
uvicorn ai_bridge:app --host 0.0.0.0 --port 8000
```

Variables que debe compartir con el backend:

- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
- `PGSSL=true` si Azure exige SSL
- `DATABASE_URL` si se prefiere cadena completa
- `OLLAMA_URL` si se regeneran embeddings

## 5. Prueba final

Probar al menos estos flujos:

- registro e inicio de sesion
- crear negocio como vendedor
- crear producto con imagen
- editar stock desde inventario
- buscar producto como comprador
- agregar al carrito y generar pedido
- cambiar estado del pedido como vendedor
- revisar panel admin
- probar recomendaciones de IA o confirmar fallback

## Nota sobre imagenes

Hoy las imagenes se guardan en `static/images/products`. Eso funciona para una demo, pero en produccion real conviene moverlas a Azure Blob Storage para que no dependan del disco local del servidor.
