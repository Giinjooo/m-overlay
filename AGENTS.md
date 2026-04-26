# AGENTS.md - M-Overlay

## Tech Stack
- Express + Socket.IO + Node.js
- Cloudinary for image hosting (optional)

## Run Locally
```bash
npm install
npm start
# Opens on http://localhost:3000
```

## Railway Deployment (Critical)

**This app failed repeatedly on Railway until these fixes:**

1. **server.js must bind to `0.0.0.0`** - not localhost
   ```js
   server.listen(PORT, '0.0.0.0', () => {...})
   ```

2. **Required files:** `railway.json` + `Procfile`
   - Procfile: `web: node server.js`

3. **PORT from environment** - Railway sets this:
   ```js
   const PORT = process.env.PORT || 3000;
   ```

4. **Cloudinary optional** - only initialize if API keys exist:
   ```js
   if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
     cloudinary = require('cloudinary').v2;
     // ...
   }
   ```

## Git Workflow
```bash
git add .
git commit -m "message"
git push origin master  # Branch is master, not main
```

## Key Files
- `server.js` - Express server entrypoint
- `public/index.html` - Control hub (renamed from hub.html)
- `public/heromanager.html` - Add new heroes
- `public/database/herolist.json` - Hero list (for dropdowns)

## Environment Variables
| Variable | Required | Default |
|----------|----------|---------|
| PORT | No | 3000 |
| CLOUDINARY_CLOUD_NAME | No | - |
| CLOUDINARY_API_KEY | No | - |
| CLOUDINARY_API_SECRET | No | - |
| CLOUDINARY_HERO_BASE_URL | No | - |
| APP_PASSWORD | No | mlbbsepi |

## Pages
- `/` - Control hub
- `/control.html` - Match control
- `/display.html` - Broadcast overlay
- `/scoreboard.html` - Live scores
- `/heromanager.html` - Add heroes (API: `/api/herolist` POST)