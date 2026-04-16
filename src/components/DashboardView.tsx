import React from 'react';
import { AppData } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, DollarSign, Users, Clock } from 'lucide-react';

interface DashboardViewProps {
  data: AppData;
}

export default function DashboardView({ data }: DashboardViewProps) {
  const paidOrders = data.orders.filter(o => o.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = paidOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Mock chart data
  const salesData = [
    { name: 'Lun', sales: 400 },
    { name: 'Mar', sales: 300 },
    { name: 'Mer', sales: 600 },
    { name: 'Gio', sales: 800 },
    { name: 'Ven', sales: 1200 },
    { name: 'Sab', sales: 1500 },
    { name: 'Dom', sales: 1100 },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-primary tracking-tight uppercase">Dashboard</h2>
        <p className="text-text-muted text-sm font-medium">Panoramica delle performance aziendali</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          icon={<DollarSign size={22} />} 
          label="Incasso Totale" 
          value={`€${totalRevenue.toFixed(2)}`} 
          trend="+12.5%" 
          color="blue"
        />
        <StatCard 
          icon={<TrendingUp size={22} />} 
          label="Ordini Totali" 
          value={totalOrders.toString()} 
          trend="+5.2%" 
          color="green"
        />
        <StatCard 
          icon={<Clock size={22} />} 
          label="Scontrino Medio" 
          value={`€${avgOrderValue.toFixed(2)}`} 
          trend="-2.1%" 
          color="amber"
        />
        <StatCard 
          icon={<Users size={22} />} 
          label="Clienti Oggi" 
          value="42" 
          trend="+18.3%" 
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-[400px]">
        <div className="panel-card flex flex-col">
          <h3 className="text-sm font-bold text-primary mb-6 uppercase tracking-widest">Andamento Vendite Settimanali</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3182ce" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3182ce" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#718096', fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#718096', fontWeight: 700 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#3182ce" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-card flex flex-col">
          <h3 className="text-sm font-bold text-primary mb-6 uppercase tracking-widest">Prodotti più Venduti</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Margherita', value: 45 },
                { name: 'Diavola', value: 32 },
                { name: 'Birra Media', value: 28 },
                { name: 'Acqua', value: 20 },
                { name: 'Caffè', value: 15 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#718096', fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#718096', fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f7fafc' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Bar dataKey="value" fill="#3182ce" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="panel-card">
      <div className={`w-10 h-10 ${colors[color]} rounded-lg flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{label}</p>
        <span className={`text-[10px] font-bold ${trend.startsWith('+') ? 'text-success' : 'text-danger'}`}>
          {trend}
        </span>
      </div>
      <p className="text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}
