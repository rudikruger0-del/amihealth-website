// runAI.js — FINAL VERSION (MEDICAL-GRADE)

export async function runAI(pdfBase64, extractedText) {
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",

        response_format: { type: "json" },

        input: [
          {
            role: "system",
            content: `
You are AMI, a clinical laboratory interpretation AI.

Your task:
- Extract CBC values (WBC, RBC, HGB, HCT, MCV, MCH, MCHC, PLT, NEU%, LYM%, MONO%, etc.)
- Detect infection markers (high WBC, neutrophilia, elevated inflammatory patterns)
- Generate a structured JSON report:
{
  "summary": [],
  "trend": [],
  "flagged_results": [],
  "interpretation": [],
  "risk_level": "",
  "recommendations": [],
  "cbc_values": {},
  "disclaimer": "This is not a medical diagnosis..."
}

Rules:
- NEVER hallucinate values.
- Only include numbers that appear in the text.
- If CBC missing → set "cbc_values": {} and explain.
`
          },
          {
            role: "user",
            content: `
Extracted Text From Report:
${extractedText}

Base64 PDF (ignore unless text missing):
${pdfBase64}

Generate JSON only.
`
          }
        ]
      })
    });

    const data = await response.json();

    // OpenAI "responses" API usually wraps content under output[0].content[0].text/json
    const raw =
      data.output?.[0]?.content?.[0]?.text ??
      data.output?.[0]?.content?.[0]?.json ??
      data;

    return raw;
  } catch (err) {
    console.error("AI RUN ERROR:", err);
    return { error: String(err.message || err) };
  }
}
