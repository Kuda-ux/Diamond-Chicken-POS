export type UserRole = 'admin' | 'manager' | 'cashier' | 'kitchen';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export type PaymentMethod = 'cash' | 'ecocash' | 'innbucks' | 'zipit' | 'visa' | 'mastercard';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface User {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  pin: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  prepTimeMinutes: number;
  sortOrder: number;
}

export interface Inventory {
  id: string;
  menuItemId: string;
  quantity: number;
  lowStockThreshold: number;
  unit: string;
  lastUpdated: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  cashierId: string;
  status: OrderStatus;
  orderType: OrderType;
  tableNumber: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: string;
  modifiers: Record<string, any>;
  subtotal: string;
}

export interface OrderWithItems extends Order {
  items: (OrderItem & { menuItem: MenuItem })[];
  cashier: Pick<User, 'id' | 'name'>;
}

export interface Receipt {
  id: string;
  orderId: string;
  receiptNumber: string;
  printedAt: string | null;
  printedBy: string | null;
}

export interface Shift {
  id: string;
  cashierId: string;
  startedAt: string;
  endedAt: string | null;
  openingFloat: string;
  closingFloat: string | null;
}

export interface DailyReport {
  id: string;
  reportDate: string;
  totalOrders: number;
  totalRevenue: string;
  totalTax: string;
  totalDiscounts: string;
  paymentBreakdown: Record<PaymentMethod, string>;
  topItems: Array<{ itemId: string; itemName: string; quantity: number; revenue: string }>;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  errors?: any[];
}

export interface PaymentResult {
  success: boolean;
  reference: string;
  method: PaymentMethod;
  amount: number;
  change?: number;
  message: string;
  pollUrl?: string;
  qrData?: string;
  redirectUrl?: string;
}

export interface CreateOrderRequest {
  orderType: OrderType;
  tableNumber?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    modifiers?: Record<string, any>;
  }>;
  discountAmount?: number;
  notes?: string;
}

export interface PaymentRequest {
  orderId: string;
  method: PaymentMethod;
  amountTendered?: number;
  phoneNumber?: string;
}

export interface SocketEvents {
  'order:new': (data: { order: OrderWithItems }) => void;
  'order:status': (data: { orderId: string; status: OrderStatus; orderNumber: string }) => void;
  'order:ready': (data: { orderId: string; orderNumber: string; tableNumber: string | null }) => void;
  'order:cancelled': (data: { orderId: string; orderNumber: string }) => void;
  'inventory:low': (data: { itemId: string; itemName: string; quantity: number }) => void;
  'payment:confirmed': (data: { orderId: string; method: PaymentMethod; reference: string }) => void;
}
