const { translate } = require('@vitalets/google-translate-api');

// Cache for translations to avoid repeated API calls
const translationCache = new Map();

/**
 * Translate text to target language
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code (en, ms, ta, zh-CN)
 * @returns {Promise<string>} - Translated text
 */
async function translateText(text, targetLang = 'en') {
    // Skip translation for English
    if (!text || targetLang === 'en') {
        console.log('⏭️ Skipping translation (English or no text)');
        return text;
    }

    // Convert zh to zh-CN for Google Translate
    const langCode = targetLang === 'zh' ? 'zh-CN' : targetLang;
    
    console.log(`🔍 Translating: "${text.substring(0, 50)}..." to ${langCode}`);
    
    // Create cache key
    const cacheKey = `${text}__${langCode}`;
    
    // Check cache first
    if (translationCache.has(cacheKey)) {
        console.log('💾 Using cached translation');
        return translationCache.get(cacheKey);
    }

    try {
        console.log('🌐 Calling Google Translate API...');
        const result = await translate(text, { from: 'en', to: langCode });
        const translatedText = result.text;
        
        console.log(`✅ Translation successful: "${translatedText.substring(0, 50)}..."`);
        
        // Store in cache
        translationCache.set(cacheKey, translatedText);
        
        return translatedText;
    } catch (error) {
        console.error('❌ Translation error:', error.message);
        // Return original text if translation fails
        return text;
    }
}

/**
 * Translate multiple texts at once
 * @param {Array<string>} texts - Array of texts to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<Array<string>>} - Array of translated texts
 */
async function translateMultiple(texts, targetLang = 'en') {
    return Promise.all(texts.map(text => translateText(text, targetLang)));
}

/**
 * Middleware to add translation helper to res.locals
 */
function translationMiddleware(req, res, next) {
    const currentLang = req.session.language || req.cookies.language || 'en';
    
    // Add translation function to res.locals for use in views
    res.locals.t = async (text) => {
        return await translateText(text, currentLang);
    };
    
    res.locals.currentLanguage = currentLang;
    
    next();
}

/**
 * Clear translation cache (useful for development)
 */
function clearCache() {
    translationCache.clear();
}

module.exports = {
    translateText,
    translateMultiple,
    translationMiddleware,
    clearCache
};
