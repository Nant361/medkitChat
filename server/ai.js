const AI_PROMPT_TEMPLATE = [
  'Anda adalah asisten edukasi kesehatan awal.',
  'Berikan informasi umum, bukan diagnosis.',
  'Jawaban harus singkat, jelas, dan aman.',
  'Selalu sarankan konsultasi dokter untuk keputusan akhir.',
  'Jika ada tanda gawat darurat, sarankan segera ke IGD.',
  'Gunakan bullet "-" dan hindari markdown tebal.'
].join('\n');

const AI_SAFETY_RULES = [
  'Tidak memberikan diagnosis pasti.',
  'Tidak menyarankan obat keras tanpa resep.',
  'Berfokus pada edukasi umum dan langkah aman di rumah.',
  'Mendorong konsultasi dokter untuk keputusan medis.'
];

const TOPIC_TIPS = [
  {
    match: /demam|panas|suhu/i,
    advice: [
      'Istirahat cukup dan minum cairan hangat.',
      'Pantau suhu tubuh setiap 4-6 jam.',
      'Jika demam lebih dari 3 hari, konsultasi dokter.'
    ],
    redFlags: ['Demam sangat tinggi lebih dari 39C', 'Kejang', 'Sesak napas']
  },
  {
    match: /batuk|pilek|flu|tenggorokan/i,
    advice: [
      'Perbanyak minum air putih dan hindari asap rokok.',
      'Berkumur air hangat untuk membantu tenggorokan.',
      'Gunakan masker jika batuk untuk mencegah penularan.'
    ],
    redFlags: ['Batuk berdarah', 'Sesak napas', 'Nyeri dada berat']
  },
  {
    match: /sakit kepala|pusing|migrain/i,
    advice: [
      'Istirahat di ruangan tenang dan cukup tidur.',
      'Batasi kafein jika memicu pusing.',
      'Catat pemicu seperti stres atau kurang tidur.'
    ],
    redFlags: ['Sakit kepala mendadak sangat hebat', 'Kelemahan pada satu sisi tubuh', 'Sulit bicara']
  },
  {
    match: /nyeri dada|sesak|nafas/i,
    advice: [
      'Hentikan aktivitas berat dan duduk dengan posisi nyaman.',
      'Hindari merokok dan paparan polusi.',
      'Cari bantuan medis jika gejala tidak membaik.'
    ],
    redFlags: ['Nyeri dada menjalar ke lengan atau rahang', 'Sesak napas berat', 'Pingsan']
  },
  {
    match: /mual|muntah|diare|perut/i,
    advice: [
      'Minum oralit atau cairan elektrolit untuk mencegah dehidrasi.',
      'Hindari makanan pedas dan berlemak sementara.',
      'Makan porsi kecil dan sering.'
    ],
    redFlags: ['Muntah terus-menerus', 'BAB berdarah', 'Tanda dehidrasi berat']
  }
];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HAS_GEMINI_KEY =
  GEMINI_API_KEY && GEMINI_API_KEY.trim() && GEMINI_API_KEY !== 'your_gemini_api_key_here';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_ENDPOINT = HAS_GEMINI_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
  : null;

function findTopicTips(text) {
  if (!text) return null;
  return TOPIC_TIPS.find((item) => item.match.test(text));
}

function buildPrompt({ complaint, patient }) {
  const profile = patient
    ? `Profil pasien: ${patient.name}, ${patient.age || '-'} tahun, ${patient.gender || '-'}.`
    : 'Profil pasien: tidak tersedia.';

  return [
    AI_PROMPT_TEMPLATE,
    '',
    'Aturan keamanan:',
    ...AI_SAFETY_RULES.map((rule) => `- ${rule}`),
    '',
    'Format harus plain text (tanpa markdown tebal/italic).',
    '',
    'Gunakan format jawaban berikut:',
    'Jawaban AI (edukasi awal, bukan diagnosis):',
    'Ringkasan keluhan: <ringkas singkat>',
    'Profil singkat: <opsional jika ada data>',
    '',
    'Edukasi awal:',
    '- <poin 1>',
    '- <poin 2>',
    '- <poin 3>',
    '',
    'Tanda bahaya yang perlu segera ke IGD:',
    '- <poin 1>',
    '- <poin 2>',
    '- <poin 3>',
    '',
    'Keputusan akhir tetap oleh dokter. Silakan lanjutkan konsultasi untuk penilaian lebih lanjut.',
    '',
    'Keluhan pasien:',
    complaint || 'Tidak disebutkan.',
    profile
  ].join('\n');
}

