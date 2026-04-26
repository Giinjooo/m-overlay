# M-Overlay

MLBB Overlay Tool v4.8 - A real-time overlay control system for MLBB esports broadcasts.

## Features

- **Live Draft Overlay** - Real-time ban/pick display
- **Scoreboard** - Team scores, player stats
- **Post-Game Stats** - MVP and match statistics
- **Custom Themes** - Team colors, logos, branding
- **WebSocket Sync** - Real-time updates across all clients

## Quick Start (Local)

```bash
npm install
npm start
```

Open http://localhost:3000

## Deployment

### 1. GitHub

Create repository and push:

```bash
git init
git add .
git commit -m "M-Overlay v4.8"
# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/M-Overlay.git
git push -u origin main
```

## Password Protection

For co-streamer access, use the password: `mlbbsepi`

### 2. Railway

1. Go to [railway.app](https://railway.app)
2. Login with GitHub
3. New Project → Deploy from GitHub repo
4. Select the M-Overlay repo
5. Add environment variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `APP_PASSWORD` (optional, defaults to mlbbsepi)

### 3. Cloudinary (Images)

1. Go to [cloudinary.com](https://cloudinary.com)
2. Create free account
3. Upload HeroPick images to a folder
4. Get your cloud name and API credentials
5. Add to Railway environment variables

## Usage

| Page | URL | Purpose |
|------|-----|---------|
| Control Hub | / | Main control panel |
| Control | /control.html | Match data control |
| Display | /display.html | Broadcast overlay |
| Scoreboard | /scoreboard.html | Live scoreboard |
| Post Draft | /postdraft.html | Draft summary |

## Network Access

For co-streamer to access:
- Use Railway URL (e.g., `https://your-app.railway.app`)
- Or deploy to your own server with static IP

## Credits

Created by MSEPI - M-Overlay

## License

Free for personal/commercial use.