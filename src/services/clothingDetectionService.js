const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DETECTION_PROMPT = `You are an expert fashion AI. Analyze this clothing image and return a JSON object with the following fields:
{
  "name": "descriptive name of the clothing item",
  "category": one of ["Formal Shirt","Casual Shirt","Polo Shirt","T-Shirt","Hoodie","Jacket","Formal Pant","Jeans","Chinos","Joggers","Shorts","Formal Shoes","Sneakers","Sports Shoes","Sandals","Watch","Belt","Sunglasses","Cap"],
  "primaryColor": "main color of the item (lowercase, single word or short phrase like 'navy blue')",
  "secondaryColor": "secondary color if present, null otherwise",
  "style": one of ["classic","modern","sporty","bohemian","minimalist","streetwear"],
  "occasion": array of ["casual","formal","business","sport","party"] that apply,
  "season": array of ["spring","summer","autumn","winter","all"] that apply,
  "confidence": number between 0 and 1 indicating detection confidence
}
Return ONLY valid JSON, no explanation.`;

const detectClothingFromImage = async (imageUrl) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { detected: false, confidence: 0 };
  }

  try {
    let imageData;
    let mediaType = 'image/jpeg';

    if (imageUrl.startsWith('data:')) {
      const [header, base64] = imageUrl.split(',');
      mediaType = header.split(':')[1].split(';')[0];
      imageData = { type: 'base64', media_type: mediaType, data: base64 };
    } else {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      const contentType = response.headers['content-type'] || 'image/jpeg';
      mediaType = contentType.split(';')[0];
      const base64 = Buffer.from(response.data).toString('base64');
      imageData = { type: 'base64', media_type: mediaType, data: base64 };
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: imageData },
            { type: 'text', text: DETECTION_PROMPT },
          ],
        },
      ],
    });

    const text = message.content[0]?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { detected: false, confidence: 0 };

    const result = JSON.parse(jsonMatch[0]);
    return {
      detected: true,
      name: result.name,
      category: result.category,
      primaryColor: result.primaryColor?.toLowerCase(),
      secondaryColor: result.secondaryColor?.toLowerCase() || null,
      style: result.style,
      occasion: result.occasion || ['casual'],
      season: result.season || ['all'],
      confidence: result.confidence || 0.8,
    };
  } catch (error) {
    console.error('Clothing detection error:', error.message);
    return { detected: false, confidence: 0, error: error.message };
  }
};

const getFashionAdvice = async (userMessage, wardrobe, occasion, weather) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return 'AI fashion assistant is not configured. Please set ANTHROPIC_API_KEY.';
  }

  const wardrobeContext = wardrobe
    .slice(0, 50)
    .map(
      (item) =>
        `- ${item.name} (${item.category}, Color: ${item.color?.primary}, Occasion: ${item.occasion?.join('/')}, Season: ${item.season?.join('/')})`
    )
    .join('\n');

  const systemPrompt = `You are WardrobeAI, a personal fashion assistant. You help users create outfits using ONLY the clothes they own.

IMPORTANT RULES:
1. ONLY suggest clothing items from the user's wardrobe listed below.
2. NEVER suggest clothes the user doesn't own.
3. Always explain color coordination and style reasoning.
4. Be encouraging and personalized.
5. If the wardrobe lacks items for an occasion, suggest the best available alternatives.
6. Keep responses concise and practical.

USER'S WARDROBE:
${wardrobeContext}

Current occasion: ${occasion || 'casual'}
Current weather: ${weather || 'unknown'}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    return message.content[0]?.text || 'I could not generate a response. Please try again.';
  } catch (error) {
    console.error('Fashion advice error:', error.message);
    throw new Error('AI assistant is temporarily unavailable. Please try again later.');
  }
};

module.exports = { detectClothingFromImage, getFashionAdvice };
