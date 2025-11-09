const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Configure CORS with specific options
// Configure CORS: reflect request origin (required when using credentials)
app.use(cors({
  origin: true, // reflect request origin
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

// Handle preflight requests using the same CORS options
app.options('*', cors({ origin: true, credentials: true }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  if (req.body) console.log('Body:', req.body);
  next();
});

app.use(bodyParser.json());

// In-memory store (reset when server restarts)
const sessions = {}; // sessionId -> { users: {buyer:{agreed}, seller:{agreed}}, messages: [], currentTerms }

function makeId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function mediateMessage(original, fromRole){
  // Placeholder mediation logic. Replace with real LLM integration.
  const mediated = `MandateBot reformulation of ${fromRole}'s message:\n${original}`;
  // Simple heuristic to generate a suggested deal if numbers appear
  const amountMatch = original.match(/\$?([0-9,]+(?:\.[0-9]{1,2})?)/);
  const suggestedDeal = amountMatch ? { type: 'payment', amount: parseFloat(amountMatch[1].replace(/,/g,'')), terms: 'Standard terms', probability: 60 } : null;
  return { mediated, suggestedDeal };
}

app.post('/api/chat/session', (req, res) => {
  try {
    // Create or join a session. Body: { sessionId? , role }
    const { sessionId, role } = req.body || {};
    
    // Validate role
    if (!role || (role !== 'buyer' && role !== 'seller')) {
      return res.status(400).json({ error: 'Invalid role. Must be buyer or seller' });
    }

    // Join existing session
    if (sessionId && sessions[sessionId]) {
      console.log('Joining session:', sessionId, 'as', role);
      return res.json({ sessionId, joined: true });
    }

    // Create new session
    const id = makeId();
    sessions[id] = { 
      users: { 
        buyer: { agreed: false }, 
        seller: { agreed: false } 
      }, 
      messages: [], 
      currentTerms: null, 
      createdAt: Date.now() 
    };
    console.log('Created new session:', id, 'for', role);
    return res.json({ sessionId: id, joined: false });
  } catch (err) {
    console.error('Session creation error:', err);
    res.status(500).json({ error: 'Failed to create/join session: ' + err.message });
  }
});

app.post('/api/chat/message', (req, res) => {
  const { sessionId, role, message } = req.body || {};
  if(!sessionId || !sessions[sessionId]) return res.status(400).json({ error: 'Invalid sessionId' });
  if(!role || (role !== 'buyer' && role !== 'seller')) return res.status(400).json({ error: 'Invalid role' });
  if(!message) return res.status(400).json({ error: 'Empty message' });

  const { mediated, suggestedDeal } = mediateMessage(message, role);
  const entry = { from: role, to: role === 'buyer' ? 'seller' : 'buyer', original: message, mediated, suggestedDeal, timestamp: Date.now() };
  sessions[sessionId].messages.push(entry);
  if(suggestedDeal){
    sessions[sessionId].currentTerms = `${suggestedDeal.type} $${suggestedDeal.amount} — ${suggestedDeal.terms}`;
  }
  return res.json({ message: mediated, suggestedDeal, sessionId });
});

app.get('/api/chat/messages', (req, res) => {
  const { sessionId, since } = req.query;
  if(!sessionId || !sessions[sessionId]) return res.status(400).json({ error: 'Invalid sessionId' });
  const sinceNum = parseInt(since || '0', 10);
  const messages = sessions[sessionId].messages.filter(m => m.timestamp > sinceNum);
  return res.json({ messages, currentTerms: sessions[sessionId].currentTerms, users: sessions[sessionId].users });
});

app.post('/api/chat/agree', (req, res) => {
  const { sessionId, role } = req.body || {};
  if(!sessionId || !sessions[sessionId]) return res.status(400).json({ error: 'Invalid sessionId' });
  if(!role || (role !== 'buyer' && role !== 'seller')) return res.status(400).json({ error: 'Invalid role' });
  sessions[sessionId].users[role].agreed = true;
  const bothAgree = sessions[sessionId].users.buyer.agreed && sessions[sessionId].users.seller.agreed;
  return res.json({ agreed: sessions[sessionId].users[role].agreed, bothAgree, currentTerms: sessions[sessionId].currentTerms });
});

app.get('/api/chat/status', (req, res) => {
  const { sessionId } = req.query;
  if(!sessionId || !sessions[sessionId]) return res.status(400).json({ error: 'Invalid sessionId' });
  const s = sessions[sessionId];
  return res.json({ users: s.users, currentTerms: s.currentTerms, createdAt: s.createdAt });
});

const PORT = process.env.PORT || 3000;

// Error handling for the server
const server = app.listen(PORT, () => {
    console.log('Mandate backend stub running on port', PORT);
    console.log('Try creating a session with:');
    console.log('curl -X POST http://localhost:' + PORT + '/api/chat/session -H "Content-Type: application/json" -d \'{"role":"buyer"}\'');
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try a different port or kill the process using this port.`);
    } else {
        console.error('Server error:', error);
    }
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
    server.close(() => {
        console.log('Server shut down gracefully');
        process.exit(0);
    });
});
