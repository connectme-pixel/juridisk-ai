const apiKey = "AIzaSyAqIlN9fXyfrTw_iwvbVPAw8oduzVseeGs";

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: [{ text: "Säg hej" }] }]
  })
})
.then(res => res.json())
.then(data => console.log("SVAR:", JSON.stringify(data, null, 2)))
.catch(err => console.error("FEL:", err.message));