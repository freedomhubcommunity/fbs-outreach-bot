const { Telegraf } = require('telegraf');
const dotenv = require('dotenv');

dotenv.config();

console.log("=== БОТ ЗАПУСКАЕТСЯ ===");
console.log("BOT_TOKEN существует:", !!process.env.TELEGRAM_TOKEN);
console.log("PORT =", process.env.PORT);
console.log("RAILWAY_PUBLIC_DOMAIN =", process.env.RAILWAY_PUBLIC_DOMAIN);

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.on('message', async (ctx) => {
  console.log("📨 Получено сообщение от", ctx.from?.id, ":", ctx.message?.text?.substring(0, 50));
  try {
    await ctx.reply("✅ Бот работает! Получил твоё сообщение.");
  } catch (e) {
    console.error("Ошибка reply:", e.message);
  }
});

const startBot = async () => {
  const port = process.env.PORT || 8080;
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;

  console.log(`Запуск на порту ${port}, domain: ${domain || 'нет'}`);

  if (domain) {
    try {
      await bot.launch({
        webhook: {
          domain: domain,
          hookPath: '/webhook',
          port: port
        }
      });
      console.log(`🚀 Webhook успешно установлен на https://${domain}/webhook`);
    } catch (err) {
      console.error("❌ Ошибка запуска webhook:", err.message);
    }
  } else {
    bot.launch();
    console.log('🚀 Запущен в polling-режиме (локально)');
  }
};

startBot().catch(err => {
  console.error("КРИТИЧЕСКАЯ ОШИБКА ЗАПУСКА:", err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));