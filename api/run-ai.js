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
        input: [
          {
            role: "system",
            content: "You are AMI, a powerful diagnostic assistant for lab blood reports."
          },
          {
            role: "user",
            content: `
              Extracted Blood Report Text:
              ${extractedText}

              Attached PDF (base64):
              ${pdfBase64}

              Generate a clear, professional medical summary + explanations.
            `
          }
        ]
      })
    });

    const data = await response.json();
    return data;

  } catch (err) {
    console.error("AI Request Error:", err);
    return { error: err.message };
  }
}
