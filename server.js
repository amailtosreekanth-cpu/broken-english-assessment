const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');

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

const SCORE_LABELS = ['Fluency','Grammar','Vocabulary','Pronunciation','Confidence','Comprehension','Coherence'];
const SCORE_KEYS   = ['fluency','grammar','vocabulary','pronunciation','confidence','listening','coherence'];
const BAR_COLORS   = ['#378ADD','#1D9E75','#7F77DD','#D85A30','#EF9F27','#D4537E','#639922'];
const CEFR_COLORS  = {A1:'#E24B4A',A2:'#EF9F27',B1:'#378ADD',B2:'#7F77DD',C1:'#1D9E75',C2:'#639922'};

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

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}

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
      const numColor = val>=8?'#4CAF50':val>=5?'#333
