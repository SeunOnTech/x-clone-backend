/**
 * send-stream-event.ts
 * ------------------------------------------------------------
 * Emits a test event to the X Clone stream API (for Windows)
 * ------------------------------------------------------------
 */

async function sendEvent(type: string, payload: any) {
  const response = await fetch("http://localhost:4000/api/stream/emit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Failed:", errorText);
    return;
  }

  const data = await response.json();
  console.log("✅ Event sent successfully:", data.event);
}

(async () => {
  await sendEvent("tweet", {
    user: "seun",
    text: "🔥 First streamed tweet from X Clone!",
  });

  await sendEvent("tweet", {
    user: "konfam_bot",
    text: "🚀 Real-time streaming now working perfectly!",
  });
})();
