// netlify/functions/send-alert.js
// Sends a push notification via OneSignal REST API
// Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in Netlify environment variables

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { title, message } = await req.json();

  if (!title || !message) {
    return new Response('Missing title or message', { status: 400 });
  }

  const appId      = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  const payload = {
    app_id:             appId,
    included_segments:  ['All'], // Change to 'All' for testing
    headings:           { en: title },
    contents:           { en: message },
  };

  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Basic ${restApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, id: data.id }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/.netlify/functions/send-alert' };
