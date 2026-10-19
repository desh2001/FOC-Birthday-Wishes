import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import schedule from 'node-schedule';
import crypto from 'crypto';

// Setup directories for scheduled tasks and persistent data
const BOT_DATA_DIR = process.env.BOT_DATA_DIR;

const CARDS_DIR = BOT_DATA_DIR ? path.join(BOT_DATA_DIR, 'scheduled-cards') : path.resolve('scheduled-cards');
const DATA_FILE = BOT_DATA_DIR ? path.join(BOT_DATA_DIR, 'scheduled-cards.json') : path.resolve('scheduled-cards.json');
const PUBLIC_IMG_DIR = BOT_DATA_DIR ? path.join(BOT_DATA_DIR, 'img') : path.resolve('public', 'img');
const STUDENTS_FILE = BOT_DATA_DIR ? path.join(BOT_DATA_DIR, 'students.json') : path.resolve('students.json');
const AUTH_DIR = BOT_DATA_DIR ? path.join(BOT_DATA_DIR, '.wwebjs_auth') : undefined;

// Ensure persistent directories exist
if (!fs.existsSync(CARDS_DIR)) {
    fs.mkdirSync(CARDS_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_IMG_DIR)) {
    fs.mkdirSync(PUBLIC_IMG_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}
if (AUTH_DIR && !fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Copy seed images from bundled public/img into persistent PUBLIC_IMG_DIR if running with volume
const SEED_IMG_DIR = path.resolve('public', 'img');
if (fs.existsSync(SEED_IMG_DIR) && fs.existsSync(PUBLIC_IMG_DIR) && path.resolve(SEED_IMG_DIR) !== path.resolve(PUBLIC_IMG_DIR)) {
    try {
        const seedFiles = fs.readdirSync(SEED_IMG_DIR);
        for (const file of seedFiles) {
            const destPath = path.join(PUBLIC_IMG_DIR, file);
            if (!fs.existsSync(destPath)) {
                fs.copyFileSync(path.join(SEED_IMG_DIR, file), destPath);
            }
        }
        console.log(`📸 Initialized local images in persistent storage.`);
    } catch (e) {
        console.warn(`Could not seed images to persistent volume:`, e.message);
    }
}

// Initialize students file with seed data if it does not exist
function getStudents() {
    try {
        if (!fs.existsSync(STUDENTS_FILE)) {
            const seedPath = path.resolve('parsed_birthdays.json');
            if (fs.existsSync(seedPath)) {
                const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
                const initialized = seedData.map((s, idx) => ({
                    id: s.id || `s-${idx + 1}-${crypto.randomBytes(4).toString('hex')}`,
                    ...s
                }));
                fs.writeFileSync(STUDENTS_FILE, JSON.stringify(initialized, null, 2));
                return initialized;
            }
            fs.writeFileSync(STUDENTS_FILE, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(STUDENTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error reading students file:', e);
        return [];
    }
}

function saveStudents(students) {
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(students, null, 2));
}

// Ensure students are loaded and initialized on startup
getStudents();

// Admin Authentication Setup
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ? process.env.ADMIN_API_KEY.trim() : '';

function checkAdminAuth(req) {
    if (!ADMIN_API_KEY) return true; // Open access if no ADMIN_API_KEY is configured
    const keyFromHeader = req.headers['x-admin-key'];
    const authHeader = req.headers['authorization'];
    const bearerKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const queryKey = req.query.key;
    return (
        keyFromHeader === ADMIN_API_KEY ||
        bearerKey === ADMIN_API_KEY ||
        queryKey === ADMIN_API_KEY
    );
}

const requireAdmin = (req, res, next) => {
    if (!checkAdminAuth(req)) {
        return res.status(401).json({ 
            success: false, 
            message: 'Unauthorized: Valid Admin API Key required. Pass header x-admin-key or ?key=' 
        });
    }
    next();
};

// Configure express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' })); // For base64 image payloads

// Multer upload config with file limits and MIME type validation
const upload = multer({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB maximum
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
        }
    }
});

// Serve scheduled cards static images and public images
app.use('/scheduled-cards-images', express.static(CARDS_DIR)); 
app.use('/img', express.static(PUBLIC_IMG_DIR)); 

let isClientReady = false;
let latestQr = null;
let botStatusMessage = 'Launching Chromium browser and loading WhatsApp Web...';
let client = null;
let isStarting = false;

// Remove Chromium process singleton locks that cause "profile appears to be in use" errors after restarts
function cleanChromiumLocks(dirPath) {
    if (!dirPath || !fs.existsSync(dirPath)) return;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.name.startsWith('Singleton') || entry.name === 'DevToolsActivePort') {
                try {
                    fs.unlinkSync(fullPath);
                    console.log(`🔓 Removed stale Chromium lock file: ${fullPath}`);
                } catch (e) {
                    console.warn(`Could not remove ${fullPath}:`, e.message);
                }
            } else if (entry.isDirectory()) {
                cleanChromiumLocks(fullPath);
            }
        }
    } catch (err) {
        console.warn('Error cleaning Chromium locks:', err.message);
    }
}

