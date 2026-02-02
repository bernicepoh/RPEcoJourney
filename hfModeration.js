

const HF_API_URL =
  "https://router.huggingface.co/hf-inference/models/unitary/toxic-bert";

async function isUnsafeComment(text) {
  console.log('🔍 Checking comment with Hugging Face...');
  console.log('📝 Comment text:', text);
  console.log('🔑 HF Token exists:', !!process.env.HF_API_TOKEN);
  console.log('🔑 HF Token preview:', process.env.HF_API_TOKEN ? process.env.HF_API_TOKEN.substring(0, 10) + '...' : 'MISSING');
  
  const res = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  console.log('📡 HF Response status:', res.status);
  
  const data = await res.json();
  
  console.log('📡 HF Response data:', JSON.stringify(data).substring(0, 200));

  
  if (!res.ok || data.error) {
    console.error('❌ HF Error response:', data);
    throw new Error(data.error || "Hugging Face inference failed");
  }

  const labels = Array.isArray(data[0]) ? data[0] : data;

  console.log('📊 Labels:', JSON.stringify(labels).substring(0, 200));

  const TOXIC_THRESHOLD = 0.7;
  const INSULT_THRESHOLD = 0.7;
  const OBSCENE_THRESHOLD = 0.6;

  let toxic = 0,
    insult = 0,
    obscene = 0;

  for (const item of labels) {
    const label = (item.label || "").toLowerCase();
    if (label === "toxic") toxic = item.score || 0;
    if (label === "insult") insult = item.score || 0;
    if (label === "obscene") obscene = item.score || 0;
  }

  console.log('📊 Scores:', { toxic, insult, obscene });

  const isFlagged = toxic >= TOXIC_THRESHOLD ||
    insult >= INSULT_THRESHOLD ||
    obscene >= OBSCENE_THRESHOLD;

  console.log('✅ Is flagged:', isFlagged);

  // Same role as OpenAI: unsafe = true / safe = false
  return isFlagged;
}

module.exports = { isUnsafeComment };