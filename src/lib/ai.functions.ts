import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const MODEL = "gemini-2.0-flash-exp";
const GATEWAY = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

interface DocBlob {
  fileName: string;
  mimeType: string;
  url: string;
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
  id: string;
  title: string;
  category: string;
  reference_no: string;
  year: number | null;
  summary: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
}

async function fetchKbBundle(kbIds: string[]): Promise<{ summary: string; docs: DocBlob[]; kbNames: string[] }> {
  if (!kbIds || kbIds.length === 0) return { summary: "", docs: [], kbNames: [] };
  try {
    const admin = getAdminClient();

    const { data: kbRows } = await admin
      .from("knowledge_bases")
      .select("id,name")
      .in("id", kbIds);
    const kbNames = (kbRows ?? []).map((k: { name: string }) => k.name);

    const { data: links } = await admin
      .from("rule_document_kbs")
      .select("rule_document_id")
      .in("knowledge_base_id", kbIds);
    const docIds = Array.from(new Set((links ?? []).map((l: { rule_document_id: string }) => l.rule_document_id)));
    if (docIds.length === 0) {
      return { summary: `Selected knowledge bases (${kbNames.join(", ")}) contain no documents.`, docs: [], kbNames };
    }

    const { data } = await admin
      .from("rule_documents")
      .select("id,title,category,reference_no,year,summary,storage_path,file_name,mime_type")
      .in("id", docIds)
      .eq("is_active", true)
      .limit(30);
    const rules = (data ?? []) as RuleEntry[];
    if (rules.length === 0) return { summary: `Selected knowledge bases have no active documents.`, docs: [], kbNames };

    const summary = rules
      .map((r, i) => {
        const cat = CATEGORY_LABEL[r.category] ?? r.category;
        const ref = [r.reference_no, r.year].filter(Boolean).join(", ");
        const gist = r.summary ? ` — ${r.summary}` : "";
        return `${i + 1}. [${cat}] ${r.title}${ref ? ` (${ref})` : ""}${gist}`;
      })
      .join("\n");

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
    return { summary, docs, kbNames };
  } catch (e) {
    console.error("fetchKbBundle failed", e);
    return { summary: "Knowledge base unavailable.", docs: [], kbNames: [] };
  }
}

async function callGateway(body: Record<string, unknown>) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
    throw new Error(`Gemini API error (${res.status}): ${text}`);
  }
  return res.json();
}

async function fetchAsDataUrl(url: string, mimeType: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
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
      parts.push({ type: "text", text: `\n[Could not load attached document: ${d.fileName} (${d.mimeType})]` });
      continue;
    }
    if (d.mimeType.startsWith("image/") || d.mimeType === "application/pdf") {
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

const SYSTEM_NOTING = `You are an expert official assistant to the DIRECTOR / CHIEF EXECUTIVE OFFICER (CEO) of a Government of Kerala organization, drafting official file notings in the Kerala Sachivalayam style.

You write FROM THE PERSPECTIVE OF THE DIRECTOR / CEO of the organization. The Director / CEO is the competent authority for granting or refusing approval on the matters placed before them. When the noting is for "Approval" or "Rejection", you are issuing the FINAL ORDER of the Director / CEO, not a recommendation to a higher authority.

Output must be precise, formal, and in standard administrative English used in Kerala Government note-sheets.

LANGUAGE HANDLING:
- Uploaded documents may contain Malayalam text mixed with English.
- Read and understand Malayalam directly and translate it into formal administrative English.
- All structured fields and the noting text must be in English.

FORMATTING RULES (STRICT):
- Do NOT use any markdown or special formatting characters in the noting text.
- Do NOT use the asterisk (*), underscore (_), backtick (\`), tilde (~), hash (#), pipe (|), greater-than (>), or any bullet glyphs such as • or –.
- Do NOT use any paragraph numbering (no "1.", "2.", "3.", no "(i)", "(a)", etc.). Write as flowing prose paragraphs separated by blank lines.
- Use plain prose. No bold, italic, headings or markdown of any kind.
- The hyphen (-) may be used only inside a normal word (e.g. "note-sheet"), never as a list bullet.
- LENGTH: The entire noting (excluding the signature line) must be between 100 and 150 words. Be crisp and concise. Do not pad.

Knowledge base of authoritative references (used ONLY when knowledge bases are explicitly supplied to you in this prompt):
- Kerala Financial Code (KFC), Volumes I and II.
- Kerala Stores Purchase Manual.
- Kerala PWD Manual.
- Government Orders and Circulars of the Finance Department, Government of Kerala.
- Any specific rule chapters / GOs that are present in the supplied knowledge bases.

When NO knowledge base is supplied in this prompt, do NOT cite any KFC article, GO number, Stores Purchase Manual paragraph or KPWD Manual paragraph — phrase rule references generally (e.g. "the relevant provisions of the Kerala Financial Code") or omit them.

Never use casual language.`;

const ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "submit_analysis",
    description: "Return the structured analysis of the case file.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string" },
        reference: { type: "string" },
        brief: { type: "string" },
        facts: { type: "array", items: { type: "string" } },
        issues: { type: "array", items: { type: "string" } },
        deficiencies: { type: "array", items: { type: "string" } },
        rules: { type: "array", items: { type: "string" } },
        recommendation: { type: "string" },
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
  .inputValidator((data: { documents: DocBlob[]; extractedText?: string; kbIds?: string[] }) => data)
  .handler(async ({ data }) => {
    const kbIds = data.kbIds ?? [];
    const useLib = kbIds.length > 0;
    const library = useLib ? await fetchKbBundle(kbIds) : { summary: "", docs: [] as DocBlob[], kbNames: [] };
    const allDocs: DocBlob[] = [...data.documents, ...library.docs];

    const libBlock = useLib
      ? `\n\n=== APPLIED KNOWLEDGE BASES (${library.kbNames.join("; ")}) ===\n${library.summary}\n\nThe top entries are also attached inline below as [RULE] documents. Treat them as authoritative. When citing rules, prefer references that actually appear in the case documents or in these knowledge bases; do NOT invent KFC articles, GO numbers, Stores Purchase Manual paragraphs or KPWD Manual paragraphs.`
      : `\n\n=== KNOWLEDGE BASES ===\nNone applied for this run. Do NOT cite specific KFC articles, GO numbers, Stores Purchase Manual paragraphs or KPWD Manual paragraphs unless they appear verbatim in the uploaded case documents.`;

    const prompt = `Analyse the attached Government of Kerala file documents and return a structured analysis using the submit_analysis tool.\n\nNumber of case documents: ${data.documents.length}\nFile names: ${data.documents.map((d) => d.fileName).join(", ")}\n\nDocuments may contain Malayalam text. Read it directly, translate it to formal administrative English, and produce all output fields in English.${libBlock}\n\n=== INSTRUCTIONS ===\n- Read the attached PDF / image documents directly. The first ${data.documents.length} are case documents; any [RULE] entries are reference material from the applied knowledge bases.\n- Derive every field STRICTLY from what is visibly present (after translating Malayalam to English).\n- Do NOT invent names, dates, file numbers, sanctions, GOs, rules, amounts, or any facts that are not visible.\n- The 'rules' array MUST list only rules that are either (a) cited in the case documents or (b) present in the applied knowledge bases above. If none apply, return an empty array.\n- If the documents are blank, illegible, or insufficient for a field, return an empty array (for list fields) or the exact text "Not discernible from the record on file." (for text fields). Never fabricate.\n- Subject and reference must be drawn from the documents themselves (translated to English if originally in Malayalam).`;

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
    "Draft the FINAL APPROVAL ORDER of the Director / CEO of this organization. The Director / CEO is the competent authority and is HEREBY GRANTING approval. State the reasoning clearly, ground it in the record (and in the knowledge bases if supplied), and conclude with an explicit operative line such as: 'In view of the above, the proposal is approved.' Sign off as '(Director / Chief Executive Officer)'. Do NOT phrase this as a recommendation to a higher authority.",
  reject:
    "Draft the FINAL REJECTION ORDER of the Director / CEO of this organization. The Director / CEO is the competent authority and is HEREBY REJECTING the proposal. Set out, paragraph by paragraph, why the proposal is not admissible / not feasible / not in order. Conclude with an explicit operative line such as: 'In view of the above, the proposal is rejected.' Sign off as '(Director / Chief Executive Officer)'. Do NOT phrase this as a recommendation to a higher authority.",
  putup_positive:
    "Draft a note PUTTING UP THE CASE TO HIGHER AUTHORITY WITH POSITIVE REMARKS, on behalf of the Director / CEO. Present the case favourably for the consideration of the higher authority. End with 'Submitted for kind consideration and orders.' Sign off as '(Director / Chief Executive Officer)'.",
  putup_negative:
    "Draft a note PUTTING UP THE CASE TO HIGHER AUTHORITY WITH NEGATIVE / CAUTIONARY REMARKS, on behalf of the Director / CEO. Highlight risks, deficiencies and adverse observations courteously. End with 'Submitted for kind consideration and orders.' Sign off as '(Director / Chief Executive Officer)'.",
  other:
    "Draft the noting strictly as per the officer's custom instruction provided below, while maintaining proper Government note-sheet style and the Director / CEO's perspective. Sign off as '(Director / Chief Executive Officer)'.",
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
    kbIds?: string[];
  }) => data)
  .handler(async ({ data }) => {
    const guidance = NOTING_GUIDANCE[data.notingType] ?? NOTING_GUIDANCE.other;
    const refineMap: Record<string, string> = {
      shorter: "Make the previous noting shorter and more concise while keeping all essential reasoning.",
      longer: "Expand the previous noting with fuller reasoning and richer official phrasing.",
      more_formal: "Rewrite the previous noting in a more formal, classical Government style.",
      stronger_rules: "Rewrite the previous noting with stronger rule-based reasoning, citing detected GOs, rules and circulars more emphatically (only those actually present in the case documents or applied knowledge bases).",
      regenerate: "Regenerate a fresh draft from the analysis and documents.",
    };
    const refine = data.refinement && data.previousNote
      ? `\n\nThe previous draft was:\n---\n${data.previousNote}\n---\n${refineMap[data.refinement] ?? ""}`
      : "";

    const kbIds = data.kbIds ?? [];
    const useLib = kbIds.length > 0;
    const library = useLib ? await fetchKbBundle(kbIds) : { summary: "", docs: [] as DocBlob[], kbNames: [] };
    const allDocs: DocBlob[] = [...data.documents, ...library.docs];

    const libBlock = useLib
      ? `\n\n=== APPLIED KNOWLEDGE BASES (${library.kbNames.join("; ")}) ===\n${library.summary}`
      : `\n\n=== KNOWLEDGE BASES ===\nNone applied. Do NOT cite specific rule numbers, GO numbers, KFC articles, Stores Purchase Manual paragraphs or KPWD Manual paragraphs unless they appear in the case documents.`;

    const ruleRule = useLib
      ? `- When citing a rule, KFC article, Stores Purchase Manual paragraph, KPWD Manual paragraph, GO or circular, only cite items that actually appear in the case documents or in the applied knowledge bases above.`
      : `- Do NOT cite any specific KFC article number, Stores Purchase Manual paragraph, KPWD Manual paragraph, GO number or circular number unless it appears verbatim in the case documents.`;

    const prompt = `Using the analysis and the ATTACHED case documents${useLib ? " and the applied knowledge bases" : ""}, draft an official Government of Kerala file noting in Sachivalayam style, FROM THE PERSPECTIVE OF THE DIRECTOR / CEO of the organization.\n\nDocuments may contain Malayalam text. Read it directly, translate it to formal administrative English, and write the entire noting in English.\n\nNoting type guidance: ${guidance}\n${data.customInstruction ? `\nOfficer's custom instruction: ${data.customInstruction}` : ""}\n\nStructured analysis (JSON):\n${JSON.stringify(data.analysis, null, 2)}${libBlock}\n\nRules for drafting:\n- Ground every statement in the analysis, the case documents${useLib ? ", or the applied knowledge bases" : ""}. Do NOT invent file numbers, names, dates, amounts, sanctions, KFC articles, Stores Purchase Manual paragraphs, KPWD Manual paragraphs, or GOs/circulars.\n${ruleRule}\n- If a fact is not on record, either omit it or say "the record does not disclose…".\n- Begin directly with the matter examined (no paragraph number, no heading).\n- Use Kerala Sachivalayam administrative phrasing such as "The matter has been examined.", "On perusal of the records placed in the file...", "It is seen that...".\n- Do NOT number paragraphs. Write 2 to 4 short flowing prose paragraphs separated by a blank line.\n- LENGTH: Keep the entire noting between 100 and 150 words (excluding the signature line). Be crisp; omit filler.\n- STRICT: Do NOT use any of these characters anywhere in the noting: asterisk (*), underscore (_), backtick (\`), tilde (~), hash (#), pipe (|), greater-than (>), bullet glyphs (•, –). No markdown formatting whatsoever. Plain prose only.\n- Sign off with the appropriate operative/submission line and a signature block placeholder line "(Director / Chief Executive Officer)".\n- Output ONLY the noting text in English, no preamble, no markdown headings.${refine}`;

    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_NOTING },
        { role: "user", content: await buildContentParts(prompt, allDocs) },
      ],
    };

    const json = await callGateway(body);
    let text = json.choices?.[0]?.message?.content as string | undefined;
    if (!text) return { error: "AI did not return any text. Please retry." } as const;
    // Belt-and-braces: strip any stray markdown / special chars the model might still emit
    text = text
      .replace(/\*\*/g, "")
      .replace(/[*_`~#|>]/g, "")
      .replace(/^[\s]*[•–][\s]*/gm, "")
      // Strip leading paragraph numbering like "1.", "2)", "(3)", "i.", "(a)"
      .replace(/^\s*(?:\(?\d+\)?[.)]|\(?[ivxIVX]+\)?[.)]|\(?[a-zA-Z]\)?[.)])\s+/gm, "")
      .replace(/[ \t]+\n/g, "\n");
    return { noting: text } as const;
  });
