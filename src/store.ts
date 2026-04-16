import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppData, Order, Ingredient } from './types';

let socket: Socket;

export function useStore() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial data
    fetch('/api/data')
      .then(res => res.json())
      .then(initialData => {
        setData(initialData);
        setLoading(false);
      });

    // Setup Socket.io
    socket = io();

    socket.on('order:new', (newOrder: Order) => {
      setData(prev => prev ? { ...prev, orders: [...prev.orders, newOrder] } : null);
    });

    socket.on('order:update', (updatedOrder: Order) => {
      setData(prev => prev ? {
        ...prev,
        orders: prev.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o)
      } : null);
    });

    socket.on('inventory:update', (newInventory: Ingredient[]) => {
      setData(prev => prev ? { ...prev, inventory: newInventory } : null);
    });

    socket.on('data:update', (newData: AppData) => {
      setData(newData);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createOrder = async (order: Partial<Order>) => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const newOrder = await res.json();
    // Refresh data to get updated table status
    const dataRes = await fetch('/api/data');
    const updatedData = await dataRes.json();
    setData(updatedData);
    return newOrder;
  };

  const updateOrder = async (id: string, updates: Partial<Order>) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.json();
  };

  const payTable = async (tableId: string) => {
    const res = await fetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
    });
    const result = await res.json();
    if (result.success) {
      const dataRes = await fetch('/api/data');
      const updatedData = await dataRes.json();
      setData(updatedData);
    }
    return result;
  };

  return { data, loading, createOrder, updateOrder, payTable };
}
