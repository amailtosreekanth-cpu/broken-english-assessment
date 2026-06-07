const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { PassThrough } = require('stream');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve generated PDFs
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// Create reports directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'reports'))) {
  fs.mkdirSync(path.join(__dirname, 'reports'));
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'Assessments';
const BASE_URL = process.env.BASE_URL || 'https://broken-english-assessment.onrender.com';

const HEADERS = [
  'Timestamp', 'Student Name', 'Phone/ID', 'Trainer', 'Date', 'Background',
  'CEFR Level', 'Fluency', 'Grammar', 'Vocabulary', 'Pronunciation',
  'Confidence', 'Comprehension', 'Coherence', 'Overall Avg',
  'Filler Words', 'Strengths', 'Areas to Improve', 'Recommended Course', 'Report Link'
];

const SCORE_LABELS = ['Fluency','Grammar','Vocabulary','Pronunciation','Confidence','Comprehension','Coherence'];
const SCORE_KEYS   = ['fluency','grammar','vocabulary','pronunciation','confidence','listening','coherence'];
const BAR_COLORS   = ['#378ADD','#1D9E75','#7F77DD','#D85A30','#EF9F27','#D4537E','#639922'];
const CEFR_COLORS  = {A1:'#E24B4A',A2:'#EF9F27',B1:'#378ADD',B2:'#7F77DD',C1:'#1D9E75',C2:'#639922'};

// ── Auth ─────────────────────────────────────────────────────────────────
function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// ── Generate PDF ──────────────────────────────────────────────────────────
function generatePDF(d, scores, avg) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = 515;
    const cefrColor = CEFR_COLORS[d.cefr] || '#888888';
    const avgColor = avg >= 8 ? '#4CAF50' : avg >= 5 ? '#333333' : '#E24B4A';
    const date = new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'});

    doc.rect(40, 40, W, 60).fill('#111111');
    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold')
       .text('BROKEN', 52, 52, {continued:true})
       .fillColor('#FF4D00').text('  ENGLISH');
    doc.fontSize(9).fillColor('#aaaaaa').font('Helvetica')
       .text('Student Assessment Report', 52, 78);
    doc.fontSize(9).fillColor('#aaaaaa').font('Helvetica')
       .text(date, 300, 60, {width:255, align:'right'})
       .text('Confidential', 300, 74, {width:255, align:'right'});

    let y = 115;
    doc.rect(40, y, W, 80).fill('#f9f9f9').stroke('#eeeeee');
    doc.circle(80, y+40, 24).fill('#FFE8E0');
    const initials = (d.studentName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    doc.fontSize(14).fillColor('#FF4D00').font('Helvetica-Bold')
       .text(initials, 56, y+28, {width:48, align:'center'});
    doc.fontSize(14).fillColor('#111111').font('Helvetica-Bold')
       .text(d.studentName||'', 116, y+10);
    doc.fontSize(10).fillColor('#888888').font('Helvetica')
       .text(`${d.background||''}${d.background&&d.phone?' · ':''}${d.phone||''}`, 116, y+28);
    doc.fontSize(10).fillColor('#888888')
       .text(`Trainer: ${d.trainer||''} · ${d.date||''}`, 116, y+42);
    doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold')
       .text(d.course||'', 116, y+57);

    if (d.cefr) {
      doc.roundedRect(420, y+8, 50, 26, 13).fill(cefrColor);
      doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold')
         .text(d.cefr, 420, y+13, {width:50, align:'center'});
      doc.fontSize(8).fillColor('#aaaaaa').font('Helvetica')
         .text('CEFR level', 415, y+38, {width:60, align:'center'});
    }
    doc.fontSize(24).fillColor(avgColor).font('Helvetica-Bold')
       .text(`${avg}`, 420, y+48, {width:40, align:'center', continued:true})
       .fontSize(11).fillColor('#aaaaaa').font('Helvetica').text('/10');
    doc.fontSize(8).fillColor('#aaaaaa')
       .text('overall avg', 415, y+72, {width:60, align:'center'});

    y += 96;

    doc.rect(40, y, W, 14).fill('#f0f0f0');
    doc.fontSize(8).fillColor('#999999').font('Helvetica-Bold')
       .text('SCORE BREAKDOWN', 52, y+3, {characterSpacing:1.5});
    y += 20;

    SCORE_KEYS.forEach((k, i) => {
      const val = scores[k] || 0;
      const barW = Math.round((val / 10) * 300);
      doc.fontSize(11).fillColor('#444444').font('Helvetica')
         .text(SCORE_LABELS[i], 52, y+2, {width:110});
      doc.rect(170, y+4, 300, 8).fill('#eeeeee');
      if (barW > 0) doc.rect(170, y+4, barW, 8).fill(BAR_COLORS[i]);
      let numColor = '#333333';
      if (val >= 8) numColor = '#4CAF50';
      else if (val < 5) numColor = '#E24B4A';
      doc.fontSize(11).fillColor(numColor).font('Helvetica-Bold')
         .text(`${val}`, 478, y+2, {width:30, align:'right'});
      y += 22;
    });

    y += 8;

    if ((d.fillers||[]).length > 0) {
      doc.rect(40, y, W, 14).fill('#f0f0f0');
      doc.fontSize(8).fillColor('#999999').font('Helvetica-Bold')
         .text('FILLER WORDS OBSERVED', 52, y+3, {characterSpacing:1.5});
      y += 20;
      let fx = 52;
      d.fillers.forEach(f => {
        const tw = doc.widthOfString(f) + 20;
        if (fx + tw > 530) { fx = 52; y += 22; }
        doc.roundedRect(fx, y, tw, 18, 9).fill('#FFF3DC');
        doc.fontSize(10).fillColor('#996600').font('Helvetica').text(f, fx+10, y+4);
        fx += tw + 8;
      });
      y += 28;
    }

    if (d.strengths || d.weaknesses) {
      doc.rect(40, y, W, 14).fill('#f0f0f0');
      doc.fontSize(8).fillColor('#999999').font('Helvetica-Bold')
         .text('TRAINER NOTES', 52, y+3, {characterSpacing:1.5});
      y += 20;
      if (d.strengths) {
        doc.fontSize(10).fillColor('#4CAF50').font('Helvetica-Bold').text('Strengths', 52, y);
        y += 16;
        const sh = doc.heightOfString(d.strengths, {width:W-24});
        doc.rect(40, y, W, sh+16).fill('#f5f5f5');
        doc.fontSize(10).fillColor('#555555').font('Helvetica')
           .text(d.strengths, 52, y+8, {width:W-24});
        y += sh + 24;
      }
      if (d.weaknesses) {
        doc.fontSize(10).fillColor('#E24B4A').font('Helvetica-Bold').text('Areas to improve', 52, y);
        y += 16;
        const wh = doc.heightOfString(d.weaknesses, {width:W-24});
        doc.rect(40, y, W, wh+16).fill('#f5f5f5');
        doc.fontSize(10).fillColor('#555555').font('Helvetica')
           .text(d.weaknesses, 52, y+8, {width:W-24});
        y += wh + 24;
      }
    }

    doc.rect(40, 780, W, 1).fill('#eeeeee');
    doc.fontSize(9).fillColor('#bbbbbb').font('Helvetica')
       .text('Broken English — Kochi · brokenenglish.in', 40, 788, {width:W, align:'center'});

    doc.end();
  });
}

