import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

interface DocBlob {
  fileName: string;
  mimeType: string;
  url: string; // public URL from storage bucket
}

async function callGateway(body: Record<string, unknown>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in Settings → Workspace → Usage.");
    throw new Error(`AI gateway error (${res.status}): ${text}`);
  }
  return res.json();
}

async function fetchAsDataUrl(url: string, mimeType: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Cap at ~15MB per file to stay within model limits
    if (buf.byteLength > 15 * 1024 * 1024) return null;
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const b64 = btoa(binary);
    return `data:${mimeType};base64,${b64}`;
  } catch {
    return null;
  }
}

async function buildContentParts(prompt: string, docs: DocBlob[]) {
  const parts: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const d of docs) {
    const dataUrl = await fetchAsDataUrl(d.url, d.mimeType);
    if (!dataUrl) {
      parts.push({
        type: "text",
        text: `\n[Could not load attached document: ${d.fileName} (${d.mimeType})]`,
      });
      continue;
    }
    if (d.mimeType.startsWith("image/") || d.mimeType === "application/pdf") {
      // Gemini via OpenAI-compatible interface accepts PDFs and images via image_url with data URLs
      parts.push({ type: "image_url", image_url: { url: dataUrl } });
      parts.push({ type: "text", text: `\n[Document: ${d.fileName}]` });
    } else {
      parts.push({
        type: "text",
        text: `\n[Attached document of type ${d.mimeType}: ${d.fileName} — content not directly readable]`,
      });
    }
  }
  return parts;
}

const SYSTEM_NOTING = `You are an expert assistant to a senior Government of India officer drafting official file notings. Your output must be precise, formal, and in standard administrative English used in Government note-sheets. You never use casual language. You always reason from the documents on record. You are advisory only — final decision rests with the competent authority.`;

const ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "submit_analysis",
    description: "Return the structured analysis of the case file.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Concise subject line of the file (Government style)." },
        reference: { type: "string", description: "Auto-generated reference / file context line." },
        brief: { type: "string", description: "Brief of the case in 3-6 sentences." },
        facts: { type: "array", items: { type: "string" }, description: "Key facts on record." },
        issues: { type: "array", items: { type: "string" }, description: "Issues requiring consideration." },
        deficiencies: { type: "array", items: { type: "string" }, description: "Deficiencies / missing information." },
        rules: { type: "array", items: { type: "string" }, description: "Relevant rules / GOs / circulars detected." },
        recommendation: { type: "string", description: "Reasoned recommendation paragraph." },
        verdict: {
          type: "string",
          enum: [
            "fit_for_approval",
            "not_fit",
            "approve_with_conditions",
            "needs_clarification",
            "higher_authority",
            "needs_examination",
          ],
        },
      },
      required: ["subject", "reference", "brief", "facts", "issues", "deficiencies", "rules", "recommendation", "verdict"],
      additionalProperties: false,
    },
  },
} as const;

export const analyzeCase = createServerFn({ method: "POST" })
  .inputValidator((data: { documents: DocBlob[]; extractedText?: string }) => data)
  .handler(async ({ data }) => {
    const prompt = `Analyse the attached Government file documents and return a structured analysis using the submit_analysis tool.\n\nNumber of documents attached: ${data.documents.length}\nFile names: ${data.documents.map((d) => d.fileName).join(", ")}\n\nCRITICAL INSTRUCTIONS:\n- The actual PDF / image documents are attached inline below. READ THEM directly.\n- Derive every field STRICTLY from what is visibly present in those documents.\n- Do NOT invent names, dates, file numbers, sanctions, GOs, rules, amounts, or any facts that are not actually visible in the documents.\n- If the documents are blank, illegible, or do not contain enough information for a field, return an empty array (for list fields) or the exact text "Not discernible from the record on file." (for text fields). Never fabricate.\n- Subject and reference must be drawn from the documents themselves; if absent, use a neutral descriptor based on visible content.`;

    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_NOTING },
        { role: "user", content: await buildContentParts(prompt, data.documents) },
      ],
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: "function", function: { name: "submit_analysis" } },
    };

    const json = await callGateway(body);
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return { error: "AI did not return structured analysis. Please retry." } as const;
    }
    try {
      const parsed = JSON.parse(call.function.arguments);
      return { analysis: parsed } as const;
    } catch {
      return { error: "Could not parse AI analysis. Please retry." } as const;
    }
  });

