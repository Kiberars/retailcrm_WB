import * as https from "https";

const RETAIL_CRM_URL = "https://gbc-market.retailcrm.ru";
const RETAIL_CRM_API_KEY = process.env.RETAILCRM_API_KEY || "9M81NTIXg3wr0sgLx0woI2OYfgXrSy6e";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lmbwhoqmgrouoywxvilh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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

function makeRequest(path: string, method: string, data?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, RETAIL_CRM_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "Api-Key": RETAIL_CRM_API_KEY,
      },
    };

    const req = https.request(options, (res: any) => {
      let chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString();
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function fetchOrdersFromRetailCrm(): Promise<RetailCrmOrder[]> {
  console.log("Fetching orders from RetailCRM...");

  const response = await makeRequest("/api/v5/orders", "GET");
  
  if (!response.success) {
    throw new Error(`Failed to fetch orders: ${JSON.stringify(response.errors)}`);
  }

  const orders = response.orders || [];
  console.log(`Found ${orders.length} orders in RetailCRM`);
  
  return orders;
}

function calculateOrderTotal(items: RetailCrmOrder["items"]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.initialPrice, 0);
}

async function supabaseRequest(method: string, path: string, body?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY!,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    };

    const req = https.request(options, (res: any) => {
      let chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        try {
          const bodyStr = Buffer.concat(chunks).toString();
          resolve({ status: res.statusCode, body: JSON.parse(bodyStr) });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function syncOrderToSupabase(order: RetailCrmOrder): Promise<boolean> {
  const totalAmount = calculateOrderTotal(order.items);
  
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

  try {
    // Check if order exists
    const checkResponse = await supabaseRequest(
      "GET",
      `/rest/v1/orders?order_id=eq.${order.externalId || `ORD-${order.id}`}`
    );

    if (checkResponse.body && checkResponse.body.length > 0) {
      // Update existing
      await supabaseRequest(
        "PATCH",
        `/rest/v1/orders?order_id=eq.${order.externalId || `ORD-${order.id}`}`,
        JSON.stringify(orderData)
      );
      console.log(`✓ Updated order ${order.externalId || `ORD-${order.id}`}`);
    } else {
      // Insert new
      await supabaseRequest(
        "POST",
        "/rest/v1/orders",
        JSON.stringify(orderData)
      );
      console.log(`✓ Created order ${order.externalId || `ORD-${order.id}`}`);
    }
    
    return true;
  } catch (error) {
    console.error(`✗ Error syncing order ${order.externalId || `ORD-${order.id}`}:`, error);
    return false;
  }
}

async function main() {
  console.log("=== Syncing orders from RetailCRM to Supabase ===\n");

  try {
    const orders = await fetchOrdersFromRetailCrm();
    
    let successCount = 0;
    let failCount = 0;

    for (const order of orders) {
      const result = await syncOrderToSupabase(order);
      
      if (result) {
        successCount++;
      } else {
        failCount++;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log(`\n=== Summary ===`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total: ${orders.length}`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
