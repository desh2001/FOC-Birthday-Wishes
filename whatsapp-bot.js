import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import schedule from 'node-schedule';
import crypto from 'crypto';

// Setup directories for scheduled tasks
const CARDS_DIR = path.resolve('scheduled-cards');
const DATA_FILE = path.resolve('scheduled-cards.json');

if (!fs.existsSync(CARDS_DIR)) {
    fs.mkdirSync(CARDS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Configure express app
const app = express();
app.use(cors());
// Multer for handling multipart/form-data (file uploads)
const upload = multer(); 

// Serve scheduled cards static images
app.use('/scheduled-cards-images', express.static(CARDS_DIR)); 

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

let isClientReady = false;

// WhatsApp event listeners
client.on('qr', (qr) => {
    // Print QR code to terminal
    console.log('SCAN THIS QR CODE TO LOG IN:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot is Ready and Logged In!');
    isClientReady = true;
    loadScheduledJobs();
});

client.on('authenticated', () => {
    console.log('WhatsApp authenticated successfully!');
});

client.on('auth_failure', msg => {
    console.error('WhatsApp authentication failure:', msg);
});

// Start WhatsApp client
client.initialize();

function saveScheduledJobs(jobs) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(jobs, null, 2));
}

function getScheduledJobs() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
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
        // Clean up
        if (fs.existsSync(jobData.filePath)) {
            fs.unlinkSync(jobData.filePath);
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
            // Already past due, send immediately
            sendScheduledMessage(jobData);
        } else {
            // Schedule for future
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

// API endpoint to send message immediately
app.post('/send-to-group', upload.single('image'), async (req, res) => {
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

// API endpoint to schedule a message
app.post('/schedule-card', upload.single('image'), async (req, res) => {
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

        // Save image to disk
        const id = crypto.randomUUID();
        const filePath = path.join(CARDS_DIR, `${id}.png`);
        fs.writeFileSync(filePath, file.buffer);

        const jobData = {
            id,
            caption,
            targetGroup,
            scheduledTime: scheduleDate.toISOString(),
            filePath
        };

        // Save to JSON
        const jobs = getScheduledJobs();
        jobs.push(jobData);
        saveScheduledJobs(jobs);

        // Schedule the job
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

// API endpoint to view scheduled messages
app.get('/scheduled-cards', (req, res) => {
    try {
        const jobs = getScheduledJobs();
        // Return jobs with the image URL mapped
        const mappedJobs = jobs.map(job => ({
            id: job.id,
            caption: job.caption,
            targetGroup: job.targetGroup,
            scheduledTime: job.scheduledTime,
            imageUrl: `http://localhost:3001/scheduled-cards-images/${path.basename(job.filePath)}`
        }));
        
        // Sort by time ascending
        mappedJobs.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
        
        res.status(200).json({ success: true, jobs: mappedJobs });
    } catch (error) {
        console.error('Error fetching scheduled messages:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch scheduled messages' });
    }
});

// API endpoint to delete/cancel a scheduled message
app.delete('/scheduled-cards/:id', (req, res) => {
    try {
        const { id } = req.params;
        const jobs = getScheduledJobs();
        
        const jobIndex = jobs.findIndex(j => j.id === id);
        if (jobIndex === -1) {
            return res.status(404).json({ success: false, message: 'Scheduled task not found' });
        }
        
        const jobData = jobs[jobIndex];
        
        // Cancel the node-schedule job if it exists
        const currentJob = schedule.scheduledJobs[id];
        if (currentJob) {
            currentJob.cancel();
        }
        
        // Delete the image file
        if (fs.existsSync(jobData.filePath)) {
            fs.unlinkSync(jobData.filePath);
        }
        
        // Remove from JSON
        jobs.splice(jobIndex, 1);
        saveScheduledJobs(jobs);
        
        console.log(`🗑️ Canceled scheduled card for ${jobData.targetGroup}`);
        res.status(200).json({ success: true, message: 'Scheduled card canceled successfully' });
    } catch (error) {
        console.error('Error canceling scheduled message:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel scheduled message: ' + error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 Express API running on http://localhost:${PORT}`);
    console.log(`Waiting for WhatsApp client to initialize...`);
});
