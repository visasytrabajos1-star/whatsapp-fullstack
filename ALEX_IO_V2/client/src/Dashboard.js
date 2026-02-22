import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Activity, Settings, Smartphone, Plus, Loader } from 'lucide-react';
import { fetchWithApiFallback } from './api';

function Dashboard() {
  const [instances, setInstances] = useState([
    { id: 1, name: 'Mi Negocio', status: 'online', phone: '+1234567890' }
  ]);
  const [selected, setSelected] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [debugApi, setDebugApi] = useState('Detectando...'); // Added for debug visibility

  const handleCreateNew = async () => {
    const name = prompt("Nombre de tu nuevo bot:");
    if (!name) return;

    setConnecting(true);
    try {
      const res = await fetchWithApiFallback('/api/saas/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: name, customPrompt: 'Eres un asistente virtual de ' + name })
      });

      const data = await res.json();

      if (data.qr_code) {
        setQrCode(data.qr_code);
        addPendingInstance(name, data.instance_id);
      } else if (data.instance_id) {
        // We have an instanceId (either from 200 async or 408 timeout), start polling
        addPendingInstance(name, data.instance_id);
        startPolling(data.instance_id);
      } else {
        alert('Error al conectar: ' + (data.error || 'No se pudo iniciar la instancia'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setConnecting(false);
  };

  const addPendingInstance = (name, instanceId) => {
    setInstances(prev => [...prev, {
      id: instanceId,
      name,
      status: 'connecting',
      phone: 'Iniciando...'
    }]);
  };

  const startPolling = (instanceId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetchWithApiFallback(`/api/saas/status/${instanceId}`);
        const data = await res.json();

        // QR detected during polling
        if (data.qr_code && !qrCode) {
          setQrCode(data.qr_code);
          setInstances(prev => prev.map(inst =>
            inst.id === instanceId ? { ...inst, status: 'qr_ready', phone: 'QR Listo para Escaneo' } : inst
          ));
        }

        // Success: Connection established
        if (data.status === 'online') {
          console.log(`✅ Bot ${instanceId} is now ONLINE! Stopping polling.`);
          clearInterval(interval);
          setQrCode(null);
          setInstances(prev => prev.map(inst =>
            inst.id === instanceId ? { ...inst, status: 'online', phone: 'Conectado' } : inst
          ));
          alert("¡Bot conectado con éxito!");
        }

        // Failure: Disconnected or expired
        if (data.status === 'disconnected') {
          console.warn(`🛑 Bot ${instanceId} disconnected. Polling stopped.`);
          clearInterval(interval);
          setInstances(prev => prev.map(inst =>
            inst.id === instanceId ? { ...inst, status: 'disconnected', phone: 'Fallo al conectar' } : inst
          ));
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000);

    // Safety check: stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      console.log("⏰ Polling auto-stopped after 5min.");
    }, 300000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      {qrCode && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-xl text-center">
            <h2 className="text-2xl font-bold mb-4">Escanea el QR</h2>
            <img src={qrCode} alt="QR" className="border-4 border-white p-2 rounded mb-4" />
            <button onClick={() => setQrCode(null)} className="text-blue-500">Cerrar</button>
          </div>
        </div>
      )}

      <header className="bg-slate-950 border-b border-slate-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Shield className="text-blue-500" size={28} />
          <h1 className="text-2xl font-bold">ALEX <span className="text-blue-500">IO</span></h1>
        </div>
        <div className="flex gap-4">
          <Link to="/pricing" className="bg-blue-600 px-4 py-2 rounded font-bold hover:bg-blue-500">
            Planes
          </Link>
        </div>
      </header>

      <main className="flex h-[calc(100vh-64px)]">
        <aside className="w-64 bg-slate-950 border-r border-slate-800 p-4">
          <h2 className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-4">Mis Bots</h2>
          <div className="space-y-2">
            {instances.map(inst => (
              <button
                key={inst.id}
                onClick={() => setSelected(inst)}
                className={`w-full text-left p-3 rounded-lg flex items-center justify-between ${selected?.id === inst.id ? 'bg-blue-600' : 'bg-slate-900 hover:bg-slate-800'}`}
              >
                <div>
                  <div className="font-medium">{inst.name}</div>
                  <div className="text-xs text-slate-400">{inst.phone}</div>
                </div>
                <div className={`w-2 h-2 rounded-full ${inst.status === 'online' ? 'bg-green-500' : inst.status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`} />
              </button>
            ))}
          </div>
          <button
            onClick={handleCreateNew}
            disabled={connecting}
            className="w-full mt-4 py-2 border border-dashed border-slate-700 text-slate-500 rounded-lg hover:border-blue-500 hover:text-blue-500 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {connecting ? <Loader className="animate-spin" size={16} /> : <Plus size={16} />}
            Nuevo Bot
          </button>
        </aside>

        <div className="flex-1 p-6 overflow-auto">
          {selected ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Settings size={20} className="text-blue-500" /> Configuración
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Nombre del Bot</label>
                    <input className="w-full bg-slate-900 border border-slate-700 rounded p-2" defaultValue={selected.name} />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Prompt Personalizado</label>
                    <textarea
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 h-32"
                      defaultValue="Eres un asistente virtual amigable y profesional."
                    />
                  </div>
                  <button className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold">Guardar</button>
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Activity size={20} className="text-green-500" /> Actividad Reciente
                </h3>
                <div className="space-y-3">
                  <div className="bg-slate-900 p-3 rounded border border-slate-800 text-sm">
                    <p className="text-slate-300">"Quiero información"</p>
                    <p className="text-blue-400 mt-1 text-xs">Respondido por gemini-flash</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Smartphone size={64} className="mb-4 opacity-20" />
              <p>Selecciona un bot para comenzar</p>
            </div>
          )}
        </div>
      </main>

      {/* Debug Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 p-2 text-[10px] text-slate-600 flex justify-between px-4">
        <span>v2.1.2 SaaS Core</span>
        <span onMouseEnter={() => setDebugApi(localStorage.getItem('last_api_hit') || 'Auto')}>
          📡 API: <span className="text-slate-400">{debugApi}</span>
        </span>
      </footer>
    </div>
  );
}

export default Dashboard;
