const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── Google Sheets Auth ─────────────────────────────────────────────────────
function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'Assessments';

// Headers for the sheet
const HEADERS = [
  'Timestamp', 'Student Name', 'Phone/ID', 'Trainer', 'Date', 'Background',
  'CEFR Level', 'Fluency', 'Grammar', 'Vocabulary', 'Pronunciation',
  'Confidence', 'Comprehension', 'Coherence', 'Overall Avg',
  'Filler Words', 'Strengths', 'Areas to Improve', 'Recommended Course'
];

// ── Ensure sheet headers exist ─────────────────────────────────────────────
async function ensureHeaders(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:S1`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] },
      });
    }
  } catch (err) {
    // Sheet tab might not exist — try to create it
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
        }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] },
      });
    } catch (e) {
      console.error('Header setup error:', e.message);
    }
  }
}

// ── POST /api/submit ────────────────────────────────────────────────────────
app.post('/api/submit', async (req, res) => {
  const d = req.body;
  if (!SHEET_ID) return res.status(500).json({ error: 'GOOGLE_SHEET_ID not configured' });

  try {
    const sheets = getSheetsClient();
    await ensureHeaders(sheets);

    const scores = d.scores || {};
    const avg = Math.round(
      [scores.fluency, scores.grammar, scores.vocabulary,
       scores.pronunciation, scores.confidence, scores.listening, scores.coherence]
        .filter(Boolean)
        .reduce((a, b) => a + b, 0) /
      [scores.fluency, scores.grammar, scores.vocabulary,
       scores.pronunciation, scores.confidence, scores.listening, scores.coherence]
        .filter(Boolean).length
    );

    const row = [
      new Date().toISOString(),
      d.studentName || '',
      d.phone || '',
      d.trainer || '',
      d.date || '',
      d.background || '',
      d.cefr || '',
      scores.fluency || '',
      scores.grammar || '',
      scores.vocabulary || '',
      scores.pronunciation || '',
      scores.confidence || '',
      scores.listening || '',
      scores.coherence || '',
      avg,
      (d.fillers || []).join(', '),
      d.strengths || '',
      d.weaknesses || '',
      d.course || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:S`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    res.json({ success: true, avg });
  } catch (err) {
    console.error('Sheets error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/records ────────────────────────────────────────────────────────
app.get('/api/records', async (req, res) => {
  if (!SHEET_ID) return res.status(500).json({ error: 'GOOGLE_SHEET_ID not configured' });
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:S`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return res.json([]);

    const headers = rows[0];
    const records = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });

    res.json(records.reverse()); // newest first
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve index for all other routes ───────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎙️  Broken English Assessment Tool → http://localhost:${PORT}\n`);
});