function createClient() {
    const localCachePath = path.resolve('.wwebjs_cache');
    const hasLocalVersion = fs.existsSync(path.join(localCachePath, '2.3000.1050789799-alpha.html'));

    const webVersionCacheConfig = hasLocalVersion
        ? {
            type: 'local',
            path: localCachePath,
            strict: false
        }
        : {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
            strict: false
        };

    console.log(`📦 WhatsApp Web Cache Config: ${webVersionCacheConfig.type} (Local: ${hasLocalVersion})`);

    const newClient = new Client({
        authStrategy: new LocalAuth(AUTH_DIR ? { dataPath: AUTH_DIR } : {}),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        webVersion: '2.3000.1050789799-alpha',
        webVersionCache: webVersionCacheConfig,
        authTimeoutMs: 120000,
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-software-rasterizer',
                '--headless=new'
            ]
        }
    });

    newClient.on('qr', (qr) => {
        latestQr = qr;
        botStatusMessage = 'QR code generated! Scan with your WhatsApp app.';
        console.log('SCAN THIS QR CODE TO LOG IN:');
        qrcode.generate(qr, { small: true });
    });

    newClient.on('ready', () => {
        console.log('✅ WhatsApp Bot is Ready and Logged In!');
        isClientReady = true;
        botStatusMessage = 'WhatsApp is connected and logged in!';
        loadScheduledJobs();
    });

    newClient.on('authenticated', () => {
        latestQr = null;
        botStatusMessage = 'WhatsApp authenticated successfully!';
        console.log('WhatsApp authenticated successfully!');
    });

    newClient.on('loading_screen', (percent, message) => {
        botStatusMessage = `Loading WhatsApp Web: ${percent}% - ${message}`;
        console.log(`⏳ ${botStatusMessage}`);
    });

    newClient.on('change_state', (state) => {
        botStatusMessage = `WhatsApp state changed: ${state}`;
        console.log(`🔄 ${botStatusMessage}`);
    });

    newClient.on('auth_failure', (msg) => {
        botStatusMessage = `Authentication failure: ${msg}`;
        console.error('WhatsApp authentication failure:', msg);
    });

    newClient.on('disconnected', (reason) => {
        botStatusMessage = `WhatsApp disconnected: ${reason}`;
        console.warn(`⚠️ ${botStatusMessage}`);
        isClientReady = false;
        latestQr = null;
        startWhatsAppClient(10000);
    });

    return newClient;
}

async function startWhatsAppClient(delayMs = 0) {
    if (isStarting) return;
    isStarting = true;

    if (delayMs > 0) {
        console.log(`⏳ Waiting ${delayMs / 1000}s before WhatsApp client launch...`);
        await new Promise(r => setTimeout(r, delayMs));
    }

    if (client) {
        try {
            console.log('🛑 Cleaning up previous WhatsApp client...');
            await client.destroy();
        } catch (e) {
            console.warn('Note on client cleanup:', e.message);
        }
    }

    // Always clear stale lockfiles created by killed or previous containers
    if (AUTH_DIR) {
        cleanChromiumLocks(AUTH_DIR);
    }

    botStatusMessage = 'Launching Chromium browser and loading WhatsApp Web...';
    console.log('🔄 Initializing WhatsApp client...');
    client = createClient();

    try {
        await client.initialize();
        isStarting = false;
    } catch (err) {
        isStarting = false;
        const errMsg = err?.message || String(err);
        console.error('❌ WhatsApp client initialization error:', errMsg);
        botStatusMessage = `Initialization error (${errMsg}). Retrying in 15 seconds...`;
        startWhatsAppClient(15000);
    }
}

