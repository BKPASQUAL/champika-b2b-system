// app/dashboard/admin/orders/loading/types.ts

import { Order } from "../types";

export interface DeliveryLoad {
  id: string;
  loadId: string; // e.g., LOAD-2025-001
  date: string;
  lorryNumber: string;
  driver: string;
  helper?: string;
  status: "In Transit" | "Completed";
  orders: Order[]; // The orders in this load
  totalOrders: number;
}

export const MOCK_DRIVERS = [
  { id: "D1", name: "Saman Kumara" },
  { id: "D2", name: "Kamal Perera" },
  { id: "D3", name: "Nimal Siripala" },
];

export const MOCK_LORRIES = [
  { id: "L1", number: "WP LG-4567" },
  { id: "L2", number: "WP CB-1122" },
  { id: "L3", number: "SP NA-8890" },
];

export const MOCK_DELIVERY_HISTORY: DeliveryLoad[] = [
  {
    id: "DL-1",
    loadId: "LOAD-2025-001",
    date: "2025-02-18",
    lorryNumber: "WP LG-4567",
    driver: "Saman Kumara",
    helper: "Sunil",
    status: "Completed",
    totalOrders: 5,
    orders: [],
  },
  {
    id: "DL-2",
    loadId: "LOAD-2025-002",
    date: "2025-02-19",
    lorryNumber: "WP CB-1122",
    driver: "Kamal Perera",
    status: "In Transit",
    totalOrders: 3,
    orders: [],
  },
];
