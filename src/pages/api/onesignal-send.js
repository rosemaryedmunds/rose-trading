export const POST = async ({ request }) => {
  try {
    const { message } = await request.json();

    // These should be set in your Netlify Environment Variables
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;

    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        // Send to everyone tagged as 'isPaid'
        filters: [{ field: "tag", key: "isPaid", relation: "=", value: "true" }],
        headings: { en: "Premium SPX Alert 🚨" },
        contents: { en: message },
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ error: data }), { status: 400 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};