// ── Health Check Endpoint ───────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        whatsappReady: isClientReady,
        botStatus: botStatusMessage,
        hasQr: !!latestQr,
        timestamp: new Date().toISOString()
    });
});

// ── QR Code Web Endpoint (Protected) ─────────────────────────────────────────
app.get('/qr', async (req, res) => {
    if (ADMIN_API_KEY && !checkAdminAuth(req)) {
        return res.status(401).send(`<!DOCTYPE html>
<html>
<head>
  <title>Admin Authentication Required</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px; width: 100%; max-width: 380px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); text-align: center; }
    h2 { margin-top: 0; color: #38bdf8; font-size: 1.5rem; }
    p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 24px; }
    input { width: 100%; box-sizing: border-box; padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(15, 23, 42, 0.6); color: #fff; font-size: 1rem; margin-bottom: 16px; }
    button { width: 100%; padding: 12px; border-radius: 8px; border: none; background: #0284c7; color: #fff; font-weight: 600; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #0369a1; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🔒 Admin Verification</h2>
    <p>Please enter your Admin API Key to view and connect the WhatsApp QR code.</p>
    <form method="GET" action="/qr">
      <input type="password" name="key" placeholder="Enter Admin API Key" required autofocus />
      <button type="submit">Unlock WhatsApp QR</button>
    </form>
  </div>
</body>
</html>`);
    }

    if (req.query.unlock === '1' || req.query.reset === '1') {
        console.log(`🔄 User requested WhatsApp action: ${req.query.reset === '1' ? 'RESET' : 'UNLOCK'}`);
        if (AUTH_DIR) {
            cleanChromiumLocks(AUTH_DIR);
            if (req.query.reset === '1') {
                try {
                    const sessionPath = path.join(AUTH_DIR, 'session');
                    if (fs.existsSync(sessionPath)) {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                        console.log('🗑️ Removed session folder on user request.');
                    }
                } catch (e) {
                    console.warn('Could not reset session folder:', e.message);
                }
            }
        }
        startWhatsAppClient(500);
        const queryKey = req.query.key ? `?key=${encodeURIComponent(req.query.key)}` : '';
        return res.redirect(`/qr${queryKey}`);
    }

    if (isClientReady) {
        return res.send(`<!DOCTYPE html>
<html>
<head><title>WhatsApp Connected</title><style>body{background:#0f172a;color:#10b981;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;}</style></head>
<body>
  <h1>✅ WhatsApp is Connected!</h1>
  <p style="color:#94a3b8">The bot is running and ready to send messages.</p>
</body>
</html>`);
    }
    if (!latestQr) {
        const queryKey = req.query.key ? `?key=${encodeURIComponent(req.query.key)}` : '';
        return res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Initializing WhatsApp</title>
  <meta http-equiv="refresh" content="4;url=/qr${queryKey}">
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
    .card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px; max-width: 460px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    h2 { margin-top: 0; color: #38bdf8; font-size: 1.4rem; }
    .status { background: rgba(15, 23, 42, 0.7); padding: 12px 16px; border-radius: 8px; border-left: 4px solid #38bdf8; font-family: monospace; font-size: 0.85rem; margin: 16px 0; color: #e2e8f0; word-break: break-word; text-align: left; }
    p { color: #94a3b8; font-size: 0.85rem; margin: 8px 0; }
    .spinner { border: 3px solid rgba(255, 255, 255, 0.1); border-top: 3px solid #38bdf8; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; margin: 16px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn { display: inline-block; padding: 8px 16px; background: #0284c7; color: #fff; text-decoration: none; border-radius: 8px; font-size: 0.85rem; font-weight: 500; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>⏳ Initializing WhatsApp...</h2>
    <div class="status">${botStatusMessage}</div>
    <p>Chromium is connecting to WhatsApp Web. The QR code will appear here automatically.</p>
    <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
      <a href="/qr${queryKey}" class="btn">Refresh Now</a>
      <a href="/qr${queryKey ? queryKey + '&' : '?'}unlock=1" class="btn" style="background:#059669;">Unlock Browser</a>
      <a href="/qr${queryKey ? queryKey + '&' : '?'}reset=1" class="btn" style="background:#dc2626;" onclick="return confirm('Are you sure you want to reset the WhatsApp session?');">Reset Session</a>
    </div>
  </div>
</body>
</html>`);
    }
    try {
        const qrDataUrl = await QRCode.toDataURL(latestQr);
        const queryKey = req.query.key ? `?key=${encodeURIComponent(req.query.key)}` : '';
        res.send(`<!DOCTYPE html>
<html>
<head>
  <title>WhatsApp QR Login</title>
  <meta http-equiv="refresh" content="15;url=/qr${queryKey}">
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 32px; display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    h2 { margin: 0 0 16px 0; color: #38bdf8; font-size: 1.5rem; }
    img { border-radius: 16px; background: #fff; padding: 16px; width: 280px; height: 280px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); }
    p { color: #94a3b8; font-size: 0.9rem; margin-top: 16px; margin-bottom: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>📱 Link WhatsApp Device</h2>
    <img src="${qrDataUrl}" alt="WhatsApp QR Code" />
    <p>Open WhatsApp on your phone &gt; Linked Devices &gt; Link a Device</p>
    <p style="opacity: 0.6; font-size: 0.8rem; margin-top: 8px;">Auto-refreshes every 15 seconds</p>
  </div>
</body>
</html>`);
    } catch (e) {
        res.status(500).send('Error generating QR: ' + e.message);
    }
});

// Scheduled jobs persistence helpers

function saveScheduledJobs(jobs) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(jobs, null, 2));
}

function getScheduledJobs() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function sendScheduledMessage(jobData) {
    try {
        console.log(`Executing scheduled job for ${jobData.targetGroup}...`);
        if (!fs.existsSync(jobData.filePath)) {
            console.error(`File missing for scheduled job: ${jobData.filePath}`);
            return;
        }

        const chats = await client.getChats();
        const groupChat = chats.find(chat => chat.isGroup && chat.name === jobData.targetGroup);

        if (groupChat) {
            const media = MessageMedia.fromFilePath(jobData.filePath);
            await client.sendMessage(groupChat.id._serialized, media, { caption: jobData.caption });
            console.log(`✅ Scheduled card successfully sent to group: ${jobData.targetGroup}`);
        } else {
            console.error(`❌ Could not find group "${jobData.targetGroup}" to send scheduled message.`);
        }
    } catch (error) {
        console.error('❌ Error sending scheduled message:', error);
    } finally {
        // Clean up image file safely
        if (jobData.filePath && fs.existsSync(jobData.filePath)) {
            const resolvedPath = path.resolve(jobData.filePath);
            if (resolvedPath.startsWith(path.resolve(CARDS_DIR))) {
                fs.unlinkSync(resolvedPath);
            }
        }
        const jobs = getScheduledJobs();
        const updatedJobs = jobs.filter(j => j.id !== jobData.id);
        saveScheduledJobs(updatedJobs);
    }
}

function loadScheduledJobs() {
    const jobs = getScheduledJobs();
    let loaded = 0;
    const now = new Date();

    for (const jobData of jobs) {
        const scheduleTime = new Date(jobData.scheduledTime);
        if (scheduleTime <= now) {
            sendScheduledMessage(jobData);
        } else {
            schedule.scheduleJob(jobData.id, scheduleTime, () => {
                sendScheduledMessage(jobData);
            });
            loaded++;
        }
    }
    if (loaded > 0) {
        console.log(`📅 Loaded ${loaded} scheduled birthday cards.`);
    }
}

// ── Students Persistence API ─────────────────────────────────────────────────
app.get('/students', (req, res) => {
    const students = getStudents();
    res.status(200).json(students);
});

app.post('/students', (req, res) => {
    try {
        const { name, featured_name, birthday, whatsapp, course, gender, photo_url, local_photo_path } = req.body;
        if (!name || !featured_name || !birthday || !whatsapp) {
            return res.status(400).json({ success: false, message: 'Missing required student fields.' });
        }

        const students = getStudents();
        const newStudent = {
            id: `s-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            timestamp: new Date().toLocaleString('en-GB'),
            name: String(name).trim().slice(0, 150),
            featured_name: String(featured_name).trim().slice(0, 100),
            birthday: String(birthday).trim().slice(0, 20),
            whatsapp: String(whatsapp).trim().slice(0, 25),
            course: String(course || 'SE').trim().slice(0, 20),
            gender: String(gender || 'Male').trim().slice(0, 20),
            photo_url: photo_url ? String(photo_url).trim() : '',
            local_photo_path: local_photo_path ? String(local_photo_path).trim() : ''
        };

        students.push(newStudent);
        saveStudents(students);
        console.log(`👤 Added student: ${newStudent.featured_name}`);
        res.status(201).json({ success: true, student: newStudent });
    } catch (err) {
        console.error('Error adding student:', err);
        res.status(500).json({ success: false, message: 'Failed to add student: ' + err.message });
    }
});

app.put('/students/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const students = getStudents();
        const index = students.findIndex(s => s.id === id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        const allowed = ['name', 'featured_name', 'birthday', 'whatsapp', 'course', 'gender', 'photo_url', 'local_photo_path'];
        for (const key of allowed) {
            if (updates[key] !== undefined) {
                students[index][key] = updates[key];
            }
        }

        saveStudents(students);
        console.log(`🔄 Updated student: ${students[index].featured_name} (${id})`);
        res.status(200).json({ success: true, student: students[index] });
    } catch (err) {
        console.error('Error updating student:', err);
        res.status(500).json({ success: false, message: 'Failed to update student: ' + err.message });
    }
});

app.delete('/students/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        let students = getStudents();
        const initialLen = students.length;
        students = students.filter(s => s.id !== id);

        if (students.length === initialLen) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        saveStudents(students);
        console.log(`🗑️ Deleted student ID: ${id}`);
        res.status(200).json({ success: true, message: 'Student deleted successfully.' });
    } catch (err) {
        console.error('Error deleting student:', err);
        res.status(500).json({ success: false, message: 'Failed to delete student: ' + err.message });
    }
});

// ── WhatsApp Messaging API (Protected by requireAdmin) ───────────────────────
app.post('/send-to-group', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        if (!isClientReady) {
            return res.status(503).json({ success: false, message: 'WhatsApp bot is not ready yet. Please wait or scan QR.' });
        }

        const { caption, targetGroup } = req.body;
        const file = req.file;

        if (!caption || !targetGroup || !file) {
            return res.status(400).json({ success: false, message: 'Missing caption, targetGroup, or image file.' });
        }

        const chats = await client.getChats();
        const groupChat = chats.find(chat => chat.isGroup && chat.name === targetGroup);

        if (!groupChat) {
            return res.status(404).json({ success: false, message: `Could not find a group named "${targetGroup}". Please check the name exactly.` });
        }

        const base64Image = file.buffer.toString('base64');
        const media = new MessageMedia(file.mimetype, base64Image, 'birthday_card.png');

        await client.sendMessage(groupChat.id._serialized, media, { caption: caption });
        
        console.log(`✅ Successfully sent card to group: ${targetGroup}`);
        res.status(200).json({ success: true, message: 'Message sent successfully!' });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: 'Failed to send message: ' + error.message });
    }
});

