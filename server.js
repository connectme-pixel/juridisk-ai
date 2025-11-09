import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Läs in ramverket
const ramverkText = fs.readFileSync(
  path.join(__dirname, "ramverk.txt"),
  "utf-8"
);

// Mellanlager
app.use(express.json());
app.use(express.static(__dirname));

// ✅ Din Gemini API-nyckel här (lägg till i .env i framtiden)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyAOuRquGjmSIENTHks8E6e2TauGcbtaQwc";

// ✅ Huvudsida
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "juridisk-ai.html"));
});

// ✅ Analysera beslut
app.post("/analyze", async (req, res) => {
  try {
    const { csvUrl, decisionText } = req.body;
    if (!csvUrl || !decisionText) {
      return res.status(400).json({ error: "Saknar CSV URL eller beslutstext" });
    }

    // 1. Hämta Google Sheets-data
    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      return res.status(500).json({ error: "Kunde inte hämta CSV-data" });
    }
    const csvText = await csvResponse.text();

    // 2. Förbered prompt med ramverket
    const prompt = `Du är en juridisk expert som analyserar beslut om barn enligt det ramverk som tillhandahölls.

RAMVERK FÖR PRÖVNING:
${ramverkText}

JURIDISKA KÄLLOR (från databas):
${csvText}

BESLUTET SOM SKA ANALYSERAS:
${decisionText}

INSTRUKTION:
Analysera beslutet enligt ramverkets 6 kriterier. PRESENTERA SVARET MED TYDLIGA RUBRIKER OCH KORT TEXT - INTE LÅNGA STYCKEN.

Format:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYS AV BESLUTET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. RÄTTSSÄKERHET OCH OBJEKTIVITET
Status: [JA / NEJ / DELVIS]
Finns: [Kort bullet-punkt vad som finns]
Saknas: [Kort bullet-punkt vad som saknas]
Lagrum: [Relevant lag/referens]

## 2. LAGLIGHET (RÄTTSLIG GRUND)
Status: [JA / NEJ / DELVIS]
Finns: [Kort bullet-punkt]
Saknas: [Kort bullet-punkt]
Lagrum: [Relevant lag/referens]

[... samma format för kriterium 3-6]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## SAMMANFATTNING

Övergripande bedömning: [En mening]

Huvudsakliga brister:
• [Brist 1]
• [Brist 2]
• [Brist 3 om applicerbar]

Konventionskonflikter:
[Artikel + praxis, t.ex. "EKMR art. 8 - Se Kutzner v. Germany"]

## REKOMMENDATION

[Konkret åtgärd 1]
[Konkret åtgärd 2]
[Konkret åtgärd 3]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VIKTIGT: 
- Var kortfattad och tydlig
- Använd bullet-punkter istället för långa texter
- Status ska vara framträdande (JA/NEJ/DELVIS)
- Bara det väsentligaste, inget onödigt
- För beslutsfattare som behöver snabb överblick`;

    // 3. Skicka till Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1500 },
        }),
      }
    );

    const geminiData = await geminiResponse.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Inget svar från Gemini";
    res.json({ result: text });
  } catch (err) {
    console.error("Fel i /analyze:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Starta server
app.listen(PORT, () => {
  console.log(`✅ Backend körs på http://localhost:${PORT}`);
  console.log(`📁 Serverar filer från: ${__dirname}`);
});