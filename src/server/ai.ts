import { GoogleGenAI, Type } from '@google/genai';
import { db, getOrCreateUsageRecord, nowIso, PLAN_LIMITS, uid } from './db.ts';
import type { PlanTier } from '../types/index.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    throw new Error('GEMINI_API_KEY_MISSING: The Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to enable AI tools.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function assertAiQuota(businessId: string): { allowed: boolean; used: number; limit: number; planTier: PlanTier } {
  const sub = db
    .prepare('SELECT plan_tier FROM subscriptions WHERE business_id = ?')
    .get(businessId) as { plan_tier: PlanTier } | undefined;
  const planTier: PlanTier = sub?.plan_tier || 'free';
  const limit = PLAN_LIMITS[planTier].aiGenerationsPerMonth;
  const usage = getOrCreateUsageRecord(businessId);
  return {
    allowed: usage.ai_generations_count < limit,
    used: usage.ai_generations_count,
    limit,
    planTier,
  };
}

function incrementAiUsage(businessId: string) {
  const usage = getOrCreateUsageRecord(businessId);
  db.prepare('UPDATE usage_records SET ai_generations_count = ai_generations_count + 1 WHERE id = ?').run(usage.id);
}

export function formatGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('GEMINI_API_KEY_MISSING')) {
    return { status: 503, message: msg.replace('GEMINI_API_KEY_MISSING: ', '') };
  }
  if (msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('API_KEY_INVALID') || msg.includes('400')) {
    return { status: 403, message: 'Gemini API authentication failed. Please verify your GEMINI_API_KEY in Settings > Secrets.' };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return { status: 429, message: 'Gemini API quota reached or billing-enabled API key required for this model. Check Settings > Secrets.' };
  }
  return { status: 502, message: `AI service connection error: ${msg}` };
}

export async function generateMarketingContent(params: {
  businessId: string;
  userId: string;
  businessName: string;
  currency: string;
  country: string;
  contentType: string;
  productName: string;
  productCategory: string;
  productPrice: string;
  targetAudience: string;
  productFeatures: string;
  platform: string;
  tone: string;
  style: string;
}) {
  const quota = assertAiQuota(params.businessId);
  if (!quota.allowed) {
    throw new Error(`Monthly AI generation limit reached (${quota.used}/${quota.limit} on ${quota.planTier} plan). Upgrade your plan in Subscription & Billing for higher limits.`);
  }

  const ai = getAiClient();

  const prompt = `Create high-converting ${params.contentType} content for the following product and business.

Business: ${params.businessName} (${params.country}, Currency: ${params.currency})
Product Name: ${params.productName}
Category: ${params.productCategory}
Price: ${params.productPrice || 'Not specified'}
Target Audience: ${params.targetAudience || 'General shoppers'}
Key Features & Benefits: ${params.productFeatures || 'High quality, great value'}
Platform: ${params.platform}
Tone: ${params.tone}
Style: ${params.style}

Provide:
- A compelling headline/hook
- Main ready-to-publish copy tailored to ${params.platform}
- Two alternative variations
- Relevant hashtags (without excessive clutter)
- A clear call-to-action
- Practical posting tip for ${params.platform}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'You are a world-class commercial e-commerce copywriter and growth marketer for international SMBs. Write natural, persuasive, culturally aware marketing copy.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          primaryCopy: { type: Type.STRING },
          variations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          hashtags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          callToAction: { type: Type.STRING },
          platformTip: { type: Type.STRING },
        },
        required: ['headline', 'primaryCopy', 'variations', 'hashtags', 'callToAction', 'platformTip'],
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText);

  incrementAiUsage(params.businessId);

  const id = uid('aig');
  db.prepare(`
    INSERT INTO ai_generations (
      id, business_id, user_id, generation_type, platform, tone, style,
      prompt_summary, output_text, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.businessId,
    params.userId,
    params.contentType,
    params.platform,
    params.tone,
    params.style,
    `${params.contentType}: ${params.productName}`,
    parsed.primaryCopy || rawText,
    JSON.stringify(parsed),
    nowIso()
  );

  return { id, result: parsed };
}