app.post('/schedule-card', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const { caption, targetGroup, scheduledTime } = req.body;
        const file = req.file;

        if (!caption || !targetGroup || !scheduledTime || !file) {
            return res.status(400).json({ success: false, message: 'Missing parameters or image file.' });
        }

        const scheduleDate = new Date(scheduledTime);
        if (isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
             return res.status(400).json({ success: false, message: 'Invalid or past scheduled time.' });
        }

        // Save image to disk with strict random UUID filename
        const id = crypto.randomUUID();
        const filePath = path.join(CARDS_DIR, `${id}.png`);
        fs.writeFileSync(filePath, file.buffer);

        const jobData = {
            id,
            caption: String(caption).slice(0, 1000),
            targetGroup: String(targetGroup).slice(0, 100),
            scheduledTime: scheduleDate.toISOString(),
            filePath
        };

        const jobs = getScheduledJobs();
        jobs.push(jobData);
        saveScheduledJobs(jobs);

        if (isClientReady) {
            schedule.scheduleJob(id, scheduleDate, () => {
                sendScheduledMessage(jobData);
            });
        }

        console.log(`📅 Scheduled card for ${targetGroup} at ${scheduleDate.toLocaleString()}`);
        res.status(200).json({ success: true, message: `Card successfully scheduled for ${scheduleDate.toLocaleString()}` });

    } catch (error) {
        console.error('Error scheduling message:', error);
        res.status(500).json({ success: false, message: 'Failed to schedule message: ' + error.message });
    }
});

