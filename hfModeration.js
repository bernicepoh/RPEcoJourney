

const HF_API_URL =
  "https://router.huggingface.co/hf-inference/models/unitary/toxic-bert";

async function isUnsafeComment(text) {
  const res = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  const data = await res.json();

  
  if (!res.ok || data.error) {
    throw new Error(data.error || "Hugging Face inference failed");
  }

  const labels = Array.isArray(data[0]) ? data[0] : data;

 
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

  
  return (
    toxic >= TOXIC_THRESHOLD ||
    insult >= INSULT_THRESHOLD ||
    obscene >= OBSCENE_THRESHOLD
  );
}

module.exports = { isUnsafeComment };