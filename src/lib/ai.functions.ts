import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

interface DocBlob {
  fileName: string;
  mimeType: string;
  url: string; // public URL from storage bucket
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

const CATEGORY_LABEL: Record<string, string> = {
  kfc: "Kerala Financial Code",
  stores_purchase: "Kerala Stores Purchase Manual",
  kpwd: "Kerala PWD Manual",
  finance_go: "Kerala Finance Department GO",
  circular: "Circular",
  other: "Other reference",
};

interface RuleEntry {
  title: string;
  category: string;
  reference_no: string;
  year: number | null;
  summary: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
}

async function fetchRuleLibrary(): Promise<{ summary: string; docs: DocBlob[] }> {
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from("rule_documents")
      .select("title,category,reference_no,year,summary,storage_path,file_name,mime_type")
      .eq("is_active", true)
      .limit(20);
    const rules = (data ?? []) as RuleEntry[];
    if (rules.length === 0) {
      return { summary: "No rule documents have been added to the Rule Library yet.", docs: [] };
    }
    const summary = rules
      .map((r, i) => {
        const cat = CATEGORY_LABEL[r.category] ?? r.category;
        const ref = [r.reference_no, r.year].filter(Boolean).join(", ");
        const gist = r.summary ? ` — ${r.summary}` : "";
        return `${i + 1}. [${cat}] ${r.title}${ref ? ` (${ref})` : ""}${gist}`;
      })
      .join("\n");

    // Attach top 5 rule files inline so the model can read them directly
    const top = rules.slice(0, 5);
    const docs: DocBlob[] = [];
    for (const r of top) {
      const { data: signed } = await admin.storage
        .from("rule-library")
        .createSignedUrl(r.storage_path, 60 * 10);
      if (signed?.signedUrl) {
        docs.push({ fileName: `[RULE] ${r.title} — ${r.file_name}`, mimeType: r.mime_type, url: signed.signedUrl });
      }
    }
    return { summary, docs };
  } catch (e) {
    console.error("fetchRuleLibrary failed", e);
    return { summary: "Rule library unavailable.", docs: [] };
  }
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

const SYSTEM_NOTING = `You are an expert assistant to a senior Government of Kerala officer drafting official file notings in the Sachivalayam style.

Your output must be precise, formal, and in standard administrative English used in Kerala Government note-sheets.

LANGUAGE HANDLING:
- The uploaded documents may contain Malayalam text (titles, body paragraphs, signatures, seals, stamps) mixed with English.
- Read and understand Malayalam content directly from the documents and translate it accurately into formal administrative English in your output.
- When quoting Malayalam content, paraphrase it in English. You may include the original Malayalam phrase in parentheses only if essential for identification.
- All structured fields and the final noting text must be in English.

Knowledge base of authoritative references (used ONLY when the Rule Library is supplied to you in this prompt):
- The Kerala Financial Code (KFC), Volumes I and II.
- The Kerala Stores Purchase Manual.
- The Kerala PWD Manual.
- Government Orders and Circulars of the Finance Department, Government of Kerala.
- Any specific rule chapters / GOs the officer has uploaded to the Rule Library.

When a Rule Library is NOT supplied in this prompt, do not cite any KFC article, GO number, Stores Purchase Manual paragraph or KPWD Manual paragraph — phrase rule references generally (e.g. "the relevant provisions of the Kerala Financial Code") or omit them.

You never use casual language. You are advisory only — the final decision rests with the competent authority of the Government of Kerala.`;

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
    const library = await fetchRuleLibrary();
    const allDocs: DocBlob[] = [...data.documents, ...library.docs];

    const prompt = `Analyse the attached Government of Kerala file documents and return a structured analysis using the submit_analysis tool.\n\nNumber of case documents: ${data.documents.length}\nFile names: ${data.documents.map((d) => d.fileName).join(", ")}\n\n=== KERALA RULE LIBRARY (officer-curated) ===\n${library.summary}\n\nThe top entries are also attached inline below as [RULE] documents. Treat them as authoritative. When citing rules in your analysis, prefer references that actually appear either in the case documents or in this Rule Library; do NOT invent KFC articles, GO numbers, Stores Purchase Manual paragraphs or KPWD Manual paragraphs that are not present in either source.\n\n=== INSTRUCTIONS ===\n- Read the attached PDF / image documents directly. The first ${data.documents.length} are case documents; any [RULE] entries are reference material.\n- Derive every field STRICTLY from what is visibly present.\n- Do NOT invent names, dates, file numbers, sanctions, GOs, rules, amounts, or any facts that are not visible.\n- The 'rules' array MUST list only KFC articles, Stores Purchase Manual paragraphs, KPWD Manual paragraphs, Finance Department GOs or circulars that are either (a) cited in the case documents or (b) present in the Rule Library above. If none apply, return an empty array.\n- If the documents are blank, illegible, or insufficient for a field, return an empty array (for list fields) or the exact text "Not discernible from the record on file." (for text fields). Never fabricate.\n- Subject and reference must be drawn from the documents themselves.`;

    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_NOTING },
        { role: "user", content: await buildContentParts(prompt, allDocs) },
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

    const library = await fetchRuleLibrary();
    const allDocs: DocBlob[] = [...data.documents, ...library.docs];

    const prompt = `Using the analysis, the ATTACHED case documents and the Kerala Rule Library, draft an official Government of Kerala file noting in Sachivalayam style.\n\nNoting type guidance: ${guidance}\n${data.customInstruction ? `\nOfficer's custom instruction: ${data.customInstruction}` : ""}\n\nStructured analysis (JSON):\n${JSON.stringify(data.analysis, null, 2)}\n\n=== KERALA RULE LIBRARY (officer-curated) ===\n${library.summary}\n\nRules for drafting:\n- Ground every statement in the analysis, the case documents, or the Rule Library. Do NOT invent file numbers, names, dates, amounts, sanctions, KFC articles, Stores Purchase Manual paragraphs, KPWD Manual paragraphs, or GOs/circulars.\n- When citing a rule, KFC article, Stores Purchase Manual paragraph, KPWD Manual paragraph, GO or circular, only cite items that actually appear in the case documents or in the Rule Library above. If unsure, do not cite a number — phrase it generally (e.g. "the relevant provisions of the Kerala Financial Code").\n- If a fact is not on record, either omit it or say "the record does not disclose…".\n- Begin with a numbered paragraph 1 stating the matter examined.\n- Use Kerala Sachivalayam administrative phrasing such as "The matter has been examined.", "On perusal of the records placed in the file...", "It is seen that...", "In the circumstances, the proposal may be considered...".\n- Number paragraphs (1., 2., 3., ...).\n- End with the appropriate submission line and a signature block placeholder line: "(Section Officer)" / "(Under Secretary to Government)" as appropriate.\n- Output ONLY the noting text, no preamble, no markdown headings.${refine}`;

    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_NOTING },
        { role: "user", content: await buildContentParts(prompt, allDocs) },
      ],
    };

    const json = await callGateway(body);
    const text = json.choices?.[0]?.message?.content;
    if (!text) return { error: "AI did not return any text. Please retry." } as const;
    return { noting: text as string } as const;
  });