// View scheduled cards - returns relative image URLs
app.get('/scheduled-cards', (req, res) => {
    try {
        const jobs = getScheduledJobs();
        const mappedJobs = jobs.map(job => ({
            id: job.id,
            caption: job.caption,
            targetGroup: job.targetGroup,
            scheduledTime: job.scheduledTime,
            imageUrl: `/scheduled-cards-images/${path.basename(job.filePath)}`
        }));
        
        mappedJobs.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
        res.status(200).json({ success: true, jobs: mappedJobs });
    } catch (error) {
        console.error('Error fetching scheduled messages:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch scheduled messages' });
    }
});

// Cancel a scheduled card (Protected by requireAdmin)
app.delete('/scheduled-cards/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const jobs = getScheduledJobs();
        
        const jobIndex = jobs.findIndex(j => j.id === id);
        if (jobIndex === -1) {
            return res.status(404).json({ success: false, message: 'Scheduled task not found' });
        }
        
        const jobData = jobs[jobIndex];
        
        const currentJob = schedule.scheduledJobs[id];
        if (currentJob) {
            currentJob.cancel();
        }
        
        if (jobData.filePath && fs.existsSync(jobData.filePath)) {
            const resolved = path.resolve(jobData.filePath);
            if (resolved.startsWith(path.resolve(CARDS_DIR))) {
                fs.unlinkSync(resolved);
            }
        }
        
        jobs.splice(jobIndex, 1);
        saveScheduledJobs(jobs);
        
        console.log(`🗑️ Canceled scheduled card for ${jobData.targetGroup}`);
        res.status(200).json({ success: true, message: 'Scheduled card canceled successfully' });
    } catch (error) {
        console.error('Error canceling scheduled message:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel scheduled message: ' + error.message });
    }
});

