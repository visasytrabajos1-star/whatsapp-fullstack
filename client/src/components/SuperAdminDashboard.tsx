import React, { useState, useEffect } from 'react';
import { fetchJsonWithApiFallback, getAuthHeaders } from '../api';
import {
    Users,
    DollarSign,
    Activity,
    ShieldAlert,
    TrendingUp,
    Search,
    MessageCircle,
    Server,
    ArrowUpRight,
    ArrowDownRight,
    MoreVertical
} from 'lucide-react';

interface GlobalStats {
    total_users: number;
    active_bots: number;
    total_revenue: number;
    total_messages: number;
}

const SuperAdminDashboard = () => {
    const [stats, setStats] = useState<GlobalStats>({
        total_users: 0,
        active_bots: 0,
        total_revenue: 0,
        total_messages: 0
    });
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchGlobalData();
    }, []);

    const fetchGlobalData = async () => {
        try {
            setLoading(true);
            const { response, data } = await fetchJsonWithApiFallback('/api/saas/superadmin/clients', {
                headers: { ...getAuthHeaders() }
            });

            if (response.ok && data.clients) {
                const totalMsgs = data.clients.reduce((acc: number, curr: any) => acc + (curr.usage?.messages_sent || 0), 0);
                const totalBots = data.clients.reduce((acc: number, curr: any) => acc + (curr.bots?.length || 0), 0);

                // Simple assumption based on plan for revenue illustration
                const revMap: Record<string, number> = { 'PRO': 29.99, 'ENTERPRISE': 99.99, 'FREE': 0 };
                const revenue = data.clients.reduce((acc: number, curr: any) => acc + (revMap[curr.plan?.toUpperCase()] || 0), 0);

                setClients(data.clients);
                setStats({
                    total_users: data.clients.length,
                    active_bots: totalBots,
                    total_revenue: revenue,
                    total_messages: totalMsgs
                });
            }
        } catch (err: any) {
            console.error("SuperAdmin Error:", err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredClients = clients.filter(c =>
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-slate-400">Accediendo a la Consola de Control de ALEX IO...</div>;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-blue-500">
                        <ShieldAlert size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">SaaS SuperAdmin</span>
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">Consola Global <span className="text-blue-500">ALEX IO</span></h1>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input type="text" placeholder="Buscar por email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64" />
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <MetricCard title="Clientes Registrados" value={stats.total_users} icon={<Users className="text-blue-400" />} trend="+4" isUp={true} />
                <MetricCard title="Bots / Instancias Activas" value={stats.active_bots} icon={<Server className="text-emerald-400" />} trend="+2" isUp={true} />
                <MetricCard title="MRR (Proyectado)" value={`$${Math.round(stats.total_revenue).toLocaleString()}`} icon={<DollarSign className="text-yellow-400" />} trend="+15%" isUp={true} />
                <MetricCard title="Total Mensajes Emitidos" value={stats.total_messages.toLocaleString()} icon={<MessageCircle className="text-purple-400" />} trend="+12%" isUp={true} />
            </div>

            <section className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                    <h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-slate-500" /> Directorio de Entidades (Tenants)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-900/50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-900">
                            <tr>
                                <th className="px-6 py-4">Tenant (Email)</th>
                                <th className="px-6 py-4">Plan & Límite</th>
                                <th className="px-6 py-4">Uso Mensajes</th>
                                <th className="px-6 py-4">Gasto de IA (Tokens)</th>
                                <th className="px-6 py-4">Bots Activos</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                            {filteredClients.map(client => (
                                <tr key={client.id} className="hover:bg-slate-900/40 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-500 font-bold text-xs border border-blue-500/20">{client.email?.[0]?.toUpperCase()}</div>
                                            <div>
                                                <p className="text-sm font-semibold">{client.email}</p>
                                                <p className="text-xs text-slate-500">ID: {client.tenant_id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${client.plan === 'PRO' ? 'bg-yellow-500/10 text-yellow-500' : client.plan === 'ENTERPRISE' ? 'bg-purple-500/10 text-purple-500' : 'bg-slate-800 text-slate-400'}`}>
                                            {client.plan || 'FREE'}
                                        </span>
                                        <div className="text-[10px] text-slate-500 mt-1">Límite: {client.usage?.plan_limit || (client.plan === 'ENTERPRISE' ? 10000 : 500)} msgs</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 w-24">
                                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(((client.usage?.messages_sent || 0) / Math.max(client.usage?.plan_limit || 1, 1)) * 100, 100)}%` }}></div>
                                            </div>
                                            <span className="text-[10px] text-slate-400 text-right">{client.usage?.messages_sent || 0} / {client.usage?.plan_limit || 0}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-xs font-mono text-purple-300">{client.usage?.tokens_consumed ? `${(client.usage.tokens_consumed / 1000).toFixed(1)}k tokens` : '0 tokens'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        {client.bots?.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                {client.bots.map((b: any) => (
                                                    <div key={b.instance_id} className="text-[10px] flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${b.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                        <span className="truncate w-24" title={b.company_name}>{b.company_name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-500 italic">Sin bots</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-600 transition-colors"><MoreVertical size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredClients.length === 0 && <p className="text-center p-8 text-slate-500 italic">No se encontraron clientes.</p>}
                </div>
            </section>
        </div>
    );
};

const MetricCard = ({ title, value, icon, trend, isUp }: any) => (
    <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl shadow-xl hover:border-slate-700 transition-all group">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-slate-900 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
            <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${isUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {trend}
            </div>
        </div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-white">{value}</h4>
    </div>
);

export default SuperAdminDashboard;