// ── Ensure sheet headers ──────────────────────────────────────────────────
async function ensureHeaders(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A1:T1`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW', requestBody: { values: [HEADERS] },
      });
    }
  } catch (err) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW', requestBody: { values: [HEADERS] },
      });
    } catch (e) { console.error('Header error:', e.message); }
  }
}

// ── POST /api/submit ──────────────────────────────────────────────────────
app.post('/api/submit', async (req, res) => {
  const d = req.body;
  if (!SHEET_ID) return res.status(500).json({ error: 'GOOGLE_SHEET_ID not configured' });

  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    await ensureHeaders(sheets);

    const scores = d.scores || {};
    const vals = SCORE_KEYS.map(k => scores[k] || 0).filter(v => v > 0);
    const avg = Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);

    // Generate PDF and save to /reports folder
    const safeName = (d.studentName || 'Student').replace(/[^a-zA-Z0-9]/g, '_').trim();
    const timestamp = Date.now();
    const fileName = `${safeName}_${timestamp}.pdf`;
    const filePath = path.join(__dirname, 'reports', fileName);
    const reportLink = `${BASE_URL}/reports/${fileName}`;

    let savedLink = '';
    try {
      console.log('Generating PDF...');
      const pdfBuffer = await generatePDF(d, scores, avg);
      fs.writeFileSync(filePath, pdfBuffer);
      savedLink = reportLink;
      console.log(`PDF saved: ${fileName} → ${reportLink}`);
    } catch (pdfErr) {
      console.error('PDF error:', pdfErr.message);
    }

    // Save to Sheets
    const row = [
      new Date().toISOString(), d.studentName||'', d.phone||'', d.trainer||'',
      d.date||'', d.background||'', d.cefr||'',
      scores.fluency||'', scores.grammar||'', scores.vocabulary||'',
      scores.pronunciation||'', scores.confidence||'', scores.listening||'',
      scores.coherence||'', avg, (d.fillers||[]).join(', '),
      d.strengths||'', d.weaknesses||'', d.course||'', savedLink,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A:T`,
      valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    res.json({ success: true, avg, reportLink: savedLink });
  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/records ──────────────────────────────────────────────────────
app.get('/api/records', async (req, res) => {
  if (!SHEET_ID) return res.status(500).json({ error: 'GOOGLE_SHEET_ID not configured' });
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A:T`,
    });
    const rows = response.data.values || [];
    if (rows.length <= 1) return res.json([]);
    const headers = rows[0];
    const records = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
    res.json(records.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎙️  Broken English Assessment Tool → http://localhost:${PORT}\n`);
});