// ── Save Profile Image (Protected against path traversal & payload abuse) ───
app.post('/save-image', (req, res) => {
    try {
        const { base64, name, featured_name } = req.body;

        if (!base64 || !name || !featured_name) {
            return res.status(400).json({ success: false, message: 'Missing base64, name, or featured_name.' });
        }

        if (typeof base64 !== 'string' || base64.length > 15 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: 'Invalid image format or image too large.' });
        }

        // Strict filename sanitization to eliminate path traversal vulnerabilities
        const sanitize = (str) => path.basename(str).replace(/[^\w\s.-]/gi, '').trim();
        const safeFeatured = sanitize(featured_name);
        const safeName = sanitize(name);

        if (!safeFeatured || !safeName) {
            return res.status(400).json({ success: false, message: 'Invalid student name for image filename.' });
        }

        const fileName = `${safeFeatured} - ${safeName}.jpeg`;
        const filePath = path.join(PUBLIC_IMG_DIR, fileName);

        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(PUBLIC_IMG_DIR))) {
            return res.status(403).json({ success: false, message: 'Forbidden: Invalid file path.' });
        }

        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        fs.writeFileSync(resolvedPath, imageBuffer);

        const localPath = `/img/${fileName}`;
        console.log(`📸 Saved local image: ${resolvedPath}`);
        res.status(200).json({ success: true, localPath });

    } catch (error) {
        console.error('Error saving image locally:', error);
        res.status(500).json({ success: false, message: 'Failed to save image: ' + error.message });
    }
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    console.log(`Received ${signal}. Shutting down bot gracefully...`);
    try {
        if (client) {
            await client.destroy();
            console.log('WhatsApp client destroyed.');
        }
    } catch (err) {
        console.error('Error destroying WhatsApp client:', err);
    }
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Express API running on http://0.0.0.0:${PORT}`);
    console.log(`Starting WhatsApp client...`);
    startWhatsAppClient();
});
