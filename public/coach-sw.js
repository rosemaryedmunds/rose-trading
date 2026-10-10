// Service worker: shows coach notifications and handles button taps without opening the page.
const ICON = "/images/coach-192.png";

function show(d) {
  return self.registration.showNotification(d.title || "Coach", {
    body: d.body,
    tag: "coach",          // replaces the previous coach notification instead of stacking
    renotify: true,        // but still buzzes
    icon: ICON,
    actions: d.actions || [],
  });
}

self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(show(d));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();

  // Tapped the notification body: open (or focus) the chat.
  if (!e.action) {
    e.waitUntil((async () => {
      const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = wins.find((w) => new URL(w.url).pathname.startsWith("/coach"));
      return existing ? existing.focus() : clients.openWindow("/coach/");
    })());
    return;
  }

  // Tapped a button: send it to the coach and show the reply as a new notification.
  e.waitUntil((async () => {
    await show({ title: "Coach", body: "Reading that..." });
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub && sub.endpoint, button: e.action }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      await show({ title: "Coach", body: data.reply, actions: data.actions });
    } catch {
      await show({ title: "Coach", body: "Couldn't reach the coach. Tap to open the chat." });
    }
  })());
});
