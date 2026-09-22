import { GoogleGenerativeAI } from "@google/generative-ai";
import { Buffer } from "node:buffer";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

async function extractSpreadsheetContent(buffer) {
  try {
    const XLSXModule = await import('xlsx');
    const XLSX = XLSXModule?.default?.read ? XLSXModule.default : XLSXModule;
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const textParts = [];
    for (const sheetName of (workbook.SheetNames || [])) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv && csv.trim()) {
        textParts.push(`[Hoja Excel: ${sheetName}]\n${csv.trim()}`);
      }
    }
    return textParts.join('\n\n');
  } catch (err) {
    console.warn('[parse-tariff] Error extrayendo texto con XLSX:', err?.message || err);
    return '';
  }
}

export default async (req, context) => {
  const method = req?.method || req?.httpMethod || '';

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    let fileBuffer = null;
    let fileName = 'tarifa.xlsx';
    let mimeType = 'application/octet-stream';

    const contentType = (req.headers && (req.headers.get ? req.headers.get('content-type') : req.headers['content-type'])) || '';

    // Soporte nativo para FormData / multipart en v2 Request
    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await req.formData();
        const uploadedFile = formData.get('file') || formData.get('tariff') || formData.get('document');
        if (uploadedFile && typeof uploadedFile.arrayBuffer === 'function') {
          const ab = await uploadedFile.arrayBuffer();
          fileBuffer = Buffer.from(ab);
          fileName = uploadedFile.name || fileName;
          mimeType = uploadedFile.type || mimeType;
        }
      } catch (formErr) {
        console.warn('[parse-tariff] Error al leer FormData:', formErr?.message || formErr);
      }
    }

    // Fallback para JSON o Buffer directo
    if (!fileBuffer || fileBuffer.length === 0) {
      let body = {};
      try {
        if (typeof req.json === 'function') {
          body = await req.json();
        } else if (typeof req.body === 'string') {
          body = JSON.parse(req.body);
        } else if (req.body && typeof req.body === 'object') {
          body = req.body;
        }
      } catch (_) {}

      const rawBase64 = body.fileBase64 || body.data || body.file || '';
      if (rawBase64 && typeof rawBase64 === 'string') {
        const pureBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1].trim() : rawBase64.trim();
        fileBuffer = Buffer.from(pureBase64, 'base64');
      }
      if (body.fileName) fileName = body.fileName;
      if (body.mimeType) mimeType = body.mimeType;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No se recibió ningún archivo válido (.xlsx, .csv, .pdf) para procesar.',
      }), {
        status: 400,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      });
    }

    const lowerName = (fileName || '').toLowerCase();
    const isSpreadsheet = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv') || mimeType.includes('spreadsheet') || mimeType.includes('csv');
    const isPdf = lowerName.endsWith('.pdf') || mimeType.includes('pdf');

    let spreadsheetText = '';
    if (isSpreadsheet) {
      spreadsheetText = await extractSpreadsheetContent(fileBuffer);
    }

    // Compatibilidad con Netlify AI Gateway y variables estándar
    const apiKey = (typeof Netlify !== 'undefined' && (
      Netlify.env?.get?.('GEMINI_API_KEY') ||
      Netlify.env?.get?.('NETLIFY_AI_GATEWAY_KEY') ||
      Netlify.env?.get?.('GOOGLE_API_KEY') ||
      Netlify.env?.get?.('GOOGLE_GENAI_API_KEY')
    ))
      || process.env.GEMINI_API_KEY
      || process.env.NETLIFY_AI_GATEWAY_KEY
      || process.env.GOOGLE_API_KEY
      || process.env.GOOGLE_GENAI_API_KEY;

    const baseUrl = (typeof Netlify !== 'undefined' && (
      Netlify.env?.get?.('GOOGLE_GEMINI_BASE_URL') ||
      Netlify.env?.get?.('NETLIFY_AI_GATEWAY_BASE_URL')
    ))
      || process.env.GOOGLE_GEMINI_BASE_URL
      || process.env.NETLIFY_AI_GATEWAY_BASE_URL;

    const requestOptions = baseUrl ? { baseUrl } : undefined;

    if (!apiKey) {
      // Fallback determinista si no hay API key configurada en local
      const mockProducts = [
        {
          id: "prod-1",
          Produit: "CEM I 42,5N/R (Saco 50Kg)",
          name: "CEM I 42,5N/R (Saco 50Kg)",
          rabais: 0.85,
          lineItems: [
            { concepto: "Precio Base", valorLocal: 1000 },
            { concepto: "Envase (Big Bag / Sac)", valorLocal: 120 },
            { concepto: "Logística Inland", valorLocal: 200 },
            { concepto: "Gastos de tránsito", valorLocal: 50 },
            { concepto: "Gastos portuarios", valorLocal: 80 }
          ]
        },
        {
          id: "prod-2",
          Produit: "CEM II 52.5N/R (Big Bag 1.5t)",
          name: "CEM II 52.5N/R (Big Bag 1.5t)",
          rabais: 0.80,
          lineItems: [
            { concepto: "Precio Base", valorLocal: 1100 },
            { concepto: "Envase (Big Bag / Sac)", valorLocal: 150 },
            { concepto: "Logística Inland", valorLocal: 220 },
            { concepto: "Gastos de tránsito", valorLocal: 50 },
            { concepto: "Gastos portuarios", valorLocal: 85 }
          ]
        }
      ];

      return new Response(JSON.stringify({
        currency: "DZD",
        exchangeRate: 0.0068,
        lineItems: mockProducts[0].lineItems,
        tarifas: mockProducts,
        products: mockProducts
      }), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }, requestOptions);

    const systemPrompt = `Eres un experto analista tarifario de transporte y logística internacional en Land Charter Core PRO.
Tu misión es extraer la estructura tarifaria de costes y fletes de TODOS los productos presentes en el documento adjunto (Excel, CSV o PDF).

Debes identificar:
1. La moneda origen principal (ej. TRY, MAD, EUR, USD, DZD, GBP).
2. El tipo de cambio aproximado o implícito respecto a USD/EUR (ej. TRY=0.027, MAD=0.093, EUR=1.0, DZD=0.0068, USD=0.92). Si no aparece explícito, provee la tasa de conversión típica de mercado a EUR.
3. El desglose de TODOS los productos o filas tarifarias que aparezcan en el documento:
   - Para cada producto, extrae su nombre en 'Produit' (o 'name'), el factor de descuento en 'rabais' (número entre 0 y 1, por defecto 0.85 si no se especifica), y sus conceptos en 'lineItems':
     * "Precio Base" (mapeado de 'Prix GICA' o tarifa base)
     * "Envase (Big Bag / Sac)" (mapeado de packaging / sac / big bag)
     * "Logística Inland" (mapeado de Coût Logistique Marché o transporte interior)
     * "Gastos de tránsito" (reemplazo estricto de Frais Transit & SGS)
     * "Gastos portuarios" (reemplazo estricto de Frais Port Bejaia / Port dues)
   - Traduce y normaliza cualquier término arcaico o en francés a español.

RESPONDE EXCLUSIVAMENTE CON ESTE ESQUEMA JSON ESTRICTO:
{
  "currency": "TRY",
  "exchangeRate": 0.03,
  "lineItems": [
    { "concepto": "Flete", "valorLocal": 500 }
  ],
  "tarifas": [
    {
      "id": "prod-1",
      "Produit": "CEM I 42,5N/R (Saco 50Kg)",
      "rabais": 0.85,
      "lineItems": [
        { "concepto": "Precio Base", "valorLocal": 1000 },
        { "concepto": "Envase (Big Bag / Sac)", "valorLocal": 120 },
        { "concepto": "Logística Inland", "valorLocal": 200 },
        { "concepto": "Gastos de tránsito", "valorLocal": 50 },
        { "concepto": "Gastos portuarios", "valorLocal": 80 }
      ]
    }
  ]
}`;

    const promptParts = [systemPrompt];

    if (spreadsheetText && spreadsheetText.trim()) {
      promptParts.push(`\nContenido tabular de la hoja de cálculo (${fileName}):\n${spreadsheetText.substring(0, 100000)}`);
    } else {
      promptParts.push(`\nArchivo adjunto para análisis: ${fileName}`);
      promptParts.push({
        inlineData: {
          data: fileBuffer.toString('base64'),
          mimeType: isPdf ? 'application/pdf' : (mimeType || 'application/octet-stream')
        }
      });
    }

    const result = await model.generateContent(promptParts);
    const responseText = result.response.text();
    let parsedData = null;

    try {
      parsedData = JSON.parse(responseText);
    } catch (jsonErr) {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedData = JSON.parse(match[0]);
      } else {
        throw new Error('No se pudo parsear el JSON generado por Gemini');
      }
    }

    // Normalización y sanitización del formato de salida requerido
    const currency = typeof parsedData?.currency === 'string' && parsedData.currency.trim() 
      ? parsedData.currency.trim().toUpperCase() 
      : 'TRY';

    const exchangeRate = Number(parsedData?.exchangeRate) > 0 
      ? Number(parsedData.exchangeRate) 
      : 0.03;

    // Normalizar lista de tarifas/productos
    let rawTarifas = Array.isArray(parsedData?.tarifas) 
      ? parsedData.tarifas 
      : (Array.isArray(parsedData?.products) ? parsedData.products : []);

    const sanitizeLineItems = (items) => {
      if (!Array.isArray(items)) return [];
      return items.map((it, i) => {
        let concepto = String(it.concepto || it.concept || it.name || `Coste ${i + 1}`).trim();
        if (/frais\s*transit/i.test(concepto)) concepto = 'Gastos de tránsito';
        if (/frais\s*port/i.test(concepto)) concepto = 'Gastos portuarios';
        const valorLocal = Math.max(0, Number(it.valorLocal ?? it.valor ?? it.amount ?? it.value ?? 0) || 0);
        return {
          concepto,
          valorLocal
        };
      });
    };

    const cleanTarifas = rawTarifas.map((t, idx) => {
      const pName = String(t.Produit || t.produit || t.product || t.name || `Producto ${idx + 1}`).trim();
      const pId = String(t.id || `tariff-${idx + 1}`);
      const rabais = Number(t.rabais ?? t.discount ?? t.discountFactor) > 0 
        ? Number(t.rabais ?? t.discount ?? t.discountFactor) 
        : 0.85;
      const tItems = sanitizeLineItems(t.lineItems || t.items || []);
      return {
        id: pId,
        Produit: pName,
        name: pName,
        rabais,
        lineItems: tItems.length > 0 ? tItems : [
          { concepto: "Precio Base", valorLocal: 1000 },
          { concepto: "Envase (Big Bag / Sac)", valorLocal: 100 },
          { concepto: "Logística Inland", valorLocal: 200 },
          { concepto: "Gastos de tránsito", valorLocal: 50 },
          { concepto: "Gastos portuarios", valorLocal: 80 }
        ]
      };
    });

    const defaultLineItems = cleanTarifas.length > 0 && cleanTarifas[0].lineItems
      ? cleanTarifas[0].lineItems
      : (Array.isArray(parsedData?.lineItems) ? sanitizeLineItems(parsedData.lineItems) : [{ concepto: "Flete", valorLocal: 500 }]);

    return new Response(JSON.stringify({
      currency,
      exchangeRate,
      lineItems: defaultLineItems,
      tarifas: cleanTarifas,
      products: cleanTarifas
    }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('[parse-tariff] Error interno:', error);
    return new Response(JSON.stringify({
      currency: "TRY",
      exchangeRate: 0.03,
      lineItems: [{ concepto: "Flete Base", valorLocal: 500 }],
      tarifas: [],
      error: error?.message || 'Error en el procesamiento del archivo'
    }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }
};
