const { Telegraf } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const GROUP_CHAT_ID = Number(process.env.GROUP_ID) || -1003167408263;
const THREAD_ID = Number(process.env.THREAD_ID) || 1132;

const DATABASES = {
  'kristine': process.env.NOTION_DB_KRISTINE || '',
  'eleonora': process.env.NOTION_DB_ELEONORA || '',
  'denis': process.env.NOTION_DB_DENIS || ''
};

const MANAGERS = { 'eleonora': 'Eleonora', 'kristine': 'Kristine', 'el': 'Eleonora', 'elena': 'Eleonora', 'denis': 'Denis' };
const monthNum = { 'January': '01', 'February': '02', 'March': '03', 'April': '04', 'May': '05', 'June': '06', 'July': '07', 'August': '08', 'September': '09', 'October': '10', 'November': '11', 'December': '12' };

function parseReport(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
  let date = null;
  let name = null;
  const metrics = {};

  lines.forEach(line => {
    const dateNameMatch = line.match(/^(.+?)\s*[-–—]\s*(.+)$/i);
    if (dateNameMatch && !date) {
      date = dateNameMatch[1].trim();
      name = dateNameMatch[2].trim();
      return;
    }

    const metricMatch = line.match(/^([A-Za-zA-Z\s]+?)\s*[-:]?\s*(\d+)$/i);
    if (metricMatch) {
      const key = metricMatch[1].trim().replace(/\s+/g, ' ');
      metrics[key] = parseInt(metricMatch[2]);
    }
  });

  return { date: date || new Date().toLocaleDateString(), name: name || 'Unknown', metrics };
}

bot.on('message', async (ctx) => {
  const msg = ctx.message;
  if (!msg) return;
  
  const chatId = msg.chat.id;
  if (chatId !== GROUP_CHAT_ID) return;

  const text = (msg.text || msg.caption || '').trim();

  try {
    const parsed = parseReport(text);
    console.log('Parsed:', parsed);

    if (!parsed.metrics.Connections && !parsed.metrics.Accepted) return;

    const rawName = parsed.name.toLowerCase();
    let manager = MANAGERS[rawName] || parsed.name;
    manager = manager.charAt(0).toUpperCase() + manager.slice(1);

    let dateStr = new Date().toISOString().split('T')[0];
    if (parsed.date) {
      const dateMatch = parsed.date.match(/([A-Za-z]+)\s+(\d+)/i);
      if (dateMatch) {
        const month = monthNum[dateMatch[1]] || '04';
        dateStr = '2026-' + month + '-' + dateMatch[2].padStart(2, '0');
      }
    }

    const databaseId = DATABASES[rawName === 'kristine' ? 'kristine' : (rawName === 'denis' ? 'denis' : 'eleonora')];
    if (!databaseId) throw new Error('No database for ' + rawName);

    const notionData = {
      parent: { database_id: databaseId },
      properties: {
        'Name': { title: [{ text: { content: manager } }] },
        'Date ': { date: { start: dateStr } }
      }
    };

    if (parsed.metrics.Connections) notionData.properties['Connections Sent'] = { number: parsed.metrics.Connections };
    if (parsed.metrics.Accepted) notionData.properties['Accepted'] = { number: parsed.metrics.Accepted };
    if (parsed.metrics.Messages) notionData.properties['Welcome Messages'] = { number: parsed.metrics.Messages };
    if (parsed.metrics.Appointments) notionData.properties['Appointments'] = { number: parsed.metrics.Appointments };

    await axios.post('https://api.notion.com/v1/pages', notionData, {
      headers: { 'Authorization': 'Bearer ' + NOTION_TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }
    });

    const dbUrls = { 'kristine': 'https://www.notion.so/freedomsummit/3414f30891408093a737ea2e0b504fd6', 'eleonora': 'https://www.notion.so/freedomsummit/3414f308914080d4a939df57ee71f07c', 'denis': 'https://www.notion.so/freedomsummit/3414f3089140802c8954f5683857f5dc' };
    const dbUrl = dbUrls[rawName === 'kristine' ? 'kristine' : (rawName === 'denis' ? 'denis' : 'eleonora')];

    const responseText = 'Hi ' + manager + '! Your report has been saved to Notion.\n\nSummary:\nConnections: ' + (parsed.metrics.Connections || 0) + '\nAccepted: ' + (parsed.metrics.Accepted || 0) + '\nWelcome Messages: ' + (parsed.metrics.Messages || 0) + '\nAppointments: ' + (parsed.metrics.Appointments || 0) + '\n\nView in Notion: ' + dbUrl + '\n\nHave a great day!';

    await ctx.reply(responseText, { reply_to_message_id: msg.message_id });
    console.log('Report saved:', manager);

  } catch (error) {
    console.error('Error:', error.message);
    try {
      await ctx.reply('Error saving report. Please try again.', { reply_to_message_id: msg.message_id });
    } catch (e) {}
  }
});

// Start bot
const startBot = async () => {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RENDER_EXTERNAL_URL;
  
  if (domain) {
    await bot.launch({
      webhook: {
        domain: domain,
        hookPath: '/webhook',
        port: process.env.PORT || 8080
      }
    });
    console.log('Webhook: https://' + domain + '/webhook');
  } else {
    bot.launch();
    console.log('Polling mode');
  }
};

startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));