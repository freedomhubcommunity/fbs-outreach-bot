const http = require('http');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const GROUP_ID = process.env.GROUP_ID || '-1003167408263';
const THREAD_ID = parseInt(process.env.THREAD_ID) || 1132;

const DATABASES = {
  'kristine': process.env.NOTION_DB_KRISTINE || '',
  'eleonora': process.env.NOTION_DB_ELEONORA || '',
  'denis': process.env.NOTION_DB_DENIS || ''
};

const MANAGERS = { 'eleonora': 'Eleonora', 'kristine': 'Kristine', 'el': 'Eleonora', 'elena': 'Eleonora', 'denis': 'Denis' };
const monthNum = { 'January': '01', 'February': '02', 'March': '03', 'April': '04', 'May': '05', 'June': '06', 'July': '07', 'August': '08', 'September': '09', 'October': '10', 'November': '11', 'December': '12' };

async function handleTelegram(body) {
  const chat = body.message?.chat;
  if (!chat || chat.id.toString() !== GROUP_ID) return null;
  const text = body.message?.text?.trim() || '';
  const from = body.message?.from?.first_name || 'Unknown';

  const match = text.match(/^([A-Za-z]+)\s+(\d+)\s+([A-Za-z]+)\s+(\d+)\s*\nConnections:\s*(\d+)\s*\nAccepted:\s*(\d+)\s*\nMessages:\s*(\d+)\s*\n(Calls or Appointments|Appointments):\s*(\d+)/i);

  if (match) {
    const rawName = match[1].toLowerCase();
    const manager = MANAGERS[rawName] || match[1];
    const dateStr = `${match[4]}-${monthNum[match[3]] || '01'}-${match[2].padStart(2, '0')}`;
    const databaseId = DATABASES[rawName === 'kristine' ? 'kristine' : (rawName === 'denis' ? 'denis' : 'eleonora')];

    if (!databaseId) return { error: 'No database' };

    await fetch('https://api.notion.com/v1/pages', { method: 'POST', headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: JSON.stringify({ parent: { database_id: databaseId }, properties: { 'Name': { title: [{ text: { content: manager } }] }, 'Connections Sent': { number: parseInt(match[5]) }, 'Accepted': { number: parseInt(match[6]) }, 'Welcome Messages': { number: parseInt(match[7]) }, 'Appointments': { number: parseInt(match[8]) }, 'Date ': { date: { start: dateStr } } } }) });

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: GROUP_ID, message_thread_id: THREAD_ID, text: `✅ ${manager}, thanks! Data saved.\n📅 ${dateStr}\n🔗 ${match[5]} → ✅ ${match[6]} → 💬 ${match[7]} → 📅 ${match[8]}` }) });

    return { success: true };
  }

  if (!text.match(/^\d/)) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: GROUP_ID, message_thread_id: THREAD_ID, text: `Hey ${from}! 👋 Use:\nKristine 13 April 2026\nConnections: 10\nAccepted: 10\nMessages: 10\nCalls or Appointments: 6` }) });
  }

  return { parsed: false };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (data.message) res.end(JSON.stringify(await handleTelegram(data) || { ok: true }));
        else res.end(JSON.stringify({ ok: true }));
      } catch (e) { res.end(JSON.stringify({ error: e.message })); }
    });
  } else res.end(JSON.stringify({ ok: true }));
});

server.listen(8080, () => console.log('Bot running on port 8080'));