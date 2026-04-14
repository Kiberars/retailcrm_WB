import { Bot, InlineKeyboard } from "grammy";
import "dotenv/config";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8544220778:AAFmlIw7N3G53uw93w0hkVxhEXUQE-KhGZw";
const ORDER_ALERT_THRESHOLD = parseInt(process.env.ORDER_ALERT_THRESHOLD || "50000", 10);

const bot = new Bot(TELEGRAM_BOT_TOKEN);

interface OrderData {
  order_id: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  total_amount: number;
  utm_source: string;
  created_at: string;
}

async function notifyNewOrder(order: OrderData) {
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!chatId) {
    console.log("TELEGRAM_CHAT_ID not set, skipping notification");
    return;
  }

  if (order.total_amount < ORDER_ALERT_THRESHOLD) {
    console.log(`Order ${order.order_id} (${order.total_amount} ₸) is below threshold, skipping notification`);
    return;
  }

  const message = `
🔔 Новый крупный заказ!

👤 Клиент: ${order.customer_name}
📱 Телефон: ${order.customer_phone}
💰 Сумма: ${order.total_amount.toLocaleString("ru-RU")} ₸
🏙️ Город: ${order.city}
📊 UTM: ${order.utm_source}
🕐 Дата: ${new Date(order.created_at).toLocaleString("ru-RU")}
  `.trim();

  try {
    await bot.api.sendMessage(chatId, message);
    console.log(`✓ Notification sent for order ${order.order_id}`);
  } catch (error) {
    console.error(`✗ Failed to send notification:`, error);
  }
}

async function sendTestNotification() {
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!chatId) {
    console.log("Please set TELEGRAM_CHAT_ID in .env.local");
    console.log("To find your chat ID: @userinfobot on Telegram");
    return;
  }

  const testOrder: OrderData = {
    order_id: "TEST-001",
    customer_name: "Тест Тестов",
    customer_phone: "+77000000000",
    city: "Алматы",
    total_amount: 75000,
    utm_source: "instagram",
    created_at: new Date().toISOString(),
  };

  await notifyNewOrder(testOrder);
}

if (require.main === module) {
  console.log("=== Telegram Bot for GBC Analytics ===\n");
  console.log(`Threshold: ${ORDER_ALERT_THRESHOLD.toLocaleString("ru-RU")} ₸\n`);
  
  if (process.argv.includes("--test")) {
    sendTestNotification();
  } else {
    console.log("Run with --test to send test notification");
  }
}

export { bot, notifyNewOrder, sendTestNotification };