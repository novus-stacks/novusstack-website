const esc = (s) => s.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {statusCode: 405, body: JSON.stringify({success: false})};
  }
  let b = {};
  try { b = JSON.parse(event.body || "{}"); } catch (e) { b = {}; }

  const name = String(b.name || "").trim().slice(0, 100);
  const email = String(b.email || "").trim().slice(0, 150);
  const type = String(b.type || "").trim().slice(0, 100);
  const message = String(b.message || "").trim().slice(0, 3000);

  if (!name || !message || !/^\S+@\S+\.\S+$/.test(email)) {
    return {statusCode: 400, body: JSON.stringify({success: false, message: "Invalid input"})};
  }

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        sender: {name: "Novusstack Website", email: "novusstacks@gmail.com"},
        to: [{email: "novusstacks@gmail.com", name: "Novusstack"}],
        replyTo: {email: email, name: name},
        subject: `New enquiry: ${type || "General"} from ${name}`,
        htmlContent: `<p><b>Name:</b> ${esc(name)}</p>
<p><b>Email:</b> ${esc(email)}</p>
<p><b>Project:</b> ${esc(type)}</p>
<p><b>Message:</b><br>${esc(message).replace(/\n/g, "<br>")}</p>`,
      }),
    });
    if (!r.ok) {
      console.error("Brevo error", r.status, await r.text());
      return {statusCode: 502, body: JSON.stringify({success: false})};
    }
    return {statusCode: 200, headers: {"content-type": "application/json"}, body: JSON.stringify({success: true})};
  } catch (e) {
    console.error(e);
    return {statusCode: 500, body: JSON.stringify({success: false})};
  }
};
