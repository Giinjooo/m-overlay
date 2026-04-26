// M-Overlay Server v4.8
// Modular Express + Socket.IO Server with Cloudinary Support

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const multer = require('multer');
const os = require('os');
const cookieParser = require('cookie-parser')();

// Cloudinary config (set via environment variables)
// Only initialize if credentials are provided
let cloudinary;
if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your_cloud_name',
    api_key: process.env.CLOUDINARY_API_KEY || 'your_api_key',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'your_api_secret'
  });
}

// Cloudinary Base URLs (set in environment or leave empty for local)
const CLOUDINARY_BASE_URL = process.env.CLOUDINARY_BASE_URL || '';
const HERO_BASE_URL = process.env.CLOUDINARY_HERO_BASE_URL || CLOUDINARY_BASE_URL + '/HeroPick/';
const ITEM_BASE_URL = process.env.CLOUDINARY_ITEM_BASE_URL || CLOUDINARY_BASE_URL + '/Itemandspell/';
const VOICE_BASE_URL = process.env.CLOUDINARY_VOICE_BASE_URL || CLOUDINARY_BASE_URL + '/Voicelines/';
const FONT_BASE_URL = process.env.CLOUDINARY_FONT_BASE_URL || CLOUDINARY_BASE_URL + '/Font/';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Increase payload limits for file uploads
app.use(cookieParser);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// ==========================================
// PASSWORD PROTECTION
// ==========================================
const AUTH_PASSWORD = process.env.APP_PASSWORD || 'mlbbsepi';

// Simple auth check - check cookie or query param
function checkAuth(req, res, next) {
  const token = req.cookies?.auth || req.query?.pwd;
  if (token === AUTH_PASSWORD) {
    return next();
  }
  // For display/overlay pages, allow without auth
  if (req.path.includes('display') || req.path.includes('draw') || req.path.includes('post') || 
      req.path.includes('mvp') || req.path.includes('scoreboard') || req.path.includes('schedule') ||
      req.path === '/' || req.path === '/index.html' || req.path.endsWith('.css') || req.path.endsWith('.js') ||
      req.path.endsWith('.png') || req.path.endsWith('.jpg') || req.path.endsWith('.gif') || req.path.endsWith('.webm')) {
    return next();
  }
  // API endpoints need auth (except read endpoints)
  if (req.path.startsWith('/api/') && (req.method === 'GET')) {
    return next();
  }
  // Allow access without password for now (can be enabled for stricter auth)
  // Uncomment below for strict auth:
  // return res.redirect('/login.html?redirect=' + encodeURIComponent(req.url));
  return next();
}
app.use(checkAuth);

