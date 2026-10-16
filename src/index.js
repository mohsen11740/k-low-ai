export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/legal-draft") {
      if (request.method !== "POST") {
        return json({ error: "متد درخواست مجاز نیست." }, 405);
      }

      try {
        let body;

        try {
          body = await request.json();
        } catch {
          return json({ error: "متن درخواست معتبر نیست." }, 400);
        }

        const message =
          typeof body.message === "string"
            ? body.message.trim()
            : "";

        if (!message) {
          return json({ error: "متن درخواست خالی است." }, 400);
        }

        if (message.length > 20000) {
          return json({ error: "متن درخواست بیش از حد طولانی است." }, 413);
        }

        const result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct-fast",
          {
            messages: [
              {
                role: "system",
                content:
                  "تو دستیار نگارش حقوقی فارسی برای سامانه حقوق کربلایی هستی. متن‌های حقوقی را دقیق، منظم، رسمی و قابل فهم بنویس. اگر اطلاعاتی مانند نام طرفین، تاریخ، شماره پرونده یا جزئیات واقعه مشخص نیست، آن را جعل نکن و از جای‌خالی مناسب استفاده کن. قوانین و مواد قانونی را بدون اطمینان قطعی اعلام نکن. در صورت نیاز یادآوری کن که متن نهایی باید با مدارک و قوانین جاری بررسی شود."
              },
              {
                role: "user",
                content: message
              }
            ],
            max_tokens: 1800
          }
        );

        const answer =
          result?.response ||
          result?.output_text ||
          result?.text ||
          "";

        if (!answer) {
          return json(
            { error: "پاسخ هوش مصنوعی خالی است." },
            502
          );
        }

        return json({ text: answer });
      } catch (error) {
        console.error("Legal AI error:", error);

        return json(
          {
            error: "خطا در اتصال به هوش مصنوعی.",
            details: String(error?.message || error)
          },
          500
        );
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
