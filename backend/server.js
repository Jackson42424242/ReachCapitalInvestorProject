const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
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
  // Create or join a session. Body: { sessionId? , role }
  const { sessionId, role } = req.body || {};
  if(sessionId && sessions[sessionId]){
    return res.json({ sessionId, joined: true });
  }

  const id = makeId();
  sessions[id] = { users: { buyer: { agreed:false }, seller: { agreed:false } }, messages: [], currentTerms: null, createdAt: Date.now() };
  return res.json({ sessionId: id });
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

const PORT = process.env.PORT || 7777;
app.listen(PORT, () => console.log('Mandate backend stub running on port', PORT));
