import type { Layer, Page, Translation, Locale, LocaleOption } from '@/types';
import { getLayerIcon, getLayerName } from '@/lib/layer-utils';
import type { IconProps } from '@/components/ui/icon';

/**
 * Supported locales with their metadata (ISO 639-1 codes)
 * Sorted alphabetically by english label
 */
export const LOCALES: LocaleOption[] = [
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
const LOCALES_BY_CODE = new Map<string, LocaleOption>(LOCALES.map((locale) => [locale.code, locale]));
const LOCALES_CODES = new Set<string>(LOCALES.map((locale) => locale.code));

/**
 * Get locale by code
 */
export function getLocaleByCode(code: string): LocaleOption | undefined {
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
export function isLocaleRtl(locale: LocaleOption): boolean {
  return locale.rtl === true;
}

/**
 * Translatable item extracted from pages
 */
export interface TranslatableItem {
  key: string; // Unique identifier for the item (same key for all locales)
  source_type: 'page' | 'folder' | 'component' | 'cms'; // Source type (page, foler, component, cms)
  source_id: string; // Source ID (e.g., page ID, folder ID, component ID, collection item ID)
  content_key: string; // Source key (e.g., 'layer:{layerId}:text', 'seo:title', 'slug')
  content_type: 'text' | 'richtext' | 'asset_id'; // Content type (text, richtext, asset)
  content_value: string; // Current text value (may contain inline variables)
  info: {
    icon: IconProps['name']; // Icon name for the item
    label: string; // Item label (e.g., "SEO Title", "Heading")
    description?: string; // Optional item description
  }
}

/**
 * Extract text from a layer (includes text with inline variables)
 */
export function extractLayerText(layer: Layer): string | null {
  // Only use variables.text (DynamicTextVariable)
  if (!layer.variables?.text || layer.variables.text.type !== 'dynamic_text') {
    return null;
  }

  const text = layer.variables.text.data.content;

  if (!text || !text.trim()) {
    return null;
  }

  return text.trim();
}

/**
 * Recursively extract all translatable text items from layers
 */
function extractLayerTranslatableItems(
  layers: Layer[],
  sourceType: 'page' | 'component',
  sourceId: string,
  items: TranslatableItem[]
): void {
  for (const layer of layers) {
    // Extract text from this layer (including inline variables)
    const text = extractLayerText(layer);

    if (text) {
      items.push({
        key: `${sourceType}:${sourceId}:layer:${layer.id}:text`,
        source_type: sourceType,
        source_id: sourceId,
        content_key: `layer:${layer.id}:text`,
        content_type: layer.name === 'richtext' ? 'richtext' : 'text',
        content_value: text,
        info: {
          icon: getLayerIcon(layer),
          label: getLayerName(layer),
        },
      });
    }

    // @todo: Extract alt text from layer.alt property (for images)
    // const alt = layer.alt;
    // if (alt && typeof alt === 'string' && alt.trim()) {
    //   items.push({
    //     key: `${sourceType}:${sourceId}:layer:${layer.id}:alt`,
    //     source_type: sourceType,
    //     source_id: sourceId,
    //     content_key: `layer:${layer.id}:alt`,
    //     content_type: 'text',
    //     content_value: alt.trim(),
    //     info: {
    //       icon: 'image',
    //       label: `${getLayerName(layer)} (alt text)`,
    //     },
    //   });
    // }

    // @todo: Extract static asset ID from image layers
    // if (layer.name === 'image' && layer.[...]) {
    //   const url = layer.url.trim();
    //   // Check if it's an asset URL (starts with /uploads/ or /api/assets/ or is a full asset URL)
    //   const isAssetUrl = true

    //   if (isAssetUrl && url) {
    //     items.push({
    //       key: `${sourceType}:${sourceId}:layer:${layer.id}:image_src`,
    //       source_type: sourceType,
    //       source_id: sourceId,
    //       content_key: `layer:${layer.id}:image_src`,
    //       content_type: 'asset_id',
    //       content_value: url,
    //       info: {
    //         icon: 'image',
    //         label: getLayerName(layer),
    //       },
    //     });
    //   }
    // }

    // Recursively process children
    if (layer.children && Array.isArray(layer.children) && layer.children.length > 0) {
      extractLayerTranslatableItems(layer.children, sourceType, sourceId, items);
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
      key: `page:${pageId}:seo:title`,
      source_type: 'page',
      source_id: pageId,
      content_key: 'seo:title',
      content_type: 'text',
      content_value: seo.title.trim(),
      info: {
        icon: 'search',
        label: 'SEO Title',
      },
    });
  }

  if (seo.description && typeof seo.description === 'string' && seo.description.trim()) {
    items.push({
      key: `page:${pageId}:seo:description`,
      source_type: 'page',
      source_id: pageId,
      content_key: 'seo:description',
      content_type: 'text',
      content_value: seo.description.trim(),
      info: {
        icon: 'search',
        label: 'SEO Description',
      },
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
  layers: Layer[],
  locale?: Locale
): TranslatableItem[] {
  const items: TranslatableItem[] = [];

  // 1. Extract slug (first) - exclude dynamic pages
  if (!page.is_dynamic && page.slug && page.slug.trim()) {
    const localeName = locale?.label || 'localized';
    items.push({
      key: `page:${page.id}:slug`,
      source_type: 'page',
      source_id: page.id,
      content_key: 'slug',
      content_type: 'text',
      content_value: page.slug.trim(),
      info: {
        icon: 'link',
        label: 'Page slug',
        description: `Affects the ${localeName} URL generated for this page`,
      },
    });
  }

  // 2. Extract SEO items (second)
  extractSeoItems(page.id, page.settings?.seo, items);

  // 3. Extract layer texts (third)
  if (layers && Array.isArray(layers) && layers.length > 0) {
    extractLayerTranslatableItems(layers, 'page', page.id, items);
  }

  return items;
}

/**
 * Extract all translatable items from a folder (slug only)
 */
export function extractFolderTranslatableItems(
  folder: { id: string; slug: string; name: string },
  locale?: Locale
): TranslatableItem[] {
  const items: TranslatableItem[] = [];

  // Extract folder slug
  if (folder.slug && folder.slug.trim()) {
    const localeName = locale?.label || 'localized';
    items.push({
      key: `folder:${folder.id}:slug`,
      source_type: 'folder',
      source_id: folder.id,
      content_key: 'slug',
      content_type: 'text',
      content_value: folder.slug.trim(),
      info: {
        icon: 'folder',
        label: 'Folder slug',
        description: `Affects the ${localeName} URLs of all pages and folders inside this folder`,
      },
    });
  }

  return items;
}

/**
 * Extract all translatable items from a component (layer texts only)
 */
export function extractComponentTranslatableItems(
  component: { id: string; name: string },
  layers: Layer[]
): TranslatableItem[] {
  const items: TranslatableItem[] = [];

  // Extract layer texts only (components don't have slug or SEO)
  if (layers && Array.isArray(layers) && layers.length > 0) {
    extractLayerTranslatableItems(layers, 'component', component.id, items);
  }

  return items;
}

/**
 * Extract all translatable items from a CMS collection item
 * Only extracts text and rich_text field values
 */
export function extractCmsTranslatableItems(
  collectionItem: { id: string; collection_id: string; values: Record<string, string> },
  fields: Array<{ id: string; name: string; type: string; key: string | null }>,
  locale?: Locale
): TranslatableItem[] {
  const items: TranslatableItem[] = [];

  // Extract translatable field values (text and rich_text only)
  for (const field of fields) {
    // Only translate text and rich_text fields
    if (field.type !== 'text' && field.type !== 'rich_text') {
      continue;
    }

    const fieldValue = collectionItem.values[field.id];

    // Skip empty values
    if (!fieldValue || !fieldValue.trim()) {
      continue;
    }

    const isSlugField = field.key === 'slug';
    const localeName = locale?.label || 'localized';

    // Build content_key: field:key:{key} or field:id:{id} when key is null
    const contentKey = field.key
      ? `field:key:${field.key}`
      : `field:id:${field.id}`;

    items.push({
      key: `cms:${collectionItem.id}:${contentKey}`,
      source_type: 'cms',
      source_id: collectionItem.id,
      content_key: contentKey,
      content_type: field.type === 'rich_text' ? 'richtext' : 'text',
      content_value: fieldValue.trim(),
      info: {
        icon: field.type === 'rich_text' ? 'type' : 'text',
        label: field.name,
        description: isSlugField ? `Affects ${localeName} URLs generated by dynamic pages using this CMS item` : undefined,
      },
    });
  }

  // Order: slug first, then other fields
  return items.sort((a, b) => {
    const aIsSlug = a.content_key === 'field:key:slug';
    const bIsSlug = b.content_key === 'field:key:slug';
    if (aIsSlug && !bIsSlug) return -1;
    if (!aIsSlug && bIsSlug) return 1;
    return 0;
  });
}

/**
 * Generate a translatable key from a Translation
 * Format: source_type:source_id:content_key
 * @param translation - Translation object or object with source_type, source_id, and content_key
 * @returns Translatable key string
 */
export function getTranslatableKey(
  translation: Translation | { source_type: string; source_id: string; content_key: string }
): string {
  return `${translation.source_type}:${translation.source_id}:${translation.content_key}`;
}

/**
 * Extract all layer content as a key-value map
 * Returns map of content keys to their values
 * Format: { "layer:{id}:text": "content", "layer:{id}:alt": "alt text" }
 * Uses extractLayerTranslatableItems internally for consistency
 */
export function extractLayerContentMap(
  layers: Layer[],
  sourceType: 'page' | 'component' = 'page',
  sourceId: string = 'temp'
): Record<string, string> {
  const items: TranslatableItem[] = [];

  // Use existing extractLayerTranslatableItems for consistency
  extractLayerTranslatableItems(layers, sourceType, sourceId, items);

  // Convert items to content map (content_key -> content_value)
  const contentMap: Record<string, string> = {};
  for (const item of items) {
    contentMap[item.content_key] = item.content_value;
  }

  return contentMap;
}
