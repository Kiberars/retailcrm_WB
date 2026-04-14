import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  try {
    console.log("Webhook called");
    console.log("Token available:", !!TELEGRAM_BOT_TOKEN);
    
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

    console.log("Webhook received:", orderData.order_id, "Amount:", totalAmount);

    if (totalAmount >= ORDER_ALERT_THRESHOLD && TELEGRAM_BOT_TOKEN) {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        try {
          const { Bot } = await import("grammy");
          const bot = new Bot(TELEGRAM_BOT_TOKEN);

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
          console.log("Telegram notification sent");
        } catch (tgError) {
          console.error("Telegram error:", tgError);
        }
      } else {
        console.log("TELEGRAM_CHAT_ID not set, skipping notification");
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}