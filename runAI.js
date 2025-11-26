// runAI.js — AMI AI ENGINE

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
- Detect infection markers (high WBC, neutrophilia, inflammatory patterns)
- Generate STRICT JSON:
{
  "summary": [],
  "flagged_results": [],
  "interpretation": [],
  "risk_level": "",
  "recommendations": [],
  "cbc_values": {},
  "disclaimer": "This is not a medical diagnosis."
}

Rules:
- Never hallucinate.
- Only use values actually in the text.
`
          },

          {
            role: "user",
            content: `
Extracted Report Text:
${extractedText}

Base64 PDF (optional):
${pdfBase64}

Output ONLY valid JSON.
`
          }
        ]
      })
    });

    const data = await response.json();

    // Extract AI content safely
    const result =
      data.output?.[0]?.content?.[0]?.json ??
      data.output?.[0]?.content?.[0]?.text ??
      data;

    return result;

  } catch (err) {
    console.error("AI RUN ERROR:", err);
    return { error: err.message };
  }
}
