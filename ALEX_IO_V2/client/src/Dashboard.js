import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Activity, Settings, Smartphone, Plus, Loader, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fetchWithApiFallback, getLastResolvedApiBase, getPreferredApiBase } from './api';

function Dashboard() {
  const [instances, setInstances] = useState([
    { id: 1, name: 'Mi Negocio', status: 'online', phone: '+1234567890' }
  ]);
  const [selected, setSelected] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [apiDebugUrl, setApiDebugUrl] = useState(getPreferredApiBase() || 'No resuelta');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const resolved = getLastResolvedApiBase();
    if (resolved) setApiDebugUrl(resolved);
  }, []);

  const pushNotice = (type, message) => {
    setNotice({ type, message });
  };

  const waitForQr = (instanceId) => new Promise((resolve, reject) => {
    const timeoutMs = 120000;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const statusRes = await fetchWithApiFallback(`/api/saas/status/${instanceId}`);
        setApiDebugUrl(getLastResolvedApiBase() || getPreferredApiBase() || 'No resuelta');

        if (!statusRes.ok) return;

        const statusData = await statusRes.json();
        if (statusData.qr_code) {
          clearInterval(intervalId);
          return resolve({ type: 'qr', value: statusData.qr_code });
        }

        if (statusData.status === 'online') {
          clearInterval(intervalId);
          return resolve({ type: 'online' });
        }

        if (statusData.status === 'disconnected') {
          clearInterval(intervalId);
          return reject(new Error('WhatsApp desconectó la sesión durante el enlace. Reintenta.'));
        }
      } catch (_) {
        // keep polling
      }

      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(intervalId);
        reject(new Error('No se recibió QR a tiempo. Verifica backend/WhatsApp y reintenta.'));
      }
    };

    const intervalId = setInterval(poll, 5000);
    poll();
  });

  const handleCreateNew = async () => {
    const rawName = prompt('Nombre de tu nuevo bot:');
    const name = (rawName || '').trim();
    if (!name) return;

    setConnecting(true);
    setNotice(null);

    try {
      const res = await fetchWithApiFallback('/api/saas/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: name, customPrompt: `Eres un asistente virtual de ${name}` })
      });

      setApiDebugUrl(getLastResolvedApiBase() || getPreferredApiBase() || 'No resuelta');
      const data = await res.json();

      if (!res.ok && res.status !== 408) {
        throw new Error(data.error || `Error de conexión (HTTP ${res.status})`);
      }

      let qr = data.qr_code;

      if (!qr && res.status === 408 && data.instance_id) {
        pushNotice('warning', 'Conexión lenta detectada: intentando recuperar QR automáticamente...');
        const result = await waitForQr(data.instance_id);

        if (result.type === 'online') {
          setInstances((prev) => [...prev, {
            id: Date.now(),
            name,
            status: 'online',
            phone: 'Conectado'
          }]);
          pushNotice('success', 'La instancia se conectó correctamente sin requerir nuevo QR.');
          return;
        }

        qr = result.value;
      }

      if (!qr) {
        throw new Error(data.error || 'No se recibió código QR.');
      }

      setQrCode(qr);
      setInstances((prev) => [...prev, {
        id: Date.now(),
        name,
        status: 'connecting',
        phone: 'Escaneando QR...'
      }]);
      pushNotice('success', 'QR generado correctamente. Escanéalo para finalizar conexión.');
    } catch (error) {
      pushNotice('error', error.message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      {qrCode && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-xl text-center max-w-sm w-full">
            <h2 className="text-2xl font-bold mb-4">Escanea el QR</h2>
            <img src={qrCode} alt="QR" className="border-4 border-white p-2 rounded mb-4 mx-auto" />
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

      {notice && (
        <div className={`mx-6 mt-4 p-3 rounded-lg border text-sm flex items-center gap-2 ${notice.type === 'error'
            ? 'bg-red-900/30 border-red-700 text-red-200'
            : notice.type === 'warning'
              ? 'bg-yellow-900/20 border-yellow-700 text-yellow-200'
              : 'bg-green-900/20 border-green-700 text-green-200'
          }`}>
          {notice.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.message}</span>
        </div>
      )}

      <main className="flex h-[calc(100vh-64px)]">
        <aside className="w-64 bg-slate-950 border-r border-slate-800 p-4">
          <h2 className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-4">Mis Bots</h2>
          <div className="space-y-2">
            {instances.map((inst) => (
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

      <footer className="fixed bottom-2 right-3 text-[11px] text-slate-400 bg-slate-950/90 border border-slate-800 px-2 py-1 rounded">
        API activa: {apiDebugUrl}
      </footer>
    </div>
  );
}

export default Dashboard;
