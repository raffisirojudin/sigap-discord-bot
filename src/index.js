/**
 * Sigap Discord Bot - Slash command /tanya bertenaga Groq API (super cepat)
 * Jalan di Cloudflare Workers, memakai model "HTTP Interactions" Discord
 * (bukan koneksi gateway 24 jam) -- cocok buat serverless yang gratis tanpa batas waktu.
 *
 * Alur kerja:
 * 1. Pengguna ketik /tanya di Discord.
 * 2. Discord kirim POST request (sudah ditandatangani) ke Worker ini.
 * 3. Worker verifikasi tanda tangannya, balas "lagi mikir..." (deferred response) sebagai
 *    jaring pengaman, lalu langsung tanya Groq di belakang layar.
 * 4. Karena Groq sangat cepat, jawaban asli biasanya sudah muncul dalam hitungan
 *    sepersekian detik -- "lagi mikir..." nyaris nggak kelihatan.
 */

import { verifyKey, InteractionType, InteractionResponseType } from "discord-interactions";

const GROQ_MODEL = "llama-3.1-8b-instant";

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      if (env.DISCORD_INVITE_URL) {
        return Response.redirect(env.DISCORD_INVITE_URL, 302);
      }
      return new Response(
        "Sigap Discord Bot aktif. Interactions Endpoint URL Discord seharusnya mengarah ke sini.",
        { status: 200 }
      );
    }

    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const bodyText = await request.text();

    const isValid =
      signature && timestamp && (await verifyKey(bodyText, signature, timestamp, env.DISCORD_PUBLIC_KEY));

    if (!isValid) {
      return new Response("Bad request signature.", { status: 401 });
    }

    const interaction = JSON.parse(bodyText);

    // Discord mengirim PING ini sekali waktu kamu daftarkan URL -- wajib dijawab PONG,
    // ini cara Discord memverifikasi URL kamu benar-benar hidup.
    if (interaction.type === InteractionType.PING) {
      return jsonResponse({ type: InteractionResponseType.PONG });
    }

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const commandName = interaction.data.name;

      if (commandName === "tanya") {
        const question = interaction.data.options?.[0]?.value || "";

        // Discord wajib dapat respons awal dalam 3 detik. Groq biasanya jauh lebih
        // cepat dari itu, tapi kita tetap "tunda" responsnya (DEFERRED) sebagai
        // jaring pengaman kalau-kalau ada kelambatan jaringan sesekali.
        ctx.waitUntil(sendDeferredReply(interaction, question, env));

        return jsonResponse({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
      }
    }

    return new Response("OK", { status: 200 });
  },
};

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Tanya Groq di belakang layar, lalu kirim jawabannya sebagai follow-up
 * ke interaction yang sudah di-defer sebelumnya.
 */
async function sendDeferredReply(interaction, question, env) {
  let replyText;
  try {
    replyText = await askGroq(question, env.GROQ_API_KEY);
  } catch (err) {
    replyText = `⚠️ Terjadi kesalahan: ${err.message}`;
  }

  const url = `https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: replyText }),
  });

  if (!response.ok) {
    console.error("Gagal mengirim follow-up message:", await response.text());
  }
}

/**
 * Tanya Groq API langsung lewat REST API (fetch), tanpa SDK tambahan.
 * Formatnya kompatibel dengan OpenAI Chat Completions API.
 */
async function askGroq(userText, apiKey) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: "Kamu adalah Sigap, asisten AI yang ramah dan ringkas. Selalu jawab dalam Bahasa Indonesia." },
        { role: "user", content: userText },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  return text ? text.trim() : "Maaf, aku nggak berhasil menjawab pertanyaan itu. Coba tanya dengan cara lain?";
}
