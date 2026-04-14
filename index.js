const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

console.log("=== СТАРТ ПРИЛОЖЕНИЯ ===");
console.log("PORT =", PORT);
console.log("BOT_TOKEN exists:", !!process.env.TELEGRAM_TOKEN);

app.get('/', (req, res) => {
  res.send('OK Bot server is running');
});

app.post('/webhook', (req, res) => {
  console.log("📨 Webhook received at", new Date().toISOString());
  console.log("Body:", JSON.stringify(req.body, null, 2).substring(0, 500) + "...");
  res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log("Сервер запущен на порту " + PORT);
});