// Login endpoint
app.post('/api/login', express.json(), (req, res) => {
  if (req.body.password === AUTH_PASSWORD) {
    res.cookie('auth', AUTH_PASSWORD, { httpOnly: true, maxAge: 86400000 }); // 24 hours
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// ==========================================
// 1. FILE QUEUE (Prevent Race Conditions)
// ==========================================
class AsyncQueue {
  constructor() {
    this.queue = Promise.resolve();
  }
  enqueue(task) {
    this.queue = this.queue.then(task).catch(err => console.error('Queue Error:', err));
    return this.queue;
  }
}
const fileQueue = new AsyncQueue();

// ==========================================
// 2. DIRECTORIES & PATHS
// ==========================================
const dbDir = path.join(__dirname, 'public/database');
const savedMatchDir = path.join(dbDir, 'savedmatch');
const themeDir = path.join(__dirname, 'public/Assets/costum/Theme');
const flagDir = path.join(__dirname, 'public/Assets/nationalflag');
const uploadDir = path.join(__dirname, 'public/uploads');

// Create directories if not exist
[dbDir, savedMatchDir, themeDir, flagDir, uploadDir].forEach(dir => {
  if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
});

// Database file paths
const matchDataPath = path.join(dbDir, 'matchdatateam.json');
const draftDataPath = path.join(dbDir, 'matchdraft.json');
const prevDraftPath = path.join(dbDir, 'previousmatchdraft.json');
const mapDrawPath = path.join(dbDir, 'mapdraw.json');
const mvpDataPath = path.join(dbDir, 'mvpdata.json');
const notifPath = path.join(dbDir, 'notification.json');
const schedulePath = path.join(dbDir, 'schedule.json');
const itemsPath = path.join(dbDir, 'items.json');
const flagJsonPath = path.join(dbDir, 'flags.json');

// ==========================================
// 3. MULTER CONFIG (Cloudinary + Local)
// ==========================================
const multers = {
  theme: multer({ storage: multer.diskStorage({ destination: themeDir, filename: (req, file, cb) => cb(null, file.originalname) }) }),
  flag: multer({ storage: multer.diskStorage({ destination: flagDir, filename: (req, file, cb) => cb(null, file.originalname) }) }),
  upload: multer({ storage: multer.diskStorage({ destination: uploadDir, filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) }) })
};

// ==========================================
// 4. DEFAULT DATA
// ==========================================
const defaultMatchData = {
  game_duration: "00:00", game_number: 0, winmatches: "none",
  teamdata: {
    blueteam: { teamname: "BLUE TEAM", score: "0", logo: "", totalgold: 0, turret: 0, lord: 0, turtle: 0,
      playerlist: Array(5).fill().map(() => ({ name: "Player", hero: "", level: 0, KDA: "0/0/0", gold: 0, spell: "idle", banhero: "", itemlist: ["idle","idle","idle","idle","idle","idle"] }))
    },
    redteam: { teamname: "RED TEAM", score: "0", logo: "", totalgold: 0, turret: 0, lord: 0, turtle: 0,
      playerlist: Array(5).fill().map(() => ({ name: "Player", hero: "", level: 0, KDA: "0/0/0", gold: 0, spell: "idle", banhero: "", itemlist: ["idle","idle","idle","idle","idle","idle"] }))
    }
  }
};

const defaultTheme = {
  fontFile: "Renegade Pursuit.otf", useCustomFont: false, fontSizeMultiplier: 1.0,
  images: { heroPickBg: "", lowerBg: "", lowerMidBg: "" },
  colors: { bluePrimary: "#00d2ff", blueDark: "#003e4d", redPrimary: "#ff2a2a", redDark: "#4d0000", scoreBlue: "#00d2ff", scoreRed: "#ff2a2a", upperBg: "#000000", lowerBg: "#0a0a0a", lowerMidBg: "#111111", heroPickBg: "#1e1e1e", logoTeamBg: "#000000", postDraftBg: "#1a1a1a", playerNameBg: "#000000", laneLogoBg: "rgba(0,0,0,0.8)", timerBlue: "#00d2ff", timerMid: "#ffffff", timerRed: "#ff2a2a", playerName: "#ffffff", phaseText: "#ffffff", laneIconType: "white", laneLogoBorder: "#ffffff", auraBan: "#ff0000", auraPick: "#ffffff", globalBorder: "rgba(255, 255, 255, 0.2)" },
  gradients: { upperBg: { enabled: false }, lowerBg: { enabled: false }, lowerMidBg: { enabled: false }, heroPickBg: { enabled: false }, logoTeamBg: { enabled: false }, sbBgTeamName: { enabled: false }, sbBgLogo: { enabled: false }, sbBgScore: { enabled: false }, sbBgCombined: { enabled: false }, sbBgBox1: { enabled: false }, sbBgSecondary: { enabled: false } },
  scoreboard: { teamNameBlue: "#00d2ff", teamNameRed: "#ff2a2a", activeFlag: "indonesia.png", disableGlow: false, disableShadow: false },
  opacity: { upper: 100, lower: 100, heroPick: 100, logoTeam: 60, postDraft: 100 },
  toggles: { hideLaneLogo: false, disableGlow: false, hidePattern: false, hidePostDraftBg: false, disableBoxShadow: false },
  animations: { banType: "pulse", pickType: "pulse", heroAnim: "fade" }
};

const defaultDraftData = {
  draftdata: {
    timer: "60", timer_running: false, current_phase: 0,
    blueside: { ban: [{},{},{},{},{}], pick: [{},{},{},{},{}] },
    redside: { ban: [{},{},{},{},{}], pick: [{},{},{},{},{}] }
  }
};

// Initialize database files
[matchDataPath, draftDataPath, prevDraftPath, mapDrawPath, mvpDataPath, schedulePath, notifPath].forEach(p => {
  if (!fsSync.existsSync(p)) fsSync.writeFileSync(p, JSON.stringify(p === matchDataPath ? defaultMatchData : p === draftDataPath ? defaultDraftData : p === mapDrawPath ? { drawdata: { status: 'idle' } } : p === mvpDataPath ? { mvp: null } : {}, null, 2));
});
if (!fsSync.existsSync(itemsPath)) fsSync.writeFileSync(itemsPath, JSON.stringify(["winter_truncheon", "immortality", "athena_shield", "blade_armor", "antique_cuirass", "oracle", "radiant_armor", "twilight_armor", "guardian_helmet", "sky_guardian_helmet", "thunder_belt", "cursed_helmet"], null, 2));
if (!fsSync.existsSync(path.join(themeDir, 'theme.json'))) fsSync.writeFileSync(path.join(themeDir, 'theme.json'), JSON.stringify(defaultTheme, null, 2));

// ==========================================
// 5. IN-MEMORY CACHE
// ==========================================
let cache = {
  matchdata: defaultMatchData,
  matchdraft: defaultDraftData,
  theme: defaultTheme,
  mapdraw: { drawdata: { status: 'idle' } },
  mvp: { mvp: null },
  schedule: {}
};

async function loadCache() {
  try { cache.matchdata = JSON.parse(await fs.readFile(matchDataPath, 'utf8')); } catch(e) {}
  try { cache.matchdraft = JSON.parse(await fs.readFile(draftDataPath, 'utf8')); } catch(e) {}
  try { cache.theme = JSON.parse(await fs.readFile(path.join(themeDir, 'theme.json'), 'utf8')); } catch(e) {}
  try { cache.mapdraw = JSON.parse(await fs.readFile(mapDrawPath, 'utf8')); } catch(e) {}
  try { cache.mvp = JSON.parse(await fs.readFile(mvpDataPath, 'utf8')); } catch(e) {}
  try { cache.schedule = JSON.parse(await fs.readFile(schedulePath, 'utf8')); } catch(e) {}
  console.log('>> In-Memory Cache Loaded!');
}
loadCache();

// ==========================================
// 6. HELPER FUNCTIONS
// ==========================================
function getLocalIp() {
  const nets = os.networkInterfaces();
  let candidateIp = 'localhost';
  const exclude = ['virtual', 'vmware', 'vbox', 'wsl', 'hyper', 'docker', 'vpn', 'zerotier'];
  for (const name of Object.keys(nets)) {
    if (!exclude.some(k => name.toLowerCase().includes(k))) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('ethernet')) return net.address;
          candidateIp = net.address;
        }
      }
    }
  }
  return candidateIp;
}

// ==========================================
// 7. SOCKET.IO HANDLERS
// ==========================================
io.on('connection', socket => {
  console.log('Client connected:', socket.id);
  
  socket.on('update', msg => {
    socket.broadcast.emit('update', msg);
  });
});

// ==========================================
// 8. API ROUTES
// ==========================================

// Match Data
app.get('/api/matchdata', (req, res) => res.json(cache.matchdata));
app.post('/api/matchdata', (req, res) => {
  try {
    cache.matchdata = req.body;
    io.emit('matchdata_update', cache.matchdata);
    io.emit('update', { matchdata: cache.matchdata });
    fileQueue.enqueue(() => fs.writeFile(matchDataPath, JSON.stringify(cache.matchdata, null, 2)));
    res.json({ message: 'Match data saved' });
  } catch (error) { res.status(500).json({ message: 'Error saving match data' }); }
});

// Match Draft
app.get('/api/matchdraft', (req, res) => res.json(cache.matchdraft));
app.post('/api/matchdraft', (req, res) => {
  try {
    cache.matchdraft = req.body;
    io.emit('draftdata_update', cache.matchdraft.draftdata);
    fileQueue.enqueue(() => fs.writeFile(draftDataPath, JSON.stringify(cache.matchdraft, null, 2)));
    res.json({ message: 'Draft data saved' });
  } catch (error) { res.status(500).json({ message: 'Error saving draft' }); }
});

// Theme
app.get('/api/theme', (req, res) => res.json(cache.theme));
app.post('/api/theme', (req, res) => {
  try {
    cache.theme = req.body;
    io.emit('theme_update', cache.theme);
    fileQueue.enqueue(() => fs.writeFile(path.join(themeDir, 'theme.json'), JSON.stringify(cache.theme, null, 2)));
    res.json({ message: 'Theme saved' });
  } catch (error) { res.status(500).json({ message: 'Error saving theme' }); }
});

app.post('/api/theme-reset', (req, res) => {
  cache.theme = defaultTheme;
  io.emit('theme_update', cache.theme);
  fileQueue.enqueue(() => fs.writeFile(path.join(themeDir, 'theme.json'), JSON.stringify(defaultTheme, null, 2)));
  res.json({ message: 'Theme Reset to Default', theme: cache.theme });
});

// Upload Asset (local)
app.post('/api/upload-asset', multers.theme.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const targetField = req.body.targetField;
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!cache.theme.images) cache.theme.images = {};
    
    if (targetField === 'font' && (ext === '.ttf' || ext === '.otf')) {
      cache.theme.fontFile = req.file.originalname;
      cache.theme.useCustomFont = true;
    } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      if (targetField === 'heroPickBg') cache.theme.images.heroPickBg = req.file.originalname;
      else if (targetField === 'lowerBg') cache.theme.images.lowerBg = req.file.originalname;
      else if (targetField === 'lowerMidBg') cache.theme.images.lowerMidBg = req.file.originalname;
    }
    io.emit('theme_update', cache.theme);
    fileQueue.enqueue(() => fs.writeFile(path.join(themeDir, 'theme.json'), JSON.stringify(cache.theme, null, 2)));
    res.json({ message: 'Asset uploaded successfully', filename: req.file.originalname });
  } catch (error) { res.status(500).json({ message: 'Error updating theme' }); }
});

// Upload to Cloudinary (for team logos, etc)
app.post('/api/upload-cloudinary', multers.upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  if (!cloudinary) return res.status(500).json({ message: 'Cloudinary not configured' });
  try {
    const result = await cloudinary.uploader.upload(req.file.path, { folder: 'm-overlay' });
    fsSync.unlinkSync(req.file.path); // Delete local after upload
    res.json({ message: 'Uploaded to Cloudinary', url: result.secure_url, public_id: result.public_id });
  } catch (error) {
    console.error('Cloudinary error:', error);
    res.status(500).json({ message: 'Error uploading to Cloudinary' });
  }
});

// Flags
app.get('/api/flags', async (req, res) => {
  try {
    const files = await fs.readdir(flagDir);
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    fileQueue.enqueue(() => fs.writeFile(flagJsonPath, JSON.stringify(imageFiles, null, 2)));
    res.json(imageFiles);
  } catch (error) { res.json([]); }
});

app.post('/api/upload-flag', multers.flag.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const files = await fs.readdir(flagDir);
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    res.json({ message: 'Flag uploaded', filename: req.file.originalname, list: imageFiles });
  } catch (error) { res.status(500).json({ message: 'Error uploading flag' }); }
});

// Schedule
app.get('/api/schedule', (req, res) => res.json(cache.schedule));
app.post('/api/schedule', (req, res) => {
  try {
    cache.schedule = req.body;
    io.emit('schedule_update', cache.schedule);
    fileQueue.enqueue(() => fs.writeFile(schedulePath, JSON.stringify(cache.schedule, null, 2)));
    res.json({ message: 'Schedule saved' });
  } catch (error) { res.status(500).json({ message: 'Error saving schedule' }); }
});

// Map Draw
app.get('/api/mapdraw', (req, res) => res.json(cache.mapdraw));
app.post('/api/mapdraw', (req, res) => {
  try {
    cache.mapdraw = req.body;
    io.emit('mapdraw_update', cache.mapdraw.drawdata);
    fileQueue.enqueue(() => fs.writeFile(mapDrawPath, JSON.stringify(cache.mapdraw, null, 2)));
    res.json({ message: 'Map saved' });
  } catch (error) { res.status(500).json({ message: 'Error saving map' }); }
});

