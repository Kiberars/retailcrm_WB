import * as https from "https";

const RETAIL_CRM_URL = "https://gbc-market.retailcrm.ru";
const RETAIL_CRM_API_KEY = process.env.RETAILCRM_API_KEY || "9M81NTIXg3wr0sgLx0woI2OYfgXrSy6e";

interface OrderItem {
  productName: string;
  quantity: number;
  initialPrice: number;
}

interface Order {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  orderType: string;
  orderMethod: string;
  status: string;
  items: OrderItem[];
  delivery: {
    address: {
      city: string;
      text: string;
    };
  };
  customFields: {
    utm_source: string;
  };
}

function loadOrdersFromFile(): Order[] {
  const fs = require("fs");
  const data = fs.readFileSync("./mock_orders.json", "utf-8");
  return JSON.parse(data);
}

function createRetailCrmOrder(order: Order): any {
  const items = order.items.map((item) => ({
    offer: { name: item.productName },
    quantity: item.quantity,
    initialPrice: item.initialPrice,
  }));

  return {
    firstName: order.firstName,
    lastName: order.lastName,
    phone: order.phone,
    email: order.email,
    orderType: order.orderType,
    orderMethod: order.orderMethod,
    status: order.status,
    items,
    delivery: {
      address: {
        city: order.delivery.address.city,
        text: order.delivery.address.text,
      },
    },
    customFields: {
      utm_source: order.customFields.utm_source,
    },
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

async function createOrderInRetailCrm(order: Order): Promise<boolean> {
  const orderData = createRetailCrmOrder(order);
  const data = JSON.stringify({ order: orderData });

  try {
    const response = await makeRequest("/api/v5/orders/create", "POST", data);
    
    if (response.success) {
      console.log(`✓ Created order for ${order.firstName} ${order.lastName}`);
      return true;
    } else {
      console.error(`✗ Failed to create order for ${order.firstName}:`, response.errors);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error creating order for ${order.firstName}:`, error);
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

    // Small delay between requests
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
