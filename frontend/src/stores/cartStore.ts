import { create } from 'zustand';
import Decimal from 'decimal.js';

interface CartItem {
  menuItemId: string;
  name: string;
  price: string;
  quantity: number;
  modifiers?: Record<string, any>;
}

interface CartState {
  items: CartItem[];
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber: string;
  notes: string;
  discountAmount: number;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  setOrderType: (type: 'dine_in' | 'takeaway' | 'delivery') => void;
  setTableNumber: (table: string) => void;
  setNotes: (notes: string) => void;
  setDiscount: (amount: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  orderType: 'takeaway',
  tableNumber: '',
  notes: '',
  discountAmount: 0,

  addItem: (item) => set((state) => {
    const existing = state.items.find(i => i.menuItemId === item.menuItemId);
    if (existing) {
      return {
        items: state.items.map(i =>
          i.menuItemId === item.menuItemId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      };
    }
    return { items: [...state.items, { ...item, quantity: 1 }] };
  }),

  removeItem: (menuItemId) => set((state) => ({
    items: state.items.filter(i => i.menuItemId !== menuItemId),
  })),

  updateQuantity: (menuItemId, quantity) => set((state) => {
    if (quantity <= 0) {
      return { items: state.items.filter(i => i.menuItemId !== menuItemId) };
    }
    return {
      items: state.items.map(i =>
        i.menuItemId === menuItemId ? { ...i, quantity } : i
      ),
    };
  }),

  setOrderType: (orderType) => set({ orderType }),
  setTableNumber: (tableNumber) => set({ tableNumber }),
  setNotes: (notes) => set({ notes }),
  setDiscount: (discountAmount) => set({ discountAmount }),
  clearCart: () => set({
    items: [],
    orderType: 'takeaway',
    tableNumber: '',
    notes: '',
    discountAmount: 0,
  }),

  getSubtotal: () => {
    const state = get();
    return state.items.reduce((sum, item) => {
      const price = new Decimal(item.price);
      const itemTotal = price.times(item.quantity);
      return sum + itemTotal.toNumber();
    }, 0);
  },

  getTax: () => {
    const state = get();
    const subtotal = new Decimal(state.getSubtotal());
    const discount = new Decimal(state.discountAmount);
    const taxableAmount = subtotal.minus(discount);
    const taxRate = new Decimal(0.15);
    return taxableAmount.times(taxRate).toNumber();
  },

  getTotal: () => {
    const state = get();
    const subtotal = new Decimal(state.getSubtotal());
    const discount = new Decimal(state.discountAmount);
    const tax = new Decimal(state.getTax());
    return subtotal.minus(discount).plus(tax).toNumber();
  },
}));
