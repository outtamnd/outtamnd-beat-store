const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    let beatsList = items.filter(item => item.type === 'beat' || !item.type);
    let otherList = items.filter(item => item.type && item.type !== 'beat');

    // Apply bundle discount logic matching frontend
    beatsList.sort((a, b) => a.price - b.price);

    let beatCount = beatsList.length;
    let freeBeatsCount = 0;
    if (beatCount >= 4) freeBeatsCount = 3;
    else if (beatCount >= 3) freeBeatsCount = 2;
    else if (beatCount >= 2) freeBeatsCount = 1;

    const line_items = [];

    beatsList.forEach((item, index) => {
      let price = item.price;
      if (index < freeBeatsCount) {
        price = 0; // Free beat in bundle
      }
      if (price > 0) {
        line_items.push({
          price_data: {
            currency: 'usd',
            product_data: { name: item.title },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        });
      }
    });

    otherList.forEach(item => {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: { name: item.title },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: 1,
      });
    });

    if (line_items.length === 0) {
      return res.status(400).json({ error: 'No billable items in cart' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${req.headers.origin}/?success=true`,
      cancel_url: `${req.headers.origin}/?canceled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe backend error:', err);
    return res.status(500).json({ error: err.message });
  }
}