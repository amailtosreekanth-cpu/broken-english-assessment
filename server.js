const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve saved reports
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// Create reports directory
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
const COLORS = ['#378ADD','#1D9E75','#7F77DD','#D85A30','#EF9F27','#D4537E','#639922'];
const CEFR_COLORS = {A1:'#E24B4A',A2:'#EF9F27',B1:'#378ADD',B2:'#7F77DD',C1:'#1D9E75',C2:'#639922'};
const CEFR_BG = {A1:'rgba(226,75,74,.15)',A2:'rgba(239,159,39,.15)',B1:'rgba(55,138,221,.15)',B2:'rgba(127,119,221,.15)',C1:'rgba(29,158,117,.15)',C2:'rgba(99,153,34,.15)'};

// ── Auth ─────────────────────────────────────────────────────────────────
function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// ── Generate beautiful HTML report ───────────────────────────────────────
function generateReportHTML(d, scores, avg) {
  const cc = CEFR_COLORS[d.cefr] || '#888';
  const cb = CEFR_BG[d.cefr] || 'rgba(136,136,136,.15)';
  const avgColor = avg >= 8 ? '#4CAF50' : avg >= 5 ? '#111' : '#E24B4A';
  const date = new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'});
  const initials = (d.studentName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

  const barRows = SCORE_KEYS.map((k,i) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="width:120px;font-size:13px;color:#666">${SCORE_LABELS[i]}</span>
      <div style="flex:1;background:#eee;border-radius:99px;height:9px;overflow:hidden">
        <div style="width:${(scores[k]||0)*10}%;height:100%;background:${COLORS[i]};border-radius:99px"></div>
      </div>
      <span style="width:28px;text-align:right;font-size:13px;font-weight:700;color:${(scores[k]||0)>=8?'#4CAF50':(scores[k]||0)>=5?'#333':'#E24B4A'}">${scores[k]||0}</span>
    </div>`).join('');

  const fillerTags = (d.fillers||[]).map(f =>
    `<span style="display:inline-block;font-size:11px;padding:3px 10px;border-radius:999px;background:#FFF3DC;color:#996600;font-family:monospace;margin:2px 3px">${f}</span>`
  ).join('');

  const radarData = JSON.stringify(SCORE_KEYS.map(k => scores[k]||0));
  const radarLabels = JSON.stringify(SCORE_LABELS);
  const radarColors = JSON.stringify(COLORS);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${d.studentName||'Student'} — Assessment Report</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'DM Sans',sans-serif;background:#f5f5f5;color:#111;padding:24px;}
  .wrap{max-width:720px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
  .header{background:#111;padding:24px 28px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #FF4D00;}
  .logo-line{font-family:'Syne',sans-serif;font-weight:800;font-size:22px;color:#fff;line-height:0.9;}
  .logo-k{color:#FF4D00;}
  .header-right{text-align:right;font-size:11px;color:#aaa;line-height:1.7;}
  .student-card{display:flex;align-items:center;gap:16px;padding:20px 28px;background:#fafafa;border-bottom:1px solid #eee;}
  .avatar{width:52px;height:52px;border-radius:50%;background:#FFE8E0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#FF4D00;flex-shrink:0;font-family:'Syne',sans-serif;}
  .s-name{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;margin-bottom:3px;}
  .s-meta{font-size:12px;color:#888;line-height:1.6;}
  .section{padding:20px 28px;border-bottom:1px solid #eee;}
  .section-title{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:#aaa;font-weight:700;margin-bottom:14px;}
  .cefr-pill{display:inline-block;padding:4px 16px;border-radius:999px;font-size:16px;font-weight:800;font-family:'Syne',sans-serif;}
  .avg-num{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;line-height:1;}
  .obs-box{background:#f5f5f5;border-radius:8px;padding:12px 14px;font-size:13px;color:#555;line-height:1.65;margin-top:5px;}
  .obs-label{font-size:12px;font-weight:700;margin-top:12px;margin-bottom:4px;}
  .footer{padding:16px 28px;text-align:center;font-size:11px;color:#bbb;}
  .print-btn{display:block;margin:16px auto;padding:10px 28px;background:#FF4D00;color:#fff;border:none;border-radius:8px;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;cursor:pointer;}
  @media print{.print-btn{display:none!important;}body{background:#fff;padding:0;}.wrap{box-shadow:none;border-radius:0;}}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div>
      <div class="logo-line">BRO<span class="logo-k">K</span>EN</div>
      <div class="logo-line">ENGLISH</div>
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
        <strong style="color:#333">${d.course||''}</strong>
      </div>
    </div>
    <div style="text-align:center;flex-shrink:0">
      ${d.cefr?`<div class="cefr-pill" style="background:${cb};color:${cc}">${d.cefr}</div><div style="font-size:10px;color:#bbb;margin:4px 0">CEFR level</div>`:''}
      <div class="avg-num" style="color:${avgColor}">${avg}<span style="font-size:13px;font-weight:400;color:#aaa">/10</span></div>
      <div style="font-size:10px;color:#bbb">overall avg</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Score breakdown</div>
    ${barRows}
  </div>

  <div class="section">
    <div class="section-title">Radar overview</div>
    <div style="display:flex;justify-content:center">
      <canvas id="radar" width="280" height="280"></canvas>
    </div>
  </div>

  ${(d.fillers||[]).length ? `
  <div class="section">
    <div class="section-title">Filler words observed</div>
    <div>${fillerTags}</div>
  </div>` : ''}

  ${(d.strengths||d.weaknesses) ? `
  <div class="section">
    <div class="section-title">Trainer notes</div>
    ${d.strengths?`<div class="obs-label" style="color:#4CAF50">✓ Strengths</div><div class="obs-box">${d.strengths}</div>`:''}
    ${d.weaknesses?`<div class="obs-label" style="color:#E24B4A">↑ Areas to improve</div><div class="obs-box">${d.weaknesses}</div>`:''}
  </div>` : ''}

  <div class="footer">Broken English — Kochi &nbsp;·&nbsp; brokenenglish.in</div>
</div>

<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>

<script>
const ctx = document.getElementById('radar').getContext('2d');
new Chart(ctx, {
  type: 'radar',
  data: {
    labels: ${radarLabels},
    datasets: [{
      data: ${radarData},
      backgroundColor: 'rgba(255,77,0,0.1)',
      borderColor: '#FF4D00',
      borderWidth: 2,
      pointBackgroundColor: '#FF4D00',
      pointRadius: 4,
    }]
  },
  options: {
    responsive: false,
    scales: {
      r: {
        min: 0, max: 10,
        ticks: { display: false },
        grid: { color: 'rgba(0,0,0,0.08)' },
        angleLines: { color: 'rgba(0,0,0,0.08)' },
        pointLabels: { font: { size: 11 }, color: '#666' }
      }
    },
    plugins: { legend: { display: false } }
  }
});
</script>
</body>
</html>`;
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

    // Generate HTML report and save
    const safeName = (d.studentName || 'Student').replace(/[^a-zA-Z0-9]/g, '_').trim();
    const timestamp = Date.now();
    const fileName = `${safeName}_${timestamp}.html`;
    const filePath = path.join(__dirname, 'reports', fileName);
    const reportLink = `${BASE_URL}/reports/${fileName}`;

    let savedLink = '';
    try {
      const html = generateReportHTML(d, scores, avg);
      fs.writeFileSync(filePath, html);
      savedLink = reportLink;
      console.log(`Report saved: ${fileName} → ${reportLink}`);
    } catch (err) {
      console.error('Report save error:', err.message);
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