// MVP
app.get('/api/mvp', (req, res) => res.json(cache.mvp));
app.post('/api/mvp', (req, res) => {
  try {
    cache.mvp = req.body;
    io.emit('mvp_update', cache.mvp.mvp);
    fileQueue.enqueue(() => fs.writeFile(mvpDataPath, JSON.stringify(cache.mvp, null, 2)));
    res.json({ message: 'MVP saved' });
  } catch (error) { res.status(500).json({ message: 'Error saving MVP' }); }
});

// Previous Draft
app.get('/api/previousdraft', async (req, res) => {
  try {
    const data = await fs.readFile(prevDraftPath, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) { res.status(500).json({ message: 'Error reading prev draft' }); }
});

app.post('/api/archive-draft', (req, res) => {
  fileQueue.enqueue(() => fs.writeFile(prevDraftPath, JSON.stringify(cache.matchdraft, null, 2)));
  io.emit('analyzer_update');
  res.json({ message: 'Draft archived' });
});

// Save Match Record
app.post('/api/save-match-record', async (req, res) => {
  try {
    fileQueue.enqueue(async () => {
      if (!fsSync.existsSync(savedMatchDir)) await fs.mkdir(savedMatchDir, { recursive: true });
      for (let i = 6; i >= 1; i--) {
        const currentFile = path.join(savedMatchDir, `matchdata${i}.json`);
        const nextFile = path.join(savedMatchDir, `matchdata${i + 1}.json`);
        try { await fs.access(currentFile); await fs.rename(currentFile, nextFile); } catch (err) {}
      }
      await fs.writeFile(path.join(savedMatchDir, 'matchdata1.json'), JSON.stringify(cache.matchdata, null, 2));
    });
    res.json({ message: 'Match archived' });
  } catch (error) { res.status(500).json({ message: 'Error archiving match' }); }
});

app.post('/api/analyzer-control', (req, res) => {
  io.emit('analyzer_control', req.body.action);
  res.json({ message: 'Analyzer command sent' });
});

// ==========================================
// HERO LIST WITH CLOUDINARY URLS
// ==========================================
app.get('/api/herolist', async (req, res) => {
  try {
    const herolistPath = path.join(dbDir, 'herolist.json');
    let heroList = JSON.parse(await fs.readFile(herolistPath, 'utf8'));
    
    // Replace local paths with Cloudinary URLs if configured
    if (HERO_BASE_URL) {
      heroList = heroList.map(hero => ({
        ...hero,
        img: hero.img.replace('/Assets/HeroPick/', HERO_BASE_URL),
        voice: hero.voice ? hero.voice.replace('/Assets/Voicelines/', VOICE_BASE_URL) : null
      }));
    }
    
    res.json(heroList);
  } catch (error) {
    res.status(500).json({ message: 'Error loading hero list' });
  }
});

// Add new hero to herolist
app.post('/api/herolist', async (req, res) => {
  try {
    const herolistPath = path.join(dbDir, 'herolist.json');
    let heroList = JSON.parse(await fs.readFile(herolistPath, 'utf8'));
    
    const newHero = req.body;
    if (!newHero.name || !newHero.img) {
      return res.status(400).json({ message: 'Hero name and img are required' });
    }
    
    // Check if hero already exists
    if (heroList.find(h => h.name.toLowerCase() === newHero.name.toLowerCase())) {
      return res.status(400).json({ message: 'Hero already exists' });
    }
    
    // Use Cloudinary URLs if configured
    const heroImg = HERO_BASE_URL 
      ? newHero.img.replace('/Assets/HeroPick/', HERO_BASE_URL)
      : '/Assets/HeroPick/' + newHero.img;
    const heroVoice = newHero.voice ? (VOICE_BASE_URL 
      ? newHero.voice.replace('/Assets/Voicelines/', VOICE_BASE_URL)
      : '/Assets/Voicelines/' + newHero.voice) : '';
    
    heroList.push({
      name: newHero.name,
      img: heroImg,
      voice: heroVoice
    });
    
    // Sort alphabetically
    heroList.sort((a, b) => a.name.localeCompare(b.name));
    
    await fs.writeFile(herolistPath, JSON.stringify(heroList, null, 2));
    cache.herolist = heroList;
    
    res.json({ message: 'Hero added successfully', herolist: heroList });
  } catch (error) {
    res.status(500).json({ message: 'Error adding hero' });
  }
});

// ==========================================
// 9. START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('M-OVERLAY SERVER running on port ' + PORT);
});