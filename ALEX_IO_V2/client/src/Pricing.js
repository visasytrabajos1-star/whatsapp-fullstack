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
      'Branding Personalizado'
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Tu correo electrónico"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-center text-lg focus:border-blue-500 outline-none"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`bg-slate-800 rounded-2xl p-8 border ${plan.popular ? 'border-blue-500 relative' : 'border-slate-700'}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 px-4 py-1 rounded-full text-sm font-bold">
                  Más Popular
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold mb-6">${plan.price}<span className="text-lg text-slate-400">/mes</span></div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300">
                    <Check size={18} className="text-blue-500" /> {feature}
                  </li>
                ))}
              </ul>

              <div className="space-y-4">
                <div className="flex bg-slate-900 p-1 rounded-lg">
                  <button
                    onClick={() => setPaymentMethod('stripe')}
                    className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 ${paymentMethod === 'stripe' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <CreditCard size={18} /> Card
                  </button>
                  <button
                    onClick={() => setPaymentMethod('crypto')}
                    className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 ${paymentMethod === 'crypto' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Bitcoin size={18} /> Crypto
                  </button>
                </div>

                {paymentMethod === 'crypto' && (
                  <select
                    value={cryptoCurrency}
                    onChange={(e) => setCryptoCurrency(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm outline-none"
                  >
                    <option value="USDT">USDT (TRC20)</option>
                    <option value="BTC">Bitcoin</option>
                    <option value="ETH">Ethereum</option>
                  </select>
                )}

                <button
                  onClick={() => paymentMethod === 'stripe' ? handleStripePayment(plan.id) : handleCryptoPayment(plan.id)}
                  disabled={loading || !email}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${plan.popular ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-700 hover:bg-slate-600'} disabled:opacity-50`}
                >
                  {loading ? (
                    <Loader className="animate-spin mx-auto" size={24} />
                  ) : (
                    `Contratar ${plan.name}`
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {invoice && (
          <div className="mt-12 bg-slate-800 p-8 rounded-2xl border border-yellow-500/30 max-w-2xl mx-auto shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
              <Bitcoin /> Factura Crypto Generada
            </h3>
            <div className="space-y-4">
              <div className="bg-slate-900 p-4 rounded-lg break-all font-mono">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Dirección de pago ({invoice.currency})</p>
                <p className="text-blue-400 text-sm font-bold">{invoice.address}</p>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Monto a enviar:</span>
                <span className="text-xl font-bold text-white">{invoice.amount_crypto} {invoice.currency}</span>
              </div>
              <p className="text-[10px] text-slate-500 italic text-center">
                El plan se activará automáticamente tras 2 confirmaciones en la red.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Pricing;
