const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const { Readable } = require('stream');
const htmlPdf = require('html-pdf-node');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '11DFsjOzmpev0_6qQY82EqzIYFpCiC4UP';
const SHEET_NAME = 'Assessments';

const HEADERS = [
  'Timestamp', 'Student Name', 'Phone/ID', 'Trainer', 'Date', 'Background',
  'CEFR Level', 'Fluency', 'Grammar', 'Vocabulary', 'Pronunciation',
  'Confidence', 'Comprehension', 'Coherence', 'Overall Avg',
  'Filler Words', 'Strengths', 'Areas to Improve', 'Recommended Course', 'Report (Drive Link)'
];

// ── Auth ────────────────────────────────────────────────────────────────────
function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

// ── Generate report HTML ────────────────────────────────────────────────────
function generateReportHTML(d, scores, avg) {
  const CEFR_COLORS = {A1:'#E24B4A',A2:'#EF9F27',B1:'#378ADD',B2:'#7F77DD',C1:'#1D9E75',C2:'#639922'};
  const SCORE_LABELS = ['Fluency','Grammar','Vocabulary','Pronunciation','Confidence','Comprehension','Coherence'];
  const SCORE_KEYS   = ['fluency','grammar','vocabulary','pronunciation','confidence','listening','coherence'];
  const COLORS = ['#378ADD','#1D9E75','#7F77DD','#D85A30','#EF9F27','#D4537E','#639922'];
  const cc = CEFR_COLORS[d.cefr] || '#888';
  const avgColor = avg >= 8 ? '#4CAF50' : avg >= 5 ? '#333' : '#E24B4A';
  const date = new Date().toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'});
  const initials = (d.studentName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

  const barRows = SCORE_KEYS.map((k, i) => `
    <tr>
      <td style="width:130px;font-size:13px;color:#666;padding:7px 0">${SCORE_LABELS[i]}</td>
      <td style="padding:7px 10px">
        <div style="background:#eee;border-radius:99px;height:9px;overflow:hidden">
          <div style="width:${(scores[k]||0)*10}%;height:9px;background:${COLORS[i]};border-radius:99px"></div>
        </div>
      </td>
      <td style="width:36px;font-size:13px;font-weight:700;color:${(scores[k]||0)>=8?'#4CAF50':(scores[k]||0)>=5?'#333':'#E24B4A'};text-align:right;padding:7px 0">${scores[k]||0}</td>
    </tr>`).join('');

  const fillerTags = (d.fillers||[]).map(f =>
    `<span style="display:inline-block;font-size:11px;padding:3px 10px;border-radius:99px;background:#FFF3DC;color:#996600;font-family:monospace;margin:2px 3px">${f}</span>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;background:#fff;color:#111;padding:36px 40px;}
  .header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #FF4D00;padding-bottom:16px;margin-bottom:24px;}
  .logo-big{font-size:26px;font-weight:900;color:#111;line-height:0.9;letter-spacing:-0.5px;}
  .logo-k{color:#FF4D00;}
  .header-right{text-align:right;font-size:11px;color:#999;line-height:1.7;}
  .student-card{background:#fafafa;border:1px solid #eee;border-radius:10px;padding:18px 20px;display:flex;align-items:center;gap:16px;margin-bottom:14px;}
  .avatar{width:50px;height:50px;border-radius:50%;background:#FFE8E0;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;color:#FF4D00;flex-shrink:0;}
  .s-name{font-size:17px;font-weight:900;margin-bottom:4px;}
  .s-meta{font-size:12px;color:#888;line-height:1.6;}
  .cefr-pill{display:inline-block;padding:3px 14px;border-radius:99px;font-size:15px;font-weight:900;margin-bottom:4px;}
  .avg-num{font-size:28px;font-weight:900;line-height:1;}
  .card{background:#fff;border:1px solid #eee;border-radius:10px;padding:16px 20px;margin-bottom:12px;}
  .card-title{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:#aaa;font-weight:700;margin-bottom:12px;}
  .obs-box{background:#f5f5f5;border-radius:8px;padding:11px 14px;font-size:13px;color:#555;line-height:1.65;margin-top:5px;}
  .obs-label{font-size:12px;font-weight:700;margin-top:10px;margin-bottom:4px;}
  .footer{margin-top:28px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#bbb;text-align:center;}
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-big">BRO<span class="logo-k">K</span>EN</div>
      <div class="logo-big">ENGLISH</div>
    </div>
    <div class="header-right">
      Student Assessment Report<br>
      ${date}<br>
      Confidential
    </div>
  </div>

  <div class="student-card">
    <div class="avatar">${initials}</div>
    <div style="flex:1">
      <div class="s-name">${d.studentName||''}</div>
      <div class="s-meta">
        ${d.background||''}${d.background&&d.phone?' · ':''}${d.phone||''}<br>
        Trainer: ${d.trainer||''} &nbsp;·&nbsp; ${d.date||''}<br>
        <strong style="color:#111">${d.course||''}</strong>
      </div>
    </div>
    <div style="text-align:center;flex-shrink:0">
      ${d.cefr?`<div class="cefr-pill" style="background:${cc}22;color:${cc}">${d.cefr}</div><div style="font-size:10px;color:#bbb;margin:3px 0">CEFR level</div>`:''}
      <div class="avg-num" style="color:${avgColor}">${avg}<span style="font-size:13px;font-weight:400;color:#bbb">/10</span></div>
      <div style="font-size:10px;color:#bbb">overall avg</div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Score breakdown</div>
    <table style="width:100%;border-collapse:collapse">${barRows}</table>
  </div>

  ${(d.fillers||[]).length ? `
  <div class="card">
    <div class="card-title">Filler words observed</div>
    <div style="margin-top:4px">${fillerTags}</div>
  </div>` : ''}

  ${(d.strengths||d.weaknesses) ? `
  <div class="card">
    <div class="card-title">Trainer notes</div>
    ${d.strengths?`<div class="obs-label" style="color:#4CAF50">Strengths</div><div class="obs-box">${d.strengths}</div>`:''}
    ${d.weaknesses?`<div class="obs-label" style="color:#E24B4A">Areas to improve</div><div class="obs-box">${d.weaknesses}</div>`:''}
  </div>` : ''}

  <div class="footer">Broken English — Kochi &nbsp;·&nbsp; brokenenglish.in</div>
</body>
</html>`;
}

// ── Generate PDF ────────────────────────────────────────────────────────────
async function generatePDF(htmlContent) {
  const file = { content: htmlContent };
  const options = {
    format: 'A4',
    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    printBackground: true,
  };
  return await htmlPdf.generatePdf(file, options);
}

// ── Upload PDF to Google Drive ──────────────────────────────────────────────
async function uploadPDFToDrive(auth, fileName, pdfBuffer) {
  const drive = google.drive({ version: 'v3', auth });
  const stream = Readable.from([pdfBuffer]);
  const res = await drive.files.create({
    requestBody: {
      name: fileName + '.pdf',
      mimeType: 'application/pdf',
      parents: [DRIVE_FOLDER_ID],
    },
    media: {
      mimeType: 'application/pdf',
      body: stream,
    },
    fields: 'id, webViewLink',
  });
  return res.data;
}

// ── Ensure sheet headers ────────────────────────────────────────────────────
async function ensureHeaders(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:T1`,
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
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] },
      });
    } catch (e) { console.error('Header error:', e.message); }
  }
}

// ── POST /api/submit ────────────────────────────────────────────────────────
app.post('/api/submit', async (req, res) => {
  const d = req.body;
  if (!SHEET_ID) return res.status(500).json({ error: 'GOOGLE_SHEET_ID not configured' });

  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    await ensureHeaders(sheets);

    const scores = d.scores || {};
    const vals = ['fluency','grammar','vocabulary','pronunciation','confidence','listening','coherence']
      .map(k => scores[k] || 0).filter(v => v > 0);
    const avg = Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);

    // Generate PDF and upload to Drive
    const safeName = (d.studentName || 'Student').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const fileName = `${safeName} — Assessment ${d.date || new Date().toISOString().slice(0,10)}`;
    let driveLink = '';

    try {
      const html = generateReportHTML(d, scores, avg);
      const pdfBuffer = await generatePDF(html);
      const driveFile = await uploadPDFToDrive(auth, fileName, pdfBuffer);
      driveLink = driveFile.webViewLink || '';
      console.log(`PDF uploaded to Drive: ${fileName}.pdf`);
    } catch (pdfErr) {
      console.error('PDF/Drive error:', pdfErr.message);
    }

    // Save to Sheets
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
      driveLink,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:T`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    res.json({ success: true, avg, driveLink });
  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/records ────────────────────────────────────────────────────────
app.get('/api/records', async (req, res) => {
  if (!SHEET_ID) return res.status(500).json({ error: 'GOOGLE_SHEET_ID not configured' });
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:T`,
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
