
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/legal-draft" && request.method === "POST") {
      try {
        const body = await request.json();
        const message = typeof body.message === "string"
          ? body.message.trim()
          : "";

        if (!message) {
          return json({ error: "متن درخواست خالی است." }, 400);
        }

        const result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct",
          {
            messages: [
              {
                role: "system",
                content: "تو دستیار نگارش حقوقی فارسی هستی. متن‌های حقوقی را روشن، منظم و رسمی بنویس. اطلاعات نامعلوم را جعل نکن و در موارد لازم یادآوری کن که متن باید با مدارک و قوانین جاری بررسی شود."
              },
              {
                role: "user",
                content: message
              }
            ],
            max_tokens: 1800
          }
        );

        const answer = result?.response || "";

        if (!answer) {
          return json({ error: "پاسخ هوش مصنوعی خالی است." }, 502);
        }

        return json({ text: answer });
      } catch (error) {
        return json({
          error: "خطا در اتصال به هوش مصنوعی.",
          details: String(error?.message || error)
        }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
