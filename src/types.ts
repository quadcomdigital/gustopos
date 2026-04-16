export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minThreshold: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  ingredients: string[];
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  table: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'paid';
  timestamp: string;
  staffId: string;
}

export interface Staff {
  id: string;
  name: string;
  role: 'admin' | 'waiter' | 'chef';
  pin: string;
}

export interface Table {
  id: string;
  number: string;
  status: 'free' | 'occupied' | 'reserved';
  currentOrderId?: string;
}

export interface AppData {
  orders: Order[];
  inventory: Ingredient[];
  menu: MenuItem[];
  staff: Staff[];
  tables: Table[];
}
