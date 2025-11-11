import express from "express";
import fetch from "node-fetch";
// import fs from "fs"; // <-- BORTTAGEN: Inte längre nödvändig
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================================
// ✅ STEG 1: HÅRDDKODA RAMVERKET DIREKT I KODEN
// Vi tar bort filhantering för att undvika problem med "ramverk.txt" på Render.
// ==========================================================
const RAMVERK_TEXT = `Ramverk för prövning av beslut som rör barn (LVU)
Instruktion: För varje ärende: gå punkt för punkt. Markera Ja / Nej / Delvis och anteckna kort kommentar. För varje kriterium - JÄMFÖR MED PRAXIS (från Google sheet, som du har tillgång till): a) Sök i Google Sheet:en efter fall där liknande situation bedömdes b) Ange hur beslutet förhåller sig till praxisfallet c) Om beslutet BRISTER: referera till fall där myndighet/domstol kritiserades d) Om beslutet är BRA: referera till fall där liknande resonemang godkännes. Inkludera praxisjämförelsen i din motivering för varje kriterium.
`; // Notera: Din text från ramverk.txt slutar här.

// Mellanlager
app.use(express.json());
app.use(express.static(__dirname));

// ✅ STEG 2: ANVÄND DIN NYA, FUNGERANDE NYCKEL SOM FALLBACK
// Om process.env.GEMINI_API_KEY är odefinierad (t.ex. vid lokal körning), används denna.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyAqIlN9fXyfrTw_iwvbVPAw8oduzVseeGs";

// ✅ Huvudsida
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "juridisk-ai.html"));
});

// ✅ Analysera beslut
app.post("/analyze", async (req, res) => {
  console.log("🔹 /analyze-anrop mottaget", new Date().toISOString());
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

    // 2. Förbered prompt med det hårdkodade ramverket (RAMVERK_TEXT)
    const prompt = `Du är en juridisk expert som analyserar beslut om barn enligt det ramverk som tillhandahölls.

RAMVERK FÖR PRÖVNING:
${RAMVERK_TEXT}

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


    // 3️⃣ Skicka till Gemini API
    const geminiResponse = await fetch(
      // VIKTIGT: ANVÄND DEN NYA NYCKELN HÄR
     // Ny, fungerande URL (använder /v1beta/)
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
        }),
      }
    );

    // ✅ Först hämta svaret
    const geminiData = await geminiResponse.json();

    // 🪵 Sedan logga hela svaret för felsökning
    console.log("🔍 Gemini response full data:", JSON.stringify(geminiData, null, 2));

// ✅ Hämta text från svaret (eller felmeddelande)
    let text; // Deklarera 'text' utan ett värde så den kan användas i blocken nedan

    if (geminiData.error) {
        text = `API-fel: ${geminiData.error.message}`;
    } else if (geminiData.candidates && geminiData.candidates.length > 0) {
        // Försök att hämta texten. Om den är tom, säg det
        const responseText = geminiData.candidates[0].content.parts?.[0]?.text;
        if (responseText) {
            text = responseText;
        } else {
            // Om Gemini svarade men texten var tom (t.ex. p.g.a. finishReason)
            text = "Genereringen slutfördes, men ingen text returnerades. Försök med en längre beslutstext eller justera tokens (Finish Reason: " + geminiData.candidates[0].finishReason + ")";
        }
    } else {
        // Fallback om inga fel eller kandidater hittades
        text = "Ett oväntat fel uppstod vid Gemini-anropet.";
    }

    // ✅ Skicka svaret tillbaka till frontend
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
