const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory database (for demo; use persistent DB in production)
const db = {
  profiles: {},
  adminPassword: 'admin123' // Change this in production
};

// Load data from file if it exists
const DATA_FILE = path.join(__dirname, 'data.json');
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      Object.assign(db, data);
    }
  } catch (e) {
    console.error('Error loading data:', e);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving data:', e);
  }
}

// Middleware to verify admin
function verifyAdmin(req, res, next) {
  const adminPass = req.headers['x-admin-password'];
  if (adminPass === db.adminPassword) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Routes

// Create or get profile
app.post('/api/profile/:profileId', (req, res) => {
  const { profileId } = req.params;
  const { name, password } = req.body;

  if (!profileId || !name) {
    return res.status(400).json({ error: 'Missing profileId or name' });
  }

  if (!db.profiles[profileId]) {
    db.profiles[profileId] = {
      id: profileId,
      name,
      password: password || '',
      data: {
        chapters: [],
        questions: [],
        resources: [],
        logs: [],
        bookCategories: [],
        resourceCategories: [],
        createdAt: new Date().toISOString()
      }
    };
    saveData();
  }

  res.json({ success: true, profile: db.profiles[profileId] });
});

// Get profile data (with password check)
app.get('/api/profile/:profileId', (req, res) => {
  const { profileId } = req.params;
  const { password } = req.query;

  const profile = db.profiles[profileId];
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  // If profile has password, check it
  if (profile.password && profile.password !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.json({ success: true, data: profile.data });
});

// Save profile data
app.put('/api/profile/:profileId', (req, res) => {
  const { profileId } = req.params;
  const { password, data } = req.body;

  const profile = db.profiles[profileId];
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  if (profile.password && profile.password !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  profile.data = data;
  profile.lastModified = new Date().toISOString();
  saveData();

  res.json({ success: true });
});

// Admin: List all profiles
app.get('/api/admin/profiles', verifyAdmin, (req, res) => {
  const profiles = Object.values(db.profiles).map(p => ({
    id: p.id,
    name: p.name,
    hasPassword: !!p.password,
    createdAt: p.data.createdAt,
    lastModified: p.lastModified,
    questionCount: (p.data.questions || []).length,
    resourceCount: (p.data.resources || []).length,
    chapterCount: (p.data.chapters || []).length
  }));
  res.json({ success: true, profiles });
});

// Admin: Get profile data
app.get('/api/admin/profile/:profileId', verifyAdmin, (req, res) => {
  const { profileId } = req.params;
  const profile = db.profiles[profileId];

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json({ success: true, profile });
});

// Admin: Delete profile
app.delete('/api/admin/profile/:profileId', verifyAdmin, (req, res) => {
  const { profileId } = req.params;
  delete db.profiles[profileId];
  saveData();
  res.json({ success: true });
});

// Admin: Change admin password
app.post('/api/admin/change-password', verifyAdmin, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const adminPass = req.headers['x-admin-password'];

  if (adminPass !== oldPassword) {
    return res.status(401).json({ error: 'Current password incorrect' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 chars' });
  }

  db.adminPassword = newPassword;
  saveData();
  res.json({ success: true, message: 'Password changed' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

loadData();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Exam Prep Tracker server running on http://localhost:${PORT}`);
});