export async function generateBusinessAdvice(params: {
  businessId: string;
  userId: string;
  question: string;
  history: { role: 'user' | 'assistant'; text: string }[];
}) {
  const quota = assertAiQuota(params.businessId);
  if (!quota.allowed) {
    throw new Error(`Monthly AI generation limit reached (${quota.used}/${quota.limit} on ${quota.planTier} plan). Upgrade your plan in Subscription & Billing for higher limits.`);
  }

  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(params.businessId) as Record<string, unknown>;
  const salesAgg = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS revenue, COALESCE(SUM(amount_paid),0) AS collected,
              COALESCE(SUM(total_cogs),0) AS cogs, COALESCE(SUM(gross_profit),0) AS gross_profit
       FROM sales WHERE business_id = ?`
    )
    .get(params.businessId) as Record<string, number>;
  const expAgg = db
    .prepare('SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM expenses WHERE business_id = ?')
    .get(params.businessId) as Record<string, number>;
  const prodStats = db
    .prepare(
      `SELECT COUNT(*) AS total_products,
              COALESCE(SUM(purchase_price * stock_qty),0) AS inventory_cost_value,
              COALESCE(SUM(CASE WHEN stock_qty <= low_stock_threshold AND stock_qty > 0 THEN 1 ELSE 0 END),0) AS low_stock,
              COALESCE(SUM(CASE WHEN stock_qty = 0 THEN 1 ELSE 0 END),0) AS out_of_stock
       FROM products WHERE business_id = ?`
    )
    .get(params.businessId) as Record<string, number>;
  const topProducts = db
    .prepare(
      `SELECT si.product_name, SUM(si.quantity) AS units, SUM(si.line_total) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.business_id = ?
       GROUP BY si.product_name
       ORDER BY revenue DESC LIMIT 5`
    )
    .all(params.businessId);
  const lowStockList = db
    .prepare('SELECT name, sku, stock_qty, low_stock_threshold, purchase_price, selling_price FROM products WHERE business_id = ? AND stock_qty <= low_stock_threshold ORDER BY stock_qty ASC LIMIT 8')
    .all(params.businessId);
  const custCount = db.prepare('SELECT COUNT(*) AS count FROM customers WHERE business_id = ?').get(params.businessId) as { count: number };
  const orderStats = db
    .prepare('SELECT status, COUNT(*) AS count FROM orders WHERE business_id = ? GROUP BY status')
    .all(params.businessId);

  const netProfit = (salesAgg.gross_profit || 0) - (expAgg.total || 0);

  const contextSnapshot = {
    business: {
      name: business.name,
      category: business.category,
      country: business.country,
      currency: business.currency,
      isDemo: Boolean(business.is_demo),
    },
    financials: {
      salesCount: salesAgg.count,
      grossRevenue: salesAgg.revenue,
      cashCollected: salesAgg.collected,
      outstandingPayments: Math.max(0, (salesAgg.revenue || 0) - (salesAgg.collected || 0)),
      cogs: salesAgg.cogs,
      grossProfit: salesAgg.gross_profit,
      totalExpenses: expAgg.total,
      netProfit,
    },
    inventory: {
      ...prodStats,
      lowStockItems: lowStockList,
    },
    topSellingProducts: topProducts,
    customersCount: custCount.count,
    ordersByStatus: orderStats,
  };

  const ai = getAiClient();

  const conversationLines = params.history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Owner' : 'Advisor'}: ${m.text}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Verified Business Snapshot (JSON):\n${JSON.stringify(contextSnapshot, null, 2)}\n\nRecent Conversation:\n${conversationLines || '(New conversation)'}\n\nOwner Question: ${params.question}`,
    config: {
      systemInstruction: `You are SellSmart AI Business Advisor, a senior retail & SaaS profitability strategist.
CRITICAL RULES:
1. Ground EVERY financial figure, product name, stock count, and recommendation strictly in the provided Verified Business Snapshot JSON.
2. NEVER invent, estimate, or hallucinate missing statistics. If salesCount is 0 or total_products is 0 or data needed to answer is missing, explicitly state what records are missing and give clear steps on what data the owner should record in SellSmart AI first.
3. Always format currency amounts using the business's configured currency (${String(business.currency || 'USD')}).
4. Organize your answer clearly with concrete, actionable steps tailored to the owner's business category (${String(business.category)}).`,
    },
  });

  const answer = (response.text ?? '').trim();
  if (!answer) {
    throw new Error('The AI advisor returned an empty response. Please try rephrasing your question.');
  }

  incrementAiUsage(params.businessId);

  const id = uid('aig');
  db.prepare(`
    INSERT INTO ai_generations (
      id, business_id, user_id, generation_type, platform, tone, style,
      prompt_summary, output_text, metadata_json, created_at
    ) VALUES (?, ?, ?, 'advisor', 'advisor', 'analytical', 'advisory', ?, ?, ?, ?)
  `).run(id, params.businessId, params.userId, params.question.slice(0, 140), answer, '{}', nowIso());

  return { id, answer, snapshotUsed: contextSnapshot };
}

export async function generatePosterImage(params: {
  businessId: string;
  userId: string;
  prompt: string;
  aspectRatio: '1:1' | '3:4' | '9:16' | '16:9' | '4:3';
  productImageBase64?: string;
  productImageMimeType?: string;
}) {
  const quota = assertAiQuota(params.businessId);
  if (!quota.allowed) {
    throw new Error(`Monthly AI generation limit reached (${quota.used}/${quota.limit} on ${quota.planTier} plan).`);
  }

  const ai = getAiClient();
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
  if (params.productImageBase64 && params.productImageMimeType) {
    parts.push({
      inlineData: {
        data: params.productImageBase64,
        mimeType: params.productImageMimeType,
      },
    });
  }
  parts.push({ text: params.prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-image',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: params.aspectRatio,
      },
    },
  });

  let imageDataUrl = '';
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? 'image/png';
      imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageDataUrl) {
    throw new Error('The image generation model did not return an image asset.');
  }

  incrementAiUsage(params.businessId);
  return { imageDataUrl };
}