function normalizeAiText(text) {
  let output = (text || '').trim();
  if (!output) return output;

  output = output.replace(/\r\n/g, '\n');
  output = output.replace(/^\s*[*•]\s*/gm, '- ');
  output = output.replace(/^\s*-\s*\*\*(.*?)\*\*/gm, '- $1');
  output = output.replace(/\*\*(.*?)\*\*/g, '$1');

  if (!/Jawaban AI/i.test(output)) {
    output = `Jawaban AI (edukasi awal, bukan diagnosis):\n${output}`;
  }

  if (!/Keputusan akhir tetap oleh dokter/i.test(output)) {
    output = `${output}\n\nKeputusan akhir tetap oleh dokter. Silakan lanjutkan konsultasi untuk penilaian lebih lanjut.`;
  }

  return output;
}

function countBulletsBetween(lines, startRegex, endRegex) {
  const startIndex = lines.findIndex((line) => startRegex.test(line));
  if (startIndex < 0) return 0;
  let count = 0;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (endRegex && endRegex.test(line)) break;
    if (/^\s*[-*•]\s+/.test(line)) count += 1;
  }
  return count;
}

function needsFallback(text) {
  if (!text || text.length < 180) return true;
  if (!/Edukasi awal/i.test(text) || !/Tanda bahaya/i.test(text)) return true;
  const lines = text.split('\n');
  const edukasiCount = countBulletsBetween(lines, /Edukasi awal/i, /Tanda bahaya/i);
  const redFlagCount = countBulletsBetween(
    lines,
    /Tanda bahaya/i,
    /Keputusan akhir tetap/i
  );
  return edukasiCount < 2 || redFlagCount < 2;
}

async function fetchGeminiResponse({ complaint, patient }) {
  if (!GEMINI_ENDPOINT) {
    throw new Error('Gemini endpoint not configured');
  }
  if (typeof fetch !== 'function') {
    throw new Error('Fetch is not available');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt({ complaint, patient }) }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
          responseMimeType: 'text/plain'
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      let errorMessage = `Gemini API error (${response.status})`;
      try {
        const errorBody = await response.json();
        if (errorBody?.error?.message) {
          errorMessage = errorBody.error.message;
        }
      } catch (error) {
        // Ignore parse failure and keep generic message.
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join('')
      .trim();

    if (!text) {
      throw new Error('Gemini returned empty response');
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function generateLocalResponse({ complaint, patient }) {
  const tips = findTopicTips(complaint);
  const header = `Ringkasan keluhan: ${complaint || 'Tidak disebutkan.'}`;
  const profile = patient
    ? `Profil singkat: ${patient.name}, ${patient.age || '-'} tahun, ${patient.gender || '-'}.`
    : null;

  const generalAdvice = tips
    ? tips.advice
    : [
        'Perhatikan perubahan gejala dari waktu ke waktu.',
        'Cukupi istirahat dan cairan.',
        'Hindari aktivitas yang memperberat keluhan.'
      ];

  const redFlags = tips
    ? tips.redFlags
    : ['Nyeri hebat mendadak', 'Sesak napas', 'Penurunan kesadaran'];

  return [
    'Jawaban AI (edukasi awal, bukan diagnosis):',
    header,
    profile,
    '',
    'Edukasi awal:',
    ...generalAdvice.map((item) => `- ${item}`),
    '',
    'Tanda bahaya yang perlu segera ke IGD:',
    ...redFlags.map((item) => `- ${item}`),
    '',
    'Keputusan akhir tetap oleh dokter. Silakan lanjutkan konsultasi untuk penilaian lebih lanjut.'
  ]
    .filter(Boolean)
    .join('\n');
}

async function generateAiResponse({ complaint, patient }) {
  if (HAS_GEMINI_KEY && typeof fetch === 'function') {
    try {
      const text = await fetchGeminiResponse({ complaint, patient });
      const normalized = normalizeAiText(text);
      if (!needsFallback(normalized)) {
        return normalized;
      }
      console.warn('Gemini response incomplete, using local response.');
    } catch (error) {
      console.warn(`Gemini fallback to local response: ${error.message}`);
    }
  }

  return generateLocalResponse({ complaint, patient });
}

function getAiMeta() {
  return {
    template: AI_PROMPT_TEMPLATE,
    safetyRules: AI_SAFETY_RULES,
    provider: 'gemini',
    configured: Boolean(HAS_GEMINI_KEY && typeof fetch === 'function'),
    model: GEMINI_MODEL
  };
}

module.exports = {
  AI_PROMPT_TEMPLATE,
  AI_SAFETY_RULES,
  generateAiResponse,
  generateLocalResponse,
  getAiMeta
};
