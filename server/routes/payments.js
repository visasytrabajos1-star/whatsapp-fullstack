const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const cryptoService = require('../services/cryptoPaymentService');

// --- STRIPE ROUTES ---

// Crear sesión de pago Stripe
router.post('/stripe/checkout', async (req, res) => {
    try {
        const { email, plan } = req.body; // plan: STARTER, PRO, ENTERPRISE
        
        const PRICES = {
            'STARTER': process.env.STRIPE_PRICE_STARTER,
            'PRO': process.env.STRIPE_PRICE_PRO,
            'ENTERPRISE': process.env.STRIPE_PRICE_ENTERPRISE
        };

        const priceId = PRICES[plan];
        if (!priceId) return res.status(400).json({ error: 'Plan inválido' });

        const session = await paymentService.createCheckoutSession(
            email,
            priceId,
            `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            `${process.env.FRONTEND_URL}/pricing`
        );

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook de Stripe
router.post('/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
        const event = paymentService.constructWebhookEvent(req.body, sig);

        // Manejar eventos
        const session = event.data.object;
        const email = session.customer_email || session.metadata?.email;
        const tenantId = session.metadata?.tenantId;

        switch (event.type) {
            case 'checkout.session.completed':
                console.log('✅ Pago completado:', email);
                if (isSupabaseEnabled && email) {
                    // Update user plan based on metadata or price
                    const planMap = {
                        [process.env.STRIPE_PRICE_STARTER]: 'STARTER',
                        [process.env.STRIPE_PRICE_PRO]: 'PRO',
                        [process.env.STRIPE_PRICE_ENTERPRISE]: 'ENTERPRISE'
                    };
                    const plan = planMap[session.line_items?.[0]?.price?.id] || 'PRO';
                    const limit = plan === 'ENTERPRISE' ? 10000 : (plan === 'PRO' ? 3000 : 1000);

                    await supabase.from('app_users').update({ plan }).eq('email', email);
                    await supabase.from('tenant_usage_metrics').upsert({
                        tenant_id: tenantId || `tenant_${Buffer.from(email).toString('base64').substring(0, 8)}`,
                        plan_limit: limit,
                        updated_at: new Date().toISOString()
                    });
                }
                break;
            case 'customer.subscription.deleted':
                console.log('❌ Suscripción cancelada:', email);
                if (isSupabaseEnabled && email) {
                    await supabase.from('app_users').update({ plan: 'FREE' }).eq('email', email);
                }
                break;
        }

        res.json({ received: true });
    } catch (err) {
        console.error('❌ Webhook Error:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

// --- CRYPTO ROUTES ---

// Obtener direcciones de pago
router.get('/crypto/addresses', (req, res) => {
    res.json(cryptoService.getPaymentAddresses());
});

// Crear factura Crypto
router.post('/crypto/invoice', async (req, res) => {
    try {
        const { email, plan, currency } = req.body; // currency: BTC, USDT, ETH
        const invoice = await cryptoService.createInvoice(email, plan, currency);
        res.json(invoice);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verificar estado de pago Crypto
router.get('/crypto/invoice/:id', async (req, res) => {
    try {
        const status = await cryptoService.verifyPayment(req.params.id);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
