import { NextRequest, NextResponse } from "next/server";
import { Bot } from "grammy";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ORDER_ALERT_THRESHOLD = parseInt(process.env.ORDER_ALERT_THRESHOLD || "50000", 10);

interface RetailCrmOrder {
  id: number;
  externalId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  status: { code: string; name: string };
  createdAt: string;
  sum: number;
  items: Array<{
    offer: { name: string };
    quantity: number;
    initialPrice: number;
  }>;
  delivery: {
    address: {
      city: string;
    };
  };
  customFields: {
    utm_source: string;
  };
}

async function sendTelegramNotification(order: RetailCrmOrder, totalAmount: number) {
  if (!TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.log("Telegram not configured, skipping notification");
    return;
  }

  const bot = new Bot(TELEGRAM_BOT_TOKEN);
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const message = `
🔔 Новый крупный заказ!

👤 Клиент: ${order.firstName} ${order.lastName}
📱 Телефон: ${order.phone}
💰 Сумма: ${totalAmount.toLocaleString("ru-RU")} ₸
🏙️ Город: ${order.delivery?.address?.city || "Неизвестно"}
📊 UTM: ${order.customFields?.utm_source || "direct"}
🕐 Дата: ${new Date(order.createdAt).toLocaleString("ru-RU")}
  `.trim();

  await bot.api.sendMessage(chatId, message);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const order: RetailCrmOrder = body.order;

    if (!order) {
      return NextResponse.json({ error: "No order data provided" }, { status: 400 });
    }

    const totalAmount = order.items.reduce(
      (sum, item) => sum + item.quantity * item.initialPrice,
      0
    );

    const orderData = {
      order_id: order.externalId || `ORD-${order.id}`,
      customer_name: `${order.firstName} ${order.lastName}`.trim(),
      customer_phone: order.phone,
      customer_email: order.email,
      city: order.delivery?.address?.city || "-",
      total_amount: totalAmount,
      utm_source: order.customFields?.utm_source || "direct",
      status: order.status?.code || "new",
      created_at: order.createdAt,
      raw_data: JSON.stringify(order),
    };

    console.log("Webhook received:", orderData.order_id);

    if (totalAmount >= ORDER_ALERT_THRESHOLD) {
      await sendTelegramNotification(order, totalAmount);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}