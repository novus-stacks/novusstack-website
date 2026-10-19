const BASE_PROMPT = `You are the Novusstack website assistant. Novusstack is a digital development studio.
Services: business websites, e-commerce stores with Razorpay payments, and AI chatbots.
Starting prices: Starter website INR 25,000. E-commerce store INR 60,000. AI chatbot is custom-priced.
Contact: novusstacks@gmail.com, Monday to Saturday, 10:00 to 19:00 IST.
For a quote, ask for the customer's name, email and project details, or suggest the contact form.
You can also write website code: HTML, CSS, JavaScript, React and Netlify functions.
When asked for code, give complete, working code in one fenced code block, with a short explanation.
Keep other answers short and polite.`;

const JSON_HEADERS = {"content-type": "application/json"};
const GEMINI_MODEL = "gemini-3.8-flash";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({error: "Method not allowed"})};
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set");
    return {statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({error: "Server config error"})};
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({error: "Invalid JSON"})};
  }

  const locale = body.locale || {};
  const isTamilNadu = locale.country === "India" && /tamil\s*nadu/i.test(String(locale.state || ""));
  const languageRule = isTamilNadu
    ? "The user is from Tamil Nadu, India. Reply in Tamil (Tamil script)."
    : "Always reply in English.";

  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{text: m.content.slice(0, 1000)}],
    }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return {statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({error: "No user message"})};
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {parts: [{text: BASE_PROMPT + "\n" + languageRule}]},
          contents: history,
          generationConfig: {maxOutputTokens: 2000, temperature: 0.5},
        }),
      }
    );

    if (!r.ok) {
      console.error("Gemini error", r.status, await r.text());
      return {statusCode: 502, headers: JSON_HEADERS, body: JSON.stringify({error: "AI unavailable"})};
    }

    const data = await r.json();
    const reply =
      (data.candidates && data.candidates[0] && data.candidates[0].content &&
        data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) ||
      "Sorry, I could not answer that.";

    return {statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({reply})};
  } catch (e) {
    console.error(e);
    return {statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({error: "Server error"})};
  }
};
