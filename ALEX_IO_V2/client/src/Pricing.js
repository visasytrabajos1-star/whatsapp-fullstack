import React, { useState } from 'react';
import { Check, CreditCard, Bitcoin, Loader } from 'lucide-react';
import { fetchWithApiFallback } from './api';

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 29,
    features: [
      '1 Número de WhatsApp',
      '1,000 Mensajes al mes',
      'IA Básica (Gemini)',
      'Soporte por Email',
      'Panel de Control'
    ]
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 79,
    popular: true,
    features: [
      '3 Números de WhatsApp',
      '10,000 Mensajes al mes',
      'IA Avanzada + Fallback',
      'Soporte Prioritario',
      'Panel de Control',
      'Integración CRM',
      'Multi-idioma'
    ]
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 199,
    features: [
      'Números Ilimitados',
      'Mensajes Ilimitados',
      'IA Premium + Memoria',
      'Soporte 24/7',
      'API Access',
      'Multi-idioma',
      'Account Manager'
    ]
  }
];

function Pricing() {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [cryptoCurrency, setCryptoCurrency] = useState('USDT');
  const [invoice, setInvoice] = useState(null);
  const [email, setEmail] = useState('');

  const handleStripePayment = async (planId) => {
    setLoading(true);
    try {
      const res = await fetchWithApiFallback('/api/payments/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: planId })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setLoading(false);
  };

  const handleCryptoPayment = async (planId) => {
    setLoading(true);
    try {
      const res = await fetchWithApiFallback('/api/payments/crypto/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: planId, currency: cryptoCurrency })
      });
      const data = await res.json();
      setInvoice(data);
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Elige tu Plan <span className="text-blue-500">ALEX IO</span></h1>
          <p className="text-slate-400">Escala tu negocio con WhatsApp + IA</p>
        </div>

        {/* Email Input */}
        <div className="max-w-md mx-auto mb-8">
          <input
            type="email"
            placeholder="Tu correo electrónico"
            className="w-full p-3 rounded bg-slate-800 border border-slate-700 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan) => (
            <div key={plan.id} className={`relative bg-slate-800 rounded-2xl p-8 border ${plan.popular ? 'border-blue-500' : 'border-slate-700'}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-xs font-bold px-3 py-1 rounded-full">
                  MÁS POPULAR
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold mb-6">${plan.price}<span className="text-lg text-slate-400">/mes</span></div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300">
                    <Check size={18} className="text-green-500" /> {feature}
                  </li>
                ))}
              </ul>

              {invoice && selectedPlan === plan.id ? (
                <div className="bg-slate-900 p-4 rounded-lg text-sm">
                  <p className="text-yellow-500 font-bold mb-2">📄 Invoice Generado</p>
                  <p className="mb-1">Envía exactamente:</p>
                  <p className="text-xl font-mono text-green-400 mb-2">{invoice.amount_crypto} {invoice.currency}</p>
                  <p className="mb-1">A esta dirección:</p>
                  <p className="font-mono text-xs break-all text-slate-400">{invoice.wallet}</p>
                </div>
              ) : (
                <button
                  onClick={() => { setSelectedPlan(plan.id); setInvoice(null); }}
                  disabled={!email || loading}
                  className={`w-full py-3 rounded-lg font-bold transition ${plan.popular ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'} disabled:opacity-50`}
                >
                  {loading ? <Loader className="animate-spin mx-auto" /> : 'Contratar Ahora'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Payment Method Selection */}
        {selectedPlan && !invoice && (
          <div className="max-w-md mx-auto mt-8 bg-slate-800 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4">Método de Pago</h3>
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setPaymentMethod('stripe')}
                className={`flex-1 p-3 rounded flex items-center justify-center gap-2 ${paymentMethod === 'stripe' ? 'bg-blue-600' : 'bg-slate-700'}`}
              >
                <CreditCard size={20} /> Tarjeta
              </button>
              <button
                onClick={() => setPaymentMethod('crypto')}
                className={`flex-1 p-3 rounded flex items-center justify-center gap-2 ${paymentMethod === 'crypto' ? 'bg-orange-600' : 'bg-slate-700'}`}
              >
                <Bitcoin size={20} /> Cripto
              </button>
            </div>

            {paymentMethod === 'crypto' && (
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">Selecciona Criptomoneda</label>
                <div className="flex gap-2">
                  {['BTC', 'USDT', 'ETH'].map(curr => (
                    <button
                      key={curr}
                      onClick={() => setCryptoCurrency(curr)}
                      className={`px-4 py-2 rounded ${cryptoCurrency === curr ? 'bg-orange-600' : 'bg-slate-700'}`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => paymentMethod === 'stripe' ? handleStripePayment(selectedPlan) : handleCryptoPayment(selectedPlan)}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 py-3 rounded font-bold"
            >
              {loading ? 'Procesando...' : paymentMethod === 'stripe' ? 'Pagar con Stripe' : 'Generar Invoice'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Pricing;
