const apiKey = "AIzaSyAqIlN9fXyfrTw_iwvbVPAw8oduzVseeGs";

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
.then(res => res.json())
.then(data => {
  console.log("TILLGÄNGLIGA MODELLER:");
  data.models?.forEach(m => console.log(" -", m.name));
})
.catch(err => console.error("FEL:", err.message));