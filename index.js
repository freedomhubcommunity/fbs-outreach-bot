const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

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
  
  let connMatch = text.match(/Connections[^0-9]*([0-9]+)/i);
  let accMatch = text.match(/Accepted[^0-9]*([0-9]+)/i);
  let msgMatch = text.match(/Messages[^0-9]*([0-9]+)/i);
  let aptMatch = text.match(/Appointments[^0-9]*([0-9]+)/i);
  
  if (!connMatch || !accMatch || !msgMatch || !aptMatch) return null;
  
  let match;
  match = text.match(/^([A-Za-z]+) ([0-9]+) - ([A-Za-z]+)/i);
  if (match) return { name: match[3], day: match[2], month: match[1], year: '2026', connections: connMatch[1], accepted: accMatch[1], messages: msgMatch[1], appointments: aptMatch[1] };
  
  match = text.match(/Report from me\n([A-Za-z]+) ([0-9]+) - ([A-Za-z]+)/i);
  if (match) return { name: match[3], day: match[2], month: match[1], year: '2026', connections: connMatch[1], accepted: accMatch[1], messages: msgMatch[1], appointments: aptMatch[1] };
  
  match = text.match(/Report from me\n([A-Za-z]+) ([0-9]+)/i);
  if (match) return { name: 'Denis', day: match[2], month: match[1], year: '2026', connections: connMatch[1], accepted: accMatch[1], messages: msgMatch[1], appointments: aptMatch[1] };

  return null;
}

app.post('/webhook', async (req, res) => {
  const msg = req.body.message;
  if (!msg) return res.status(200).send('OK');

  const chatId = msg.chat.id;
  const text = msg.text?.trim() || '';
  const from = msg.from?.first_name || 'Unknown';

  if (String(chatId) !== GROUP_ID) return res.status(200).send('OK');

  const report = extractReport(text);

  if (report) {
    const rawName = report.name.toLowerCase();
    let manager = MANAGERS[rawName] || report.name;
    manager = manager.charAt(0).toUpperCase() + manager.slice(1);
    
    const dateStr = report.year + '-' + (monthNum[report.month] || '04') + '-' + report.day.padStart(2, '0');
    const databaseId = DATABASES[rawName === 'kristine' ? 'kristine' : (rawName === 'denis' ? 'denis' : 'eleonora')];

    if (!databaseId) return res.status(200).send('No database');

    try {
      await axios.post('https://api.notion.com/v1/pages', {
        parent: { database_id: databaseId },
        properties: {
          'Name': { title: [{ text: { content: manager } }] },
          'Connections Sent': { number: parseInt(report.connections) },
          'Accepted': { number: parseInt(report.accepted) },
          'Welcome Messages': { number: parseInt(report.messages) },
          'Appointments': { number: parseInt(report.appointments) },
          'Date ': { date: { start: dateStr } }
        }
      }, { headers: { 'Authorization': 'Bearer ' + NOTION_TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' } });

      const dbUrls = { 'kristine': 'https://www.notion.so/freedomsummit/3414f30891408093a737ea2e0b504fd6', 'eleonora': 'https://www.notion.so/freedomsummit/3414f308914080d4a939df57ee71f07c', 'denis': 'https://www.notion.so/freedomsummit/3414f3089140802c8954f5683857f5dc' };
      const dbUrl = dbUrls[rawName === 'kristine' ? 'kristine' : (rawName === 'denis' ? 'denis' : 'eleonora')];

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';
      const dateTimeStr = dateStr + ' ' + timeStr;
      
      const responseText = 'Hi ' + manager + '! Your report has been saved to Notion.\n\nSummary:\nConnections: ' + report.connections + '\nAccepted: ' + report.accepted + '\nWelcome Messages: ' + report.messages + '\nAppointments: ' + report.appointments + '\nDate & Time: ' + dateTimeStr + '\n\nView in Notion: ' + dbUrl + '\n\nHave a great day!';
      
      await axios.post('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
        chat_id: chatId,
        message_thread_id: THREAD_ID,
        text: responseText,
        reply_to_message_id: msg.message_id
      });

      console.log('Report saved:', manager);
    } catch (error) {
      console.error('Error:', error.message);
      try {
        await axios.post('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
          chat_id: chatId,
          message_thread_id: THREAD_ID,
          text: 'Error saving report. Please try again.',
          reply_to_message_id: msg.message_id
        });
      } catch (e) {}
    }
  }

  res.status(200).send('OK');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('Bot running on port ' + PORT);
});