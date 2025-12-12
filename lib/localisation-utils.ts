import type { Layer, Page } from '@/types';
import { getLayerIcon, findLayerById } from '@/lib/layer-utils';
import type { IconProps } from '@/components/ui/icon';

/**
 * Locale configuration interface
 */
export interface Locale {
  code: string; // Language code (ISO 639-1)
  label: string; // English label
  native_label: string; // Native language label
  rtl?: boolean; // Right-to-left language
}

/**
 * Supported locales with their metadata (ISO 639-1 codes)
 * Sorted alphabetically by english label
 */
export const LOCALES: Locale[] = [
  { code: 'ab', label: 'Abkhaz', native_label: 'аҧсуа' },
  { code: 'aa', label: 'Afar', native_label: 'Afaraf' },
  { code: 'af', label: 'Afrikaans', native_label: 'Afrikaans' },
  { code: 'ak', label: 'Akan', native_label: 'Akan' },
  { code: 'sq', label: 'Albanian', native_label: 'Shqip' },
  { code: 'am', label: 'Amharic', native_label: 'አማርኛ' },
  { code: 'ar', label: 'Arabic', native_label: 'العربية', rtl: true },
  { code: 'ar-eg', label: 'Arabic (Egypt)', native_label: 'العربية (مصر)', rtl: true },
  { code: 'ar-lb', label: 'Arabic (Lebanon)', native_label: 'العربية (لبنان)', rtl: true },
  { code: 'ar-ma', label: 'Arabic (Morocco)', native_label: 'العربية (المغرب)', rtl: true },
  { code: 'ar-sa', label: 'Arabic (Saudi Arabia)', native_label: 'العربية (السعودية)', rtl: true },
  { code: 'an', label: 'Aragonese', native_label: 'Aragonés' },
  { code: 'hy', label: 'Armenian', native_label: 'Հայերեն' },
  { code: 'as', label: 'Assamese', native_label: 'অসমীয়া' },
  { code: 'av', label: 'Avaric', native_label: 'авар мацӀ' },
  { code: 'ae', label: 'Avestan', native_label: 'avesta' },
  { code: 'ay', label: 'Aymara', native_label: 'aymar aru' },
  { code: 'az', label: 'Azerbaijani', native_label: 'azərbaycan dili' },
  { code: 'bm', label: 'Bambara', native_label: 'bamanankan' },
  { code: 'ba', label: 'Bashkir', native_label: 'башҡорт теле' },
  { code: 'eu', label: 'Basque', native_label: 'Euskara' },
  { code: 'be', label: 'Belarusian', native_label: 'Беларуская' },
  { code: 'bn', label: 'Bengali', native_label: 'বাংলা' },
  { code: 'bh', label: 'Bihari', native_label: 'भोजपुरी' },
  { code: 'bi', label: 'Bislama', native_label: 'Bislama' },
  { code: 'bs', label: 'Bosnian', native_label: 'Bosanski' },
  { code: 'br', label: 'Breton', native_label: 'Brezhoneg' },
  { code: 'bg', label: 'Bulgarian', native_label: 'Български' },
  { code: 'my', label: 'Burmese', native_label: 'ဗမာစာ' },
  { code: 'ca', label: 'Catalan', native_label: 'Català' },
  { code: 'ch', label: 'Chamorro', native_label: 'Chamoru' },
  { code: 'ce', label: 'Chechen', native_label: 'нохчийн мотт' },
  { code: 'ny', label: 'Chichewa', native_label: 'chiCheŵa' },
  { code: 'zh', label: 'Chinese', native_label: '中文' },
  { code: 'zh-hk', label: 'Chinese (Hong Kong)', native_label: '繁體中文 (香港)' },
  { code: 'zh-cn', label: 'Chinese (Simplified)', native_label: '简体中文' },
  { code: 'zh-tw', label: 'Chinese (Traditional)', native_label: '繁體中文 (台灣)' },
  { code: 'cv', label: 'Chuvash', native_label: 'чӑваш чӗлхи' },
  { code: 'kw', label: 'Cornish', native_label: 'Kernewek' },
  { code: 'co', label: 'Corsican', native_label: 'Lingua corsa' },
  { code: 'cr', label: 'Cree', native_label: 'ᓀᐦᐃᔭᐍᐏᐣ' },
  { code: 'hr', label: 'Croatian', native_label: 'Hrvatski' },
  { code: 'cs', label: 'Czech', native_label: 'Čeština' },
  { code: 'da', label: 'Danish', native_label: 'Dansk' },
  { code: 'dv', label: 'Divehi', native_label: 'ދިވެހި', rtl: true },
  { code: 'nl', label: 'Dutch', native_label: 'Nederlands' },
  { code: 'en', label: 'English', native_label: 'English' },
  { code: 'en-au', label: 'English (Australia)', native_label: 'English (Australia)' },
  { code: 'en-ca', label: 'English (Canada)', native_label: 'English (Canada)' },
  { code: 'en-in', label: 'English (India)', native_label: 'English (India)' },
  { code: 'en-nz', label: 'English (New Zealand)', native_label: 'English (New Zealand)' },
  { code: 'en-gb', label: 'English (United Kingdom)', native_label: 'English (United Kingdom)' },
  { code: 'en-us', label: 'English (United States)', native_label: 'English (United States)' },
  { code: 'eo', label: 'Esperanto', native_label: 'Esperanto' },
  { code: 'et', label: 'Estonian', native_label: 'Eesti' },
  { code: 'ee', label: 'Ewe', native_label: 'Eʋegbe' },
  { code: 'fo', label: 'Faroese', native_label: 'føroyskt' },
  { code: 'fj', label: 'Fijian', native_label: 'vosa Vakaviti' },
  { code: 'fi', label: 'Finnish', native_label: 'Suomi' },
  { code: 'fr', label: 'French', native_label: 'Français' },
  { code: 'fr-ca', label: 'French (Canada)', native_label: 'Français (Canada)' },
  { code: 'fr-fr', label: 'French (France)', native_label: 'Français (France)' },
  { code: 'fr-ch', label: 'French (Switzerland)', native_label: 'Français (Suisse)' },
  { code: 'ff', label: 'Fula', native_label: 'Fulfulde' },
  { code: 'gl', label: 'Galician', native_label: 'Galego' },
  { code: 'ka', label: 'Georgian', native_label: 'ქართული' },
  { code: 'de', label: 'German', native_label: 'Deutsch' },
  { code: 'de-at', label: 'German (Austria)', native_label: 'Deutsch (Österreich)' },
  { code: 'de-de', label: 'German (Germany)', native_label: 'Deutsch (Deutschland)' },
  { code: 'de-ch', label: 'German (Switzerland)', native_label: 'Deutsch (Schweiz)' },
  { code: 'el', label: 'Greek', native_label: 'Ελληνικά' },
  { code: 'kl', label: 'Greenlandic', native_label: 'Kalaallisut' },
  { code: 'gn', label: 'Guaraní', native_label: 'Avañeẽ' },
  { code: 'gu', label: 'Gujarati', native_label: 'ગુજરાતી' },
  { code: 'ht', label: 'Haitian Creole', native_label: 'Kreyòl ayisyen' },
  { code: 'ha', label: 'Hausa', native_label: 'Hausa' },
  { code: 'he', label: 'Hebrew', native_label: 'עברית', rtl: true },
  { code: 'hz', label: 'Herero', native_label: 'Otjiherero' },
  { code: 'hi', label: 'Hindi', native_label: 'हिन्दी' },
  { code: 'ho', label: 'Hiri Motu', native_label: 'Hiri Motu' },
  { code: 'hu', label: 'Hungarian', native_label: 'Magyar' },
  { code: 'is', label: 'Icelandic', native_label: 'Íslenska' },
  { code: 'io', label: 'Ido', native_label: 'Ido' },
  { code: 'ig', label: 'Igbo', native_label: 'Asụsụ Igbo' },
  { code: 'id', label: 'Indonesian', native_label: 'Bahasa Indonesia' },
  { code: 'ia', label: 'Interlingua', native_label: 'Interlingua' },
  { code: 'ie', label: 'Interlingue', native_label: 'Interlingue (Occidental)' },
  { code: 'iu', label: 'Inuktitut', native_label: 'ᐃᓄᒃᑎᑐᑦ' },
  { code: 'ik', label: 'Inupiaq', native_label: 'Iñupiaq' },
  { code: 'ga', label: 'Irish', native_label: 'Gaeilge' },
  { code: 'it', label: 'Italian', native_label: 'Italiano' },
  { code: 'ja', label: 'Japanese', native_label: '日本語' },
  { code: 'jv', label: 'Javanese', native_label: 'Basa Jawa' },
  { code: 'kn', label: 'Kannada', native_label: 'ಕನ್ನಡ' },
  { code: 'kr', label: 'Kanuri', native_label: 'Kanuri' },
  { code: 'ks', label: 'Kashmiri', native_label: 'كشميري', rtl: true },
  { code: 'kk', label: 'Kazakh', native_label: 'Қазақ тілі' },
  { code: 'km', label: 'Khmer', native_label: 'ភាសាខ្មែរ' },
  { code: 'ki', label: 'Kikuyu', native_label: 'Gĩkũyũ' },
  { code: 'rw', label: 'Kinyarwanda', native_label: 'Ikinyarwanda' },
  { code: 'rn', label: 'Kirundi', native_label: 'Kirundi' },
  { code: 'kv', label: 'Komi', native_label: 'коми кыв' },
  { code: 'kg', label: 'Kongo', native_label: 'KiKongo' },
  { code: 'ko', label: 'Korean', native_label: '한국어' },
  { code: 'ku', label: 'Kurdish', native_label: 'کوردی', rtl: true },
  { code: 'kj', label: 'Kwanyama', native_label: 'Kuanyama' },
  { code: 'ky', label: 'Kyrgyz', native_label: 'Кыргызча' },
  { code: 'lo', label: 'Lao', native_label: 'ພາສາລາວ' },
  { code: 'la', label: 'Latin', native_label: 'Latina' },
  { code: 'lv', label: 'Latvian', native_label: 'Latviešu' },
  { code: 'li', label: 'Limburgish', native_label: 'Limburgs' },
  { code: 'ln', label: 'Lingala', native_label: 'Lingála' },
  { code: 'lt', label: 'Lithuanian', native_label: 'Lietuvių' },
  { code: 'lu', label: 'Luba-Katanga', native_label: '' },
  { code: 'lg', label: 'Luganda', native_label: 'Luganda' },
  { code: 'lb', label: 'Luxembourgish', native_label: 'Lëtzebuergesch' },
  { code: 'mk', label: 'Macedonian', native_label: 'македонски јазик' },
  { code: 'mg', label: 'Malagasy', native_label: 'Malagasy fiteny' },
  { code: 'ms', label: 'Malay', native_label: 'Bahasa Melayu' },
  { code: 'ml', label: 'Malayalam', native_label: 'മലയാളം' },
  { code: 'mt', label: 'Maltese', native_label: 'Malti' },
  { code: 'gv', label: 'Manx', native_label: 'Gaelg' },
  { code: 'mi', label: 'Māori', native_label: 'te reo Māori' },
  { code: 'mr', label: 'Marathi', native_label: 'मराठी' },
  { code: 'mh', label: 'Marshallese', native_label: 'Kajin M̧ajeļ' },
  { code: 'mn', label: 'Mongolian', native_label: 'монгол' },
  { code: 'na', label: 'Nauru', native_label: 'Ekakairũ Naoero' },
  { code: 'nv', label: 'Navajo', native_label: 'Diné bizaad' },
  { code: 'ng', label: 'Ndonga', native_label: 'Owambo' },
  { code: 'ne', label: 'Nepali', native_label: 'नेपाली' },
  { code: 'nd', label: 'North Ndebele', native_label: 'isiNdebele' },
  { code: 'se', label: 'Northern Sami', native_label: 'Davvisámegiella' },
  { code: 'no', label: 'Norwegian', native_label: 'Norsk' },
  { code: 'nb', label: 'Norwegian Bokmål', native_label: 'Norsk bokmål' },
  { code: 'nn', label: 'Norwegian Nynorsk', native_label: 'Norsk nynorsk' },
  { code: 'ii', label: 'Nuosu', native_label: 'ꆈꌠ꒿ Nuosuhxop' },
  { code: 'oc', label: 'Occitan', native_label: 'Occitan' },
  { code: 'oj', label: 'Ojibwe', native_label: 'ᐊᓂᔑᓈᐯᒧᐎᓐ' },
  { code: 'cu', label: 'Old Church Slavonic', native_label: 'Словѣньскъ' },
  { code: 'or', label: 'Oriya', native_label: 'ଓଡ଼ିଆ' },
  { code: 'om', label: 'Oromo', native_label: 'Afaan Oromoo' },
  { code: 'os', label: 'Ossetian', native_label: 'ирон æвзаг' },
  { code: 'pi', label: 'Pāli', native_label: 'पाऴि' },
  { code: 'ps', label: 'Pashto', native_label: 'پښتو' },
  { code: 'fa', label: 'Persian', native_label: 'فارسی', rtl: true },
  { code: 'pl', label: 'Polish', native_label: 'Polski' },
  { code: 'pt', label: 'Portuguese', native_label: 'Português' },
  { code: 'pt-br', label: 'Portuguese (Brazil)', native_label: 'Português (Brasil)' },
  { code: 'pt-pt', label: 'Portuguese (Portugal)', native_label: 'Português (Portugal)' },
  { code: 'pa', label: 'Punjabi', native_label: 'ਪੰਜਾਬੀ' },
  { code: 'qu', label: 'Quechua', native_label: 'Runa Simi, Kichwa' },
  { code: 'ro', label: 'Romanian', native_label: 'Română' },
  { code: 'rm', label: 'Romansh', native_label: 'rumantsch grischun' },
  { code: 'ru', label: 'Russian', native_label: 'Русский' },
  { code: 'sm', label: 'Samoan', native_label: 'Gagana Samoa' },
  { code: 'sg', label: 'Sango', native_label: 'Sängö' },
  { code: 'sa', label: 'Sanskrit', native_label: 'संस्कृतम्' },
  { code: 'sc', label: 'Sardinian', native_label: 'Sardu' },
  { code: 'gd', label: 'Scottish Gaelic', native_label: 'Gàidhlig' },
  { code: 'sr', label: 'Serbian', native_label: 'Српски' },
  { code: 'sn', label: 'Shona', native_label: 'chiShona' },
  { code: 'sd', label: 'Sindhi', native_label: 'سنڌي', rtl: true },
  { code: 'si', label: 'Sinhala', native_label: 'සිංහල' },
  { code: 'sk', label: 'Slovak', native_label: 'Slovenčina' },
  { code: 'sl', label: 'Slovene', native_label: 'Slovenščina' },
  { code: 'so', label: 'Somali', native_label: 'Soomaali' },
  { code: 'nr', label: 'South Ndebele', native_label: 'isiNdebele' },
  { code: 'st', label: 'Southern Sotho', native_label: 'Sesotho' },
  { code: 'es', label: 'Spanish', native_label: 'Español' },
  { code: 'es-ar', label: 'Spanish (Argentina)', native_label: 'Español (Argentina)' },
  { code: 'es-cl', label: 'Spanish (Chile)', native_label: 'Español (Chile)' },
  { code: 'es-co', label: 'Spanish (Colombia)', native_label: 'Español (Colombia)' },
  { code: 'es-mx', label: 'Spanish (Mexico)', native_label: 'Español (México)' },
  { code: 'es-es', label: 'Spanish (Spain)', native_label: 'Español (España)' },
  { code: 'su', label: 'Sundanese', native_label: 'Basa Sunda' },
  { code: 'sw', label: 'Swahili', native_label: 'Kiswahili' },
  { code: 'ss', label: 'Swati', native_label: 'SiSwati' },
  { code: 'sv', label: 'Swedish', native_label: 'Svenska' },
  { code: 'tl', label: 'Tagalog', native_label: 'Tagalog' },
  { code: 'ty', label: 'Tahitian', native_label: 'Reo Tahiti' },
  { code: 'tg', label: 'Tajik', native_label: 'Тоҷикӣ' },
  { code: 'ta', label: 'Tamil', native_label: 'தமிழ்' },
  { code: 'tt', label: 'Tatar', native_label: 'Татарча' },
  { code: 'te', label: 'Telugu', native_label: 'తెలుగు' },
  { code: 'th', label: 'Thai', native_label: 'ไทย' },
  { code: 'bo', label: 'Tibetan', native_label: 'བོད་ཡིག' },
  { code: 'ti', label: 'Tigrinya', native_label: 'ትግርኛ' },
  { code: 'to', label: 'Tonga', native_label: 'Lea fakatonga' },
  { code: 'ts', label: 'Tsonga', native_label: 'Xitsonga' },
  { code: 'tn', label: 'Tswana', native_label: 'Setswana' },
  { code: 'tr', label: 'Turkish', native_label: 'Türkçe' },
  { code: 'tk', label: 'Turkmen', native_label: 'Türkmen' },
  { code: 'tw', label: 'Twi', native_label: 'Twi' },
  { code: 'ug', label: 'Uyghur', native_label: 'ئۇيغۇرچە', rtl: true },
  { code: 'uk', label: 'Ukrainian', native_label: 'Українська' },
  { code: 'ur', label: 'Urdu', native_label: 'اردو', rtl: true },
  { code: 'uz', label: 'Uzbek', native_label: 'Oʻzbekcha' },
  { code: 've', label: 'Venda', native_label: 'Tshivenḓa' },
  { code: 'vi', label: 'Vietnamese', native_label: 'Tiếng Việt' },
  { code: 'vo', label: 'Volapük', native_label: 'Volapük' },
  { code: 'wa', label: 'Walloon', native_label: 'Walon' },
  { code: 'cy', label: 'Welsh', native_label: 'Cymraeg' },
  { code: 'fy', label: 'Western Frisian', native_label: 'Frysk' },
  { code: 'wo', label: 'Wolof', native_label: 'Wollof' },
  { code: 'xh', label: 'Xhosa', native_label: 'isiXhosa' },
  { code: 'yi', label: 'Yiddish', native_label: 'ייִדיש' },
  { code: 'yo', label: 'Yoruba', native_label: 'Yorùbá' },
  { code: 'za', label: 'Zhuang', native_label: 'Saɯ cueŋƅ' },
  { code: 'zu', label: 'Zulu', native_label: 'isiZulu' },
];

// Maps and sets for faster lookups
const LOCALES_BY_CODE = new Map<string, Locale>(LOCALES.map((locale) => [locale.code, locale]));
const LOCALES_CODES = new Set<string>(LOCALES.map((locale) => locale.code));

/**
 * Get locale by code
 */
export function getLocaleByCode(code: string): Locale | undefined {
  return LOCALES_BY_CODE.get(code);
}

/**
 * Check if a locale code is supported
 */
export function isLocaleCodeSupported(code: string): boolean {
  return LOCALES_CODES.has(code);
}

/**
 * Check if a locale is right-to-left
 */
export function isLocaleRtl(locale: Locale): boolean {
  return locale.rtl === true;
}

/**
 * Translatable item extracted from pages
 */
export interface TranslatableItem {
  id: string; // Unique identifier for this item
  type: 'slug' | 'seo_title' | 'seo_description' | 'layer_text';
  layerId?: string; // Layer ID (for layer_text type)
  label: string; // Display label (e.g., "SEO Title", "Heading Layer")
  description?: string; // Optional description text
  value: string; // Current text value (may contain inline variables)
  key: string; // Translation key for storage (e.g., "page:pageId:layer:layerId:text" or "page:pageId:seo:title")
}

/**
 * Extract text from a layer (includes text with inline variables)
 */
function extractLayerText(layer: Layer): string | null {
  let text: string | null = null;

  // Check variables.text for inline variables
  if (layer.variables?.text && typeof layer.variables.text === 'string') {
    text = layer.variables.text;
  }
  // Check legacy text property
  else if (typeof layer.text === 'string') {
    text = layer.text;
  }
  // Check legacy content property
  else if (typeof layer.content === 'string') {
    text = layer.content;
  }
  // Skip if text is a FieldVariable object (not inline)
  else if (layer.text && typeof layer.text === 'object' && layer.text.type === 'field') {
    return null;
  }

  if (!text || !text.trim()) {
    return null;
  }

  return text.trim();
}

/**
 * Recursively extract all translatable text items from layers
 */
function extractLayerTexts(
  layers: Layer[],
  pageId: string,
  items: TranslatableItem[]
): void {
  for (const layer of layers) {
    const layerLabel = layer.customName || layer.name || 'Layer';

    // Extract text from this layer (including inline variables)
    const text = extractLayerText(layer);
    if (text) {
      items.push({
        id: `${pageId}:layer:${layer.id}:text`,
        type: 'layer_text',
        layerId: layer.id,
        label: layerLabel,
        value: text,
        key: `page:${pageId}:layer:${layer.id}:text`,
      });
    }

    // Recursively process children
    if (layer.children && Array.isArray(layer.children) && layer.children.length > 0) {
      extractLayerTexts(layer.children, pageId, items);
    }
  }
}

/**
 * Extract SEO translatable items from page settings
 */
function extractSeoItems(
  pageId: string,
  seo: { title?: string; description?: string } | undefined,
  items: TranslatableItem[]
): void {
  if (!seo) return;

  if (seo.title && typeof seo.title === 'string' && seo.title.trim()) {
    items.push({
      id: `${pageId}:seo:title`,
      type: 'seo_title',
      label: 'SEO Title',
      value: seo.title.trim(),
      key: `page:${pageId}:seo:title`,
    });
  }

  if (seo.description && typeof seo.description === 'string' && seo.description.trim()) {
    items.push({
      id: `${pageId}:seo:description`,
      type: 'seo_description',
      label: 'SEO Description',
      value: seo.description.trim(),
      key: `page:${pageId}:seo:description`,
    });
  }
}

/**
 * Extract all translatable items from a page (slug, SEO, and layers)
 * Ordered: slug first, then SEO settings, then layer texts
 * Note: Dynamic page slugs are excluded from translation
 */
export function extractPageTranslatableItems(
  page: Page,
  layers: Layer[]
): TranslatableItem[] {
  const items: TranslatableItem[] = [];

  // 1. Extract slug (first) - exclude dynamic pages
  if (!page.is_dynamic && page.slug && page.slug.trim()) {
    items.push({
      id: `${page.id}:slug`,
      type: 'slug',
      label: 'Page slug',
      description: 'Changing this will affect URLs generated by your website',
      value: page.slug.trim(),
      key: `page:${page.id}:slug`,
    });
  }

  // 2. Extract SEO items (second)
  extractSeoItems(page.id, page.settings?.seo, items);

  // 3. Extract layer texts (third)
  if (layers && Array.isArray(layers) && layers.length > 0) {
    extractLayerTexts(layers, page.id, items);
  }

  return items;
}

/**
 * Get the icon name for a translatable item
 * @param item - The translatable item
 * @param layers - Array of layers (required for layer_text type)
 * @returns Icon name for the item
 */
export function getTranslatableItemIcon(
  item: TranslatableItem,
  layers: Layer[]
): IconProps['name'] {
  if (item.type === 'slug') {
    return 'link';
  }

  if (item.type === 'seo_title' || item.type === 'seo_description') {
    return 'search';
  }

  if (item.type === 'layer_text') {
    const layer = item.layerId ? findLayerById(layers, item.layerId) : null;
    return layer ? getLayerIcon(layer) : 'block';
  }

  return 'block';
}
