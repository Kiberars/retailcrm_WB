import { NextRequest, NextResponse } from "next/server";

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
    const body = await request.json();
    const order: RetailCrmOrder = body.order;

    if (!order) {
      return NextResponse.json(
        { error: "No order data provided" },
        { status: 400 }
      );
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
