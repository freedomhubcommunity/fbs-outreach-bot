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

function extractReport(text) {
  text = text.trim();
  
  // Format 1: "Kristine 13 April 2026\nConnections: 10\nAccepted: 10\nMessages: 10\nCalls or Appointments: 6"
  let match = text.match(/^([A-Za-z]+)\s+(\d+)\s+([A-Za-z]+)\s+(\d+)\s*\nConnections:\s*(\d+)\s*\nAccepted:\s*(\d+)\s*\nMessages:\s*(\d+)\s*\n(Calls or Appointments|Appointments):\s*(\d+)/i);
  if (match) {
    return {
      name: match[1],
      day: match[2],
      month: match[3],
      year: match[4],
      connections: match[5],
      accepted: match[6],
      messages: match[7],
      appointments: match[8]
    };
  }

  // Format 2: "April 14 - Denis\nConnections: 5\nAccepted: 4\nMessages: 4\nAppointments: 4"
  match = text.match(/^([A-Za-z]+)\s+(\d+)\s*-\s*([A-Za-z]+)\s*\nConnections:\s*(\d+)\s*\nAccepted:\s*(\d+)\s*\nMessages:\s*(\d+)\s*\n(Appointments|Calls):\s*(\d+)/i);
  if (match) {
    return {
      name: match[3],
      day: match[2],
      month: match[1],
      year: '2026',
      connections: match[4],
      accepted: match[5],
      messages: match[6],
      appointments: match[7]
    };
  }

  return null;
}

async function handleTelegram(body) {
  const chat = body.message?.chat;
  if (!chat || chat.id.toString() !== GROUP_ID) return null;
  const text = body.message?.text?.trim() || '';
  const from = body.message?.from?.first_name || 'Unknown';

  const report = extractReport(text);

  if (report) {
    const rawName = report.name.toLowerCase();
    let manager = MANAGERS[rawName] || report.name;
    manager = manager.charAt(0).toUpperCase() + manager.slice(1);
    
    const dateStr = `${report.year}-${monthNum[report.month] || '04'}-${report.day.padStart(2, '0')}`;
    const databaseId = DATABASES[rawName === 'kristine' ? 'kristine' : (rawName === 'denis' ? 'denis' : 'eleonora')];

    if (!databaseId) return { error: 'No database' };

    await fetch('https://api.notion.com/v1/pages', { method: 'POST', headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: JSON.stringify({ parent: { database_id: databaseId }, properties: { 'Name': { title: [{ text: { content: manager } }] }, 'Connections Sent': { number: parseInt(report.connections) }, 'Accepted': { number: parseInt(report.accepted) }, 'Welcome Messages': { number: parseInt(report.messages) }, 'Appointments': { number: parseInt(report.appointments) }, 'Date ': { date: { start: dateStr } } } }) });

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: GROUP_ID, message_thread_id: THREAD_ID, text: `Hi ${manager}! 👋\n\nYour report has been saved to Notion.\n\n📊 Summary:\n• Connections: ${report.connections}\n• Accepted: ${report.accepted}\n• Welcome Messages: ${report.messages}\n• Appointments: ${report.appointments}\n\n📅 Date: ${dateStr}\n\nHave a great day! ✨` }) });

    return { success: true };
  }

  if (!text.match(/^\d/) && !text.match(/^([A-Za-z]+)/)) {
    const helpText = "Hi " + from + "!" + " Here's the format to send your daily report:" + "\n\nKristine 13 April 2026\nConnections: 10\nAccepted: 10\nMessages: 10\nAppointments: 6" + "\n\nOr:" + "\nApril 14 - Denis\nConnections: 5\nAccepted: 4\nMessages: 4\nAppointments: 4" + "\n\nJust fill in your numbers and send it here!";
    
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: GROUP_ID, message_thread_id: THREAD_ID, text: helpText }) });
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