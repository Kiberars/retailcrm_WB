import * as https from "https";
import { URLSearchParams } from "url";

const RETAIL_CRM_URL = "https://kiberars.retailcrm.ru";
const RETAIL_CRM_API_KEY = "9M81NTIXg3wr0sgLx0woI2OYfgXrSy6e";

interface OrderItem {
  name: string;
  quantity: number;
  initialPrice: number;
}

interface Customer {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
}

interface Order {
  id: string;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
  utmSource: string;
  utmMedium?: string;
  utmCampaign?: string;
  status: string;
}

function loadOrdersFromFile(): Order[] {
  const fs = require("fs");
  const data = fs.readFileSync("./mock_orders.json", "utf-8");
  return JSON.parse(data);
}

function createRetailCrmOrder(order: Order): any {
  const items = order.items.map((item) => ({
    offer: { name: item.name },
    quantity: item.quantity,
    initialPrice: item.initialPrice,
  }));

  return {
    externalId: order.id,
    firstName: order.customer.firstName,
    lastName: order.customer.lastName,
    phone: order.customer.phone,
    email: `${order.customer.firstName.toLowerCase()}.${order.customer.lastName.toLowerCase()}@example.com`,
    items,
    delivery: {
      address: {
        city: order.customer.city,
        text: "ул.default 1",
      },
    },
    customFields: {
      utm_source: order.utmSource,
    },
  };
}

function makeRequest(path: string, method: string, data?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, RETAIL_CRM_URL);
    url.searchParams.set("apiKey", RETAIL_CRM_API_KEY);

    const postData = data ? new URLSearchParams(data).toString() : undefined;

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": postData ? Buffer.byteLength(postData) : 0,
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

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function createOrderInRetailCrm(order: Order): Promise<boolean> {
  const orderData = createRetailCrmOrder(order);

  const formData = new URLSearchParams();
  formData.append("order", JSON.stringify(orderData));

  console.log("Order data:", JSON.stringify(orderData, null, 2));

  try {
    let response = await makeRequest("/api/v5/orders/create", "POST", formData.toString());

    if (!response.success && response.errorMsg === "Order already exists.") {
      response = await makeRequest(`/api/v5/orders/${order.id}/edit`, "POST", formData.toString());
    }

    if (response.success) {
      console.log(`✓ Created order ${order.id} for ${order.customer.firstName} ${order.customer.lastName}`);
      return true;
    } else {
      console.error(`✗ Failed to create order ${order.id}:`, response.errorMsg);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error creating order ${order.id}:`, error);
    return false;
  }
}

async function main() {
  console.log("=== Loading orders to RetailCRM ===\n");

  const orders = loadOrdersFromFile();
  console.log(`Found ${orders.length} orders in mock_orders.json\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const result = await createOrderInRetailCrm(order);

    if (result) {
      successCount++;
    } else {
      failCount++;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total: ${orders.length}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
