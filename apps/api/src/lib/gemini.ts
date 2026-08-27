const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

export async function generateContent(
  prompt: string,
  model = "gemini-2.0-flash",
): Promise<string> {
  const res = await fetch(`${BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as GeminiResponse;
  return data.candidates[0]?.content?.parts[0]?.text ?? "";
}

export async function generateStructured<T>(
  prompt: string,
  model = "gemini-2.0-flash",
): Promise<T> {
  const text = await generateContent(
    `${prompt}\n\nRespond with valid JSON only, no markdown fences.`,
    model,
  );

  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}