const NOTING_GUIDANCE: Record<string, string> = {
  approve:
    "Draft an APPROVAL note. Recommend approval with clear reasoning grounded in the record. End with 'Submitted for approval.'",
  reject:
    "Draft a REJECTION note. Set out, clause by clause, why the proposal is not admissible / not feasible / not recommended. End with 'Submitted for orders.'",
  putup_positive:
    "Draft a note PUTTING UP THE CASE TO HIGHER AUTHORITY WITH POSITIVE REMARKS. Present the case favourably and clearly for consideration by the higher authority. End with 'Submitted for kind consideration and orders.'",
  putup_negative:
    "Draft a note PUTTING UP THE CASE TO HIGHER AUTHORITY WITH NEGATIVE / CAUTIONARY REMARKS. Highlight risks, deficiencies and adverse observations courteously. End with 'Submitted for kind consideration and orders.'",
  other:
    "Draft the noting strictly as per the officer's custom instruction provided below, while maintaining proper Government note-sheet style.",
};

export const generateNoting = createServerFn({ method: "POST" })
  .inputValidator((data: {
    documents: DocBlob[];
    extractedText?: string;
    analysis: unknown;
    notingType: string;
    customInstruction?: string;
    refinement?: "shorter" | "longer" | "more_formal" | "stronger_rules" | "regenerate" | null;
    previousNote?: string;
  }) => data)
  .handler(async ({ data }) => {
    const guidance = NOTING_GUIDANCE[data.notingType] ?? NOTING_GUIDANCE.other;
    const refineMap: Record<string, string> = {
      shorter: "Make the previous noting shorter and more concise while keeping all essential reasoning.",
      longer: "Expand the previous noting with fuller reasoning and richer official phrasing.",
      more_formal: "Rewrite the previous noting in a more formal, classical Government style.",
      stronger_rules: "Rewrite the previous noting with stronger rule-based reasoning, citing detected GOs, rules and circulars more emphatically.",
      regenerate: "Regenerate a fresh draft from the analysis and documents.",
    };
    const refine = data.refinement && data.previousNote
      ? `\n\nThe previous draft was:\n---\n${data.previousNote}\n---\n${refineMap[data.refinement] ?? ""}`
      : "";

    const prompt = `Using the analysis and documents provided, draft an official Government file noting.\n\nNoting type guidance: ${guidance}\n${data.customInstruction ? `\nOfficer's custom instruction: ${data.customInstruction}` : ""}\n\nStructured analysis (JSON):\n${JSON.stringify(data.analysis, null, 2)}\n\n${data.extractedText ? `Document extract:\n---\n${data.extractedText.slice(0, 40000)}\n---` : ""}\n\nRules:\n- Begin with a numbered paragraph 1 stating the matter examined.\n- Use standard administrative phrasing such as "The matter has been examined.", "On perusal of the records placed in the file...", "It is seen that...", "In the circumstances, the proposal may be considered...".\n- Reference rules / GOs / circulars where supported by the record.\n- Number paragraphs (1., 2., 3., ...).\n- End with the appropriate submission line and a signature block placeholder line: "(Section Officer)" / "(Under Secretary)" as appropriate.\n- Output ONLY the noting text, no preamble, no markdown headings.${refine}`;

    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_NOTING },
        { role: "user", content: buildContentParts(prompt, data.documents) },
      ],
    };

    const json = await callGateway(body);
    const text = json.choices?.[0]?.message?.content;
    if (!text) return { error: "AI did not return any text. Please retry." } as const;
    return { noting: text as string } as const;
  });
