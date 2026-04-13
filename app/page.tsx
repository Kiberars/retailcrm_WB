import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface Order {
  id: number;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  total_amount: number;
  utm_source: string;
  status: string;
  created_at: string;
}

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  topCity: string;
}

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE"];

async function getOrders(): Promise<Order[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
}

async function getStats(): Promise<Stats> {
  const orders = await getOrders();
  if (orders.length === 0) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      avgOrderValue: 0,
      topCity: "-",
    };
  }

  const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const avgOrderValue = Math.round(totalRevenue / orders.length);

  const cityCounts: Record<string, number> = {};
  orders.forEach((o) => {
    cityCounts[o.city] = (cityCounts[o.city] || 0) + 1;
  });
  const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  return {
    totalOrders: orders.length,
    totalRevenue,
    avgOrderValue,
    topCity,
  };
}

function prepareUtmData(orders: Order[]) {
  const utmCounts: Record<string, number> = {};
  orders.forEach((o) => {
    const source = o.utm_source || "direct";
    utmCounts[source] = (utmCounts[source] || 0) + 1;
  });
  return Object.entries(utmCounts).map(([name, value]) => ({ name, value }));
}

function prepareCityData(orders: Order[]) {
  const cityCounts: Record<string, number> = {};
  orders.forEach((o) => {
    cityCounts[o.city] = (cityCounts[o.city] || 0) + 1;
  });
  return Object.entries(cityCounts).map(([name, value]) => ({ name, value }));
}

function prepareOrdersByDate(orders: Order[]) {
  const dateCounts: Record<string, number> = {};
  orders.forEach((o) => {
    const date = o.created_at.split("T")[0];
    dateCounts[date] = (dateCounts[date] || 0) + 1;
  });
  return Object.entries(dateCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, orders: number]) => ({ date, orders }));
}

export default async function Page() {
  const orders = await getOrders();
  const stats = await getStats();
  const utmData = prepareUtmData(orders);
  const cityData = prepareCityData(orders);
  const ordersByDate = prepareOrdersByDate(orders);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Всего заказов"
          value={stats.totalOrders.toString()}
          icon="📦"
        />
        <StatCard
          title="Выручка"
          value={`${stats.totalRevenue.toLocaleString("ru-RU")} ₸`}
          icon="💰"
        />
        <StatCard
          title="Средний чек"
          value={`${stats.avgOrderValue.toLocaleString("ru-RU")} ₸`}
          icon="📊"
        />
        <StatCard title="Топ город" value={stats.topCity} icon="🏙️" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Заказы по UTM</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={utmData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {utmData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Заказы по городам</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={cityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded-lg shadow lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Динамика заказов</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ordersByDate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                  })
                }
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={{ fill: "#82ca9d" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Последние заказы</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Клиент
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Город
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Сумма
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  UTM
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Дата
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.slice(0, 10).map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {order.order_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {order.customer_name}
                    <br />
                    <span className="text-gray-500 text-xs">
                      {order.customer_phone}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {order.city}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {order.total_amount.toLocaleString("ru-RU")} ₸
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {order.utm_source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Нет данных о заказах
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center">
        <span className="text-2xl mr-3">{icon}</span>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
