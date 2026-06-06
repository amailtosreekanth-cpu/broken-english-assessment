# 🎙️ Broken English — Assessment Tool
## Deploy Guide (Free, 20 minutes)

---

## What you're deploying
- Trainer-facing web app: 3-step student assessment
- Auto-saves every submission to Google Sheets
- Live records dashboard for counselors
- Free hosting on Railway.app
- Free domain: `your-app.railway.app`

---

## STEP 1 — Create the Google Sheet

1. Go to https://sheets.google.com
2. Create a new sheet → name it **"BE Assessments"**
3. Add a tab called **"Assessments"** (rename Sheet1)
4. Copy the URL — find the Sheet ID between `/d/` and `/edit`:
   Example: `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit`
   Sheet ID = `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`

---

## STEP 2 — Create a Google Service Account

1. Go to https://console.cloud.google.com
2. Create a new project (name it "broken-english-app")
3. In the search bar, search **"Google Sheets API"** → Enable it
4. Go to **APIs & Services → Credentials**
5. Click **"+ Create Credentials" → Service Account**
   - Name: `broken-english-sheets`
   - Click Create → Done (skip optional steps)
6. Click on the service account you just created
7. Go to **Keys** tab → **Add Key → Create new key → JSON**
8. A JSON file downloads — keep it safe

---

## STEP 3 — Share the Sheet with the Service Account

1. Open your Google Sheet
2. Click **Share**
3. Enter the service account email (looks like `broken-english-sheets@your-project.iam.gserviceaccount.com`)
   → You find this email in the JSON file at `"client_email"`
4. Give it **Editor** access → Share

---

## STEP 4 — Push to GitHub

1. Create a free GitHub account at https://github.com if you don't have one
2. Create a new repository called `broken-english-assessment`
3. Upload all files from this folder (or use GitHub Desktop)

---

## STEP 5 — Deploy on Railway (Free)

1. Go to https://railway.app → Sign up with GitHub
2. Click **"New Project" → "Deploy from GitHub repo"**
3. Select `broken-english-assessment`
4. Railway auto-detects Node.js — it will deploy!
5. Go to **Variables** tab → Add these two:

**Variable 1:**
```
Name:  GOOGLE_SERVICE_ACCOUNT_JSON
Value: (paste the entire contents of the JSON file you downloaded)
```

**Variable 2:**
```
Name:  GOOGLE_SHEET_ID
Value: (your sheet ID from Step 1)
```

6. Railway will redeploy automatically
7. Go to **Settings → Networking → Generate Domain**
8. Your app is live at: `https://broken-english-assessment.up.railway.app`

---

## STEP 6 — Share with your trainers

Send them the Railway URL. That's it. Every assessment they submit:
- Appears instantly in your Google Sheet
- Trainer sees the report + radar chart right away
- Counselor opens the Sheet to see all records

---

## Your Google Sheet columns (auto-created)

| Column | What it stores |
|--------|---------------|
| Timestamp | When submitted |
| Student Name | — |
| Phone/ID | — |
| Trainer | Who did the assessment |
| Date | Assessment date |
| Background | Student's occupation |
| CEFR Level | A1 to C2 |
| Fluency | Score 1-10 |
| Grammar | Score 1-10 |
| Vocabulary | Score 1-10 |
| Pronunciation | Score 1-10 |
| Confidence | Score 1-10 |
| Comprehension | Score 1-10 |
| Coherence | Score 1-10 |
| Overall Avg | Auto-calculated |
| Filler Words | List of observed fillers |
| Strengths | Trainer notes |
| Areas to Improve | Trainer notes |
| Recommended Course | Which course pitched |

---

## Cost summary

| Item | Cost |
|------|------|
| Railway hosting | Free (500 hrs/month) |
| Google Sheets | Free |
| Google Cloud APIs | Free (well within limits) |
| Domain | Free (.railway.app subdomain) |
| **Total** | **₹0** |

---

## Upgrade later (optional)

- Custom domain like `assess.brokenenglish.in` → ₹800/year
- Railway paid plan for always-on hosting → $5/month (~₹420)
- Add Claude AI to auto-generate counselor pitch from scores → ~₹3/report

---

Built for Broken English by Sreekanth KG
