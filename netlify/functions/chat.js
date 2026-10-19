const SYSTEM_PROMPT = `You are the website assistant for Novusstack, a digital development studio.
Services: business websites, e-commerce stores with Razorpay payments, and AI chatbots.
Starting prices: Starter website INR 25,000. E-commerce store INR 60,000. AI chatbot is custom-priced.
Contact: novusstacks@gmail.com, Monday to Saturday, 10:00 to 19:00 IST.
Answer briefly and politely. For a quote, ask for the customer's name, email and project details, or suggest the contact form on the website.
Reply in the same language the user writes in (English, Tamil or Tanglish).`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {statusCode: 405, body: JSON.stringify({error: "Method not allowed"})};
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {statusCode: 400, body: JSON.stringify({error: "Invalid JSON"})};
  }

  // Keep only the last 10 messages and cap each message length
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({role: m.role, content: m.content.slice(0, 1000)}));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return {statusCode: 400, body: JSON.stringify({error: "No user message"})};
  }

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{role: "system", content: SYSTEM_PROMPT}, ...history],
        max_tokens: 400,
        temperature: 0.5,
      }),
    });

    if (!r.ok) {
      console.error("Groq error", r.status, await r.text());
      return {statusCode: 502, body: JSON.stringify({error: "AI unavailable"})};
    }

    const data = await r.json();
    const reply = (data.choices && data.choices[0] && data.choices[0].message.content) || "Sorry, I could not answer that.";
    return {statusCode: 200, headers: {"content-type": "application/json"}, body: JSON.stringify({reply})};
  } catch (e) {
    console.error(e);
    return {statusCode: 500, body: JSON.stringify({error: "Server error"})};
  }
};
