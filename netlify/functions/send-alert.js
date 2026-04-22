// netlify/functions/send-alert.js
// Sends a push notification via OneSignal REST API v1
// Uses newer API key format with 'Key' prefix instead of 'Basic'

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

  if (!appId || !restApiKey) {
    console.error('Missing env vars: ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY');
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 });
  }

  const payload = {
    app_id:            appId,
    included_segments: ['All'],
    headings:          { en: title },
    contents:          { en: message },
  };

  console.log('Sending to OneSignal:', JSON.stringify(payload));

  // Try 'Key' prefix first (newer API keys), fall back handled by logging
  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Key ${restApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log('OneSignal response:', JSON.stringify(data));

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, id: data.id }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/.netlify/functions/send-alert' };