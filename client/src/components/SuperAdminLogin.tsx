import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, Mail, Loader2 } from 'lucide-react';

const SuperAdminLogin = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Master Credentials Lockdown
        if (email.trim().toLowerCase() === 'admin@alex.io' && password === 'AlexAdmin2026') {
            setTimeout(() => {
                localStorage.setItem('alex_io_token', 'master-superadmin-token-bypass');
                localStorage.setItem('demo_email', 'admin@alex.io');
                localStorage.setItem('alex_io_role', 'SUPERADMIN');
                navigate('/superadmin');
                window.location.reload();
            }, 800);
        } else {
            setTimeout(() => {
                setError('Credenciales de SuperAdmin Incorrectas.');
                setLoading(false);
            }, 500);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mb-4 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                        <ShieldAlert size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">ALEX IO SuperAdmin</h1>
                    <p className="text-slate-500 text-sm mt-1">Consola de Control de Producción</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Admin Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="admin@alex.io"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Master Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="••••••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl text-center font-semibold">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'ACCEDER A PRODUCCIÓN'}
                    </button>
                </form>

                <p className="text-center text-slate-600 text-[10px] mt-8 uppercase tracking-widest font-bold">
                    Acceso Restringido • Auditoría Activa
                </p>
            </div>
        </div>
    );
};

export default SuperAdminLogin;
