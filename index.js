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
  
  // Simple number extraction - just look for digits
  let connMatch = text.match(/Connections[^0-9]*([0-9]+)/i);
  let accMatch = text.match(/Accepted[^0-9]*([0-9]+)/i);
  let msgMatch = text.match(/Messages[^0-9]*([0-9]+)/i);
  let aptMatch = text.match(/Appointments[^0-9]*([0-9]+)/i);
  
  if (!connMatch || !accMatch || !msgMatch || !aptMatch) return null;
  
  // Try different formats for name and date
  let match;
  
  // Format: April 14 - Denis
  match = text.match(/^([A-Za-z]+) ([0-9]+) - ([A-Za-z]+)/i);
  if (match) {
    return { name: match[3], day: match[2], month: match[1], year: '2026', connections: connMatch[1], accepted: accMatch[1], messages: msgMatch[1], appointments: aptMatch[1] };
  }
  
  // Format: Report from me\nApril 14 - Denis
  match = text.match(/Report from me\n([A-Za-z]+) ([0-9]+) - ([A-Za-z]+)/i);
  if (match) {
    return { name: match[3], day: match[2], month: match[1], year: '2026', connections: connMatch[1], accepted: accMatch[1], messages: msgMatch[1], appointments: aptMatch[1] };
  }
  
  // Format: Report from me\nApril 14 (defaults to Denis)
  match = text.match(/Report from me\n([A-Za-z]+) ([0-9]+)/i);
  if (match) {
    return { name: 'Denis', day: match[2], month: match[1], year: '2026', connections: connMatch[1], accepted: accMatch[1], messages: msgMatch[1], appointments: aptMatch[1] };
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
    
    const dateStr = report.year + '-' + (monthNum[report.month] || '04') + '-' + report.day.padStart(2, '0');
    const databaseId = DATABASES[rawName === 'kristine' ? 'kristine' : (rawName === 'denis' ? 'denis' : 'eleonora')];

    if (!databaseId) return { error: 'No database' };

    await fetch('https://api.notion.com/v1/pages', { method: 'POST', headers: { 'Authorization': 'Bearer ' + NOTION_TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: JSON.stringify({ parent: { database_id: databaseId }, properties: { 'Name': { title: [{ text: { content: manager } }] }, 'Connections Sent': { number: parseInt(report.connections) }, 'Accepted': { number: parseInt(report.accepted) }, 'Welcome Messages': { number: parseInt(report.messages) }, 'Appointments': { number: parseInt(report.appointments) }, 'Date ': { date: { start: dateStr } } } }) });

    const dbUrls = { 'kristine': 'https://www.notion.so/freedomsummit/3414f30891408093a737ea2e0b504fd6', 'eleonora': 'https://www.notion.so/freedomsummit/3414f308914080d4a939df57ee71f07c', 'denis': 'https://www.notion.so/freedomsummit/3414f3089140802c8954f5683857f5dc' };
    const dbUrl = dbUrls[rawName === 'kristine' ? 'kristine' : (rawName === 'denis' ? 'denis' : 'eleonora')];

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';
    const dateTimeStr = dateStr + ' ' + timeStr;
    
    const responseText = 'Hi ' + manager + '! Your report has been saved to Notion.\n\nSummary:\nConnections: ' + report.connections + '\nAccepted: ' + report.accepted + '\nWelcome Messages: ' + report.messages + '\nAppointments: ' + report.appointments + '\nDate & Time: ' + dateTimeStr + '\n\nView in Notion: ' + dbUrl + '\n\nHave a great day!';
    
    await fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: GROUP_ID, message_thread_id: THREAD_ID, text: responseText }) });

    return { success: true };
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