# RPEcoJourney Translation Implementation Guide

## Overview
The RPEcoJourney application now has comprehensive multi-language support for:
- English (en)
- Malay (ms)
- Tamil (ta)
- Chinese (zh)

## Translation System Architecture

### 1. Client-Side Translations (`public/translations.js`)
- Contains all UI text strings in 4 languages
- Uses `t(key)` function to retrieve translations
- Automatically detects language from cookies
- Example: `t('publishContent')` returns "Publish Content" in English

### 2. Server-Side Translations (`locales/`)
- JSON files for each language: `en.json`, `ms.json`, `ta.json`, `zh.json`
- Hierarchical structure for organized translations
- Accessible via `res.locals.getTranslation(key)` in EJS files
- Example: `getTranslation('contentManagement.publishContent')`

### 3. Express Middleware (`middleware/translator.js`)
- Provides `translateText()` for dynamic content translation
- Translates database content on-the-fly using Google Translate API
- Caches translations to avoid repeated API calls

### 4. App Configuration (`app.js`)
- Loads all locale files
- Provides `getTranslation()` helper function in res.locals
- Supports language switching via `/change-language` route

## How to Add Translations to EJS Files

### Method 1: Client-Side Static Translations (for UI text)
```html
<h2 id="pageTitle">Publish Content</h2>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = t('publishContent');
  });
</script>
```

### Method 2: Server-Side Translations (for render-time translations)
```html
<!-- In EJS -->
<h2><%= getTranslation('contentManagement.publishContent') %></h2>
<label><%= getTranslation('forms.username') %></label>
```

### Method 3: Dynamic Content Translations (from database)
```javascript
// In controller
const { translateText } = require('../middleware/translator');

// Translate database content
const translatedTitle = await translateText(dbContent.title, userLanguage);
```

## Translation Keys Available

### Categories
- contentManagement.*
- forms.*
- admin.*
- roles.*
- requests.*
- actions.*
- editor.*
- xpAndMissions.*

### Examples:
```
contentManagement.publishContent = "Publish Content"
contentManagement.updateContent = "Update Content"
forms.username = "Username"
forms.email = "Email"
admin.adminDashboard = "Admin Dashboard"
roles.admin = "Admin"
requests.pending = "Pending"
actions.approve = "Approve"
editor.editor = "Editor"
xpAndMissions.missions = "Missions"
```

## Language Switching

Users can change language by:
1. Posting to `/change-language` with `{ language: 'ms' }`
2. Language preference is stored in:
   - Session (temporary)
   - Cookie (persistent for 1 year)

## Adding New Translations

1. **Add to `public/translations.js`:**
   ```javascript
   en: {
     myNewKey: 'My Translation',
     ...
   },
   ms: {
     myNewKey: 'Terjemahan Saya',
     ...
   },
   // ... ta, zh
   ```

2. **Add to locale JSON files** (`locales/en.json`, etc.):
   ```json
   {
     "newSection": {
       "key": "translation text"
     }
   }
   ```

3. **Use in EJS:**
   ```html
   <!-- Client-side -->
   <element id="elemId">Default Text</element>
   <script>
     document.getElementById('elemId').textContent = t('myNewKey');
   </script>

   <!-- Server-side -->
   <%= getTranslation('newSection.key') %>
   ```

## Important Notes

1. **Database Content:** Dynamic content from the database should use the `translateText()` function to ensure it's translated to the user's language preference.

2. **Nested Keys:** The server-side `getTranslation()` function supports nested keys like `'contentManagement.publishContent'`.

3. **Fallbacks:** If a translation key is not found, the key itself is returned as fallback.

4. **Language Detection:** The system automatically detects language from:
   - `req.session.language` (server-side)
   - Cookie `language` (client-side)
   - Default: English

5. **Translation Caching:** Dynamic translations are cached to improve performance and reduce API calls.

## Files Updated with Translations

### Core Configuration Files
- ✅ `app.js` - Added translation helpers
- ✅ `public/translations.js` - Extended with 50+ new keys
- ✅ `locales/en.json` - Added content management sections
- ✅ `locales/ms.json` - Added Malay translations
- ✅ `locales/ta.json` - Added Tamil translations
- ✅ `locales/zh.json` - Added Chinese translations

### EJS Files Updated
- ✅ `views/index.ejs` (Login page)
- ✅ `views/editContent.ejs` (Content editing)

### EJS Files Still Need Updates
The following EJS files should be updated with translations following the same pattern:
- `addContent.ejs`
- `viewContent.ejs`
- `viewContentByContentType.ejs`
- `addCategory.ejs`
- `editCategory.ejs`
- `categories.ejs`
- `register.ejs`
- `forgot_password.ejs`
- `guest.ejs`
- `adminDashboard.ejs`
- `adminUsers.ejs`
- `editUserRole.ejs`
- `editProfile.ejs`
- `viewProfile.ejs`
- `checkinBoard.ejs`
- `leaderboard.ejs`
- `xphistory.ejs`
- `display.ejs`
- `editor.ejs`
- `aiQuiz.ejs`
- `aiQuizSelect.ejs`
- `aiQuizResult.ejs`
- `contentRequests.ejs`
- `manageContent.ejs`
- `managerRequests.ejs`
- `aboutus.ejs`
- `401.ejs`

## Example: Updating an EJS File

Before:
```html
<h2>Publish Content</h2>
<label>Category:</label>
<button>Publish</button>
```

After:
```html
<h2 id="pageTitle">Publish Content</h2>
<label id="categoryLabel">Category:</label>
<button id="publishBtn">Publish</button>

<script src="/translations.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const pageTitle = document.getElementById('pageTitle');
    const categoryLabel = document.getElementById('categoryLabel');
    const publishBtn = document.getElementById('publishBtn');
    
    if (pageTitle) pageTitle.textContent = t('publishContent');
    if (categoryLabel) categoryLabel.textContent = t('category');
    if (publishBtn) publishBtn.textContent = t('publishBtn');
  });
</script>
```

## Testing Translations

1. **Change Language:** Open browser console and navigate to `/change-language` POST with language code
2. **Verify:** Reload page and check if all UI elements are translated
3. **Database Content:** Ensure database content is passed through `translateText()` in controllers

## Database Content Translation

For content pulled from the database (titles, descriptions, etc.):

```javascript
// In controller
const { translateText } = require('../middleware/translator');

const content = await db.query('SELECT * FROM content');
const userLanguage = req.session.language || 'en';

// Translate if needed (for non-English)
if (userLanguage !== 'en') {
  content.title = await translateText(content.title, userLanguage);
  content.description = await translateText(content.description, userLanguage);
}

res.render('viewContent', { content });
```

## Performance Considerations

1. Translations are cached to avoid repeated API calls
2. Use server-side rendering for critical paths to avoid flash of untranslated content
3. Lazy-load client-side translations for non-critical elements
4. Consider pre-translating popular database content

## Future Improvements

1. Integrate with a dedicated translation management system
2. Add translation proofreading workflow
3. Create admin panel for managing translations
4. Implement translation export/import for easier updates
5. Add more language support as needed
