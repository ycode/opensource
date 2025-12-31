/**
 * YCode Type Definitions
 *
 * Core types for pages, layers, and editor functionality
 */

// UI State Types (for state-specific styling: hover, focus, etc.)
export type UIState = 'neutral' | 'hover' | 'focus' | 'active' | 'disabled' | 'current';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

// Design Property Interfaces
export interface LayoutDesign {
  isActive?: boolean;
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
}

export interface TypographyDesign {
  isActive?: boolean;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  textTransform?: string;
  textDecoration?: string;
  color?: string;
}

export interface SpacingDesign {
  isActive?: boolean;
  margin?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  padding?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
}

export interface SizingDesign {
  isActive?: boolean;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
}

export interface BordersDesign {
  isActive?: boolean;
  borderWidth?: string;
  borderStyle?: string;
  borderColor?: string;
  borderRadius?: string;
  borderTopLeftRadius?: string;
  borderTopRightRadius?: string;
  borderBottomLeftRadius?: string;
  borderBottomRightRadius?: string;
}

export interface BackgroundsDesign {
  isActive?: boolean;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
}

export interface EffectsDesign {
  isActive?: boolean;
  opacity?: string;
  boxShadow?: string;
  filter?: string;
  backdropFilter?: string;
}

export interface PositioningDesign {
  isActive?: boolean;
  position?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: string;
}

export interface DesignProperties {
  layout?: LayoutDesign;
  typography?: TypographyDesign;
  spacing?: SpacingDesign;
  sizing?: SizingDesign;
  borders?: BordersDesign;
  backgrounds?: BackgroundsDesign;
  effects?: EffectsDesign;
  positioning?: PositioningDesign;
}

export interface LayerSettings {
  id?: string; // Custom HTML ID attribute
  hidden?: boolean; // Element visibility in canvas
  tag?: string; // HTML tag override (e.g., 'h1', 'h2', etc.)
  customAttributes?: Record<string, string>; // Custom HTML attributes { attributeName: attributeValue }
  linkSettings?: { // For link/button elements
    href?: string;
    target?: '_self' | '_blank' | '_parent' | '_top';
    rel?: string;
  };
  embedUrl?: string;     // For embedded content (videos, iframes, etc.)
  // Future settings can be added here
}

// Layer Style Types
export interface LayerStyle {
  id: string;
  name: string;

  // Style data
  classes: string;
  design?: DesignProperties;

  // Versioning fields
  content_hash?: string; // SHA-256 hash for change detection
  is_published: boolean;

  created_at: string;
  updated_at: string;
}

export interface LayerInteraction {
  id: string;
  trigger: 'click' | 'hover' | 'scroll-into-view' | 'while-scrolling' | 'load';
  timeline: InteractionTimeline;
  tweens: InteractionTween[];
}

export interface InteractionTimeline {
  breakpoints: Breakpoint[];
  repeat: number; // -1 = infinite, 0 = none, n = repeat n times
  yoyo: boolean; // reverse direction on each repeat
  // Scroll trigger settings (for scroll-into-view and while-scrolling)
  scrollStart?: string; // e.g., 'top 80%', 'top center' - when trigger enters viewport
  scrollEnd?: string; // e.g., 'bottom top' - when trigger leaves viewport (while-scrolling only)
  scrub?: boolean | number; // while-scrolling: true for direct link, number for smoothing (seconds)
  toggleActions?: string; // scroll-into-view: GSAP toggleActions (e.g., 'play none none none')
}

export interface InteractionTween {
  id: string;
  layer_id: string;
  position: number | string; // GSAP position: number (seconds), ">" (after previous), "<" (with previous)
  duration: number; // seconds
  ease: string; // GSAP ease (e.g., 'power1.out', 'elastic.inOut')
  from: TweenProperties;
  to: TweenProperties;
  apply_styles: InteractionApplyStyles;
  splitText?: {
    type: 'chars' | 'words' | 'lines';
    stagger: { amount: number }; // GSAP stagger: { amount: totalTime }
  };
}

export type ApplyStyles = 'on-load' | 'on-trigger';

export type TweenPropertyKey = 'x' | 'y' | 'rotation' | 'scale' | 'skewX' | 'skewY' | 'autoAlpha' | 'display';

export type InteractionApplyStyles = Record<TweenPropertyKey, ApplyStyles>;

export type TweenProperties = {
  [K in TweenPropertyKey]?: string | null;
};

export interface Layer {
  id: string;
  name: string; // Element type name: 'div', 'section', 'heading', 'youtube', etc.
  customName?: string; // User-defined name

  // Content
  text?: string | FieldVariable; // Text content (can be static or bound to a field)
  classes: string | string[]; // Tailwind CSS classes (support both formats)

  // Children
  children?: Layer[];
  open?: boolean; // Collapsed/expanded state in tree

  // Attributes (for HTML elements)
  attributes?: Record<string, any>;

  // Design system (structured properties)
  design?: DesignProperties;

  // Settings (element-specific configuration)
  settings?: LayerSettings;

  // Layer Styles (reusable design system)
  styleId?: string; // Reference to applied LayerStyle
  styleOverrides?: {
    classes?: string;
    design?: DesignProperties;
  }; // Tracks local changes after style applied

  // Components (reusable layer trees)
  componentId?: string; // Reference to applied Component
  componentOverrides?: Record<string, never>; // Reserved for future use - local modifications to component instances

  // Special properties
  locked?: boolean;
  hidden?: boolean;
  formattable?: boolean; // For text elements
  icon?: { name: string; svg_code: string }; // For icon elements

  // Image-specific
  url?: string | FieldVariable; // Image URL (can be static or bound to a field)
  alt?: string;

  // Collection binding (for collection layers)
  collection?: {
    id: string; // Collection ID
  };

  // Layer variables (new structured approach)
  variables?: LayerVariables;

  // Legacy properties (deprecated)
  style?: string; // Style preset name (legacy)
  content?: string; // For text/heading layers (use text instead)
  src?: string;     // For image layers (use url instead)

  // SSR-only property for resolved collection items
  _collectionItems?: CollectionItemWithValues[];
  // SSR-only property for collection item values (used for visibility filtering)
  _collectionItemValues?: Record<string, string>;
  // SSR-only property for master component ID (for translation lookups)
  _masterComponentId?: string;
  // SSR-only property for pagination metadata (when pagination is enabled)
  _paginationMeta?: CollectionPaginationMeta;
  // Interactions / Animations (new structured approach)
  interactions?: LayerInteraction[];
}

// Essentially a layer without ID (that can have children without IDs)
export interface LayerTemplate extends Omit<Layer, 'id' | 'children'> {
  children?: Array<LayerTemplate | LayerTemplateRef>;
}

// Template reference marker (lazy reference resolved during template instantiation)
export type LayerTemplateRef = { __ref: string } & Partial<Omit<LayerTemplate, 'children'>> & {
  children?: Array<LayerTemplate | LayerTemplateRef>;
};

// Block template definition (used in template collections)
export interface BlockTemplate {
  icon: string;
  name: string;
  template: LayerTemplate | LayerTemplateRef;
}

// Component Types (Reusable Layer Trees)
export interface Component {
  id: string;
  name: string;

  // Component data - complete layer tree
  layers: Layer[];

  // Versioning fields
  content_hash?: string; // SHA-256 hash for change detection
  is_published: boolean;

  created_at: string;
  updated_at: string;
}

export interface Page {
  id: string;
  slug: string;
  name: string;
  page_folder_id: string | null; // Reference to page_folders
  order: number; // Sort order
  depth: number; // Depth in hierarchy
  is_index: boolean; // Index of the root or parent folder
  is_dynamic: boolean; // Dynamic page (CMS-driven)
  error_page: number | null; // Error page type: 401, 404, 500
  settings: PageSettings; // Page settings (CMS, auth, seo, custom code)
  content_hash?: string; // SHA-256 hash of page metadata for change detection
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null; // Soft delete timestamp
}

export interface PageSettings {
  cms?: {
    collection_id: string;
    slug_field_id: string;
  };
  auth?: {
    enabled: boolean;
    password: string;
  };
  seo?: {
    image: string | FieldVariable | null; // Asset ID or Field Variable (image field)
    title: string;
    description: string;
    noindex: boolean; // Prevent search engines from indexing the page
  };
  custom_code?: {
    head: string;
    body: string;
  };
}

export interface PageLayers {
  id: string;
  page_id: string;
  layers: Layer[];
  content_hash?: string; // SHA-256 hash of layers and CSS for change detection
  is_published: boolean;
  created_at: string;
  updated_at?: string;
  deleted_at: string | null; // Soft delete timestamp
  generated_css?: string; // Extracted CSS from Play CDN for published pages
}

export interface PageFolderSettings {
  auth?: {
    enabled: boolean;
    password: string;
  };
}

export interface PageFolder {
  id: string;
  page_folder_id: string | null; // Self-referential: parent folder ID
  name: string;
  slug: string;
  depth: number; // Folder depth in hierarchy (0 for root)
  order: number; // Sort order within parent folder
  settings: PageFolderSettings; // Settings for auth (enabled + password), etc.
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null; // Soft delete timestamp
}

// Page/Folder Duplicate Operation Types
export interface PageItemDuplicateMetadata {
  tempId: string;
  originalName: string;
  parentFolderId: string | null;
  expectedName: string;
}

export interface PageItemDuplicateResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: PageItemDuplicateMetadata;
}

// Asset Types
/**
 * Asset categories for validation
 */
export type AssetCategory = 'images' | 'videos' | 'audio' | 'documents';

/**
 * Asset - Represents any uploaded file (images, videos, documents, etc.)
 *
 * The asset system is designed to handle any file type, not just images.
 * - Images will have width/height dimensions
 * - Non-images will have null width/height
 * - Use mime_type to determine asset type (e.g., image/, video/, application/pdf)
 */
export interface Asset {
  id: string;
  filename: string;
  storage_path: string;
  public_url: string;
  file_size: number;
  mime_type: string;
  width?: number | null;
  height?: number | null;
  source: string; // Required: identifies where the asset was uploaded from
  created_at: string;
}

// Settings Types
export interface SiteSettings {
  site_name: string;
  site_description: string;
  theme?: string;
  logo_url?: string;
}

// Editor State Types
export interface EditorState {
  selectedLayerId: string | null; // Legacy - kept for backward compatibility
  selectedLayerIds: string[]; // New multi-select
  lastSelectedLayerId: string | null; // For Shift+Click range
  currentPageId: string | null;
  isDragging: boolean;
  isLoading: boolean;
  isSaving: boolean;
  activeBreakpoint: Breakpoint;
  activeUIState: UIState; // Current UI state for editing (hover, focus, etc.)
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

// Supabase Config Types (for setup wizard)
export interface SupabaseConfig {
  anonKey: string;
  serviceRoleKey: string;
  connectionUrl: string; // With [YOUR-PASSWORD] placeholder
  dbPassword: string; // Actual password to replace [YOUR-PASSWORD]
}

// Internal credentials structure (derived from SupabaseConfig)
export interface SupabaseCredentials {
  anonKey: string;
  serviceRoleKey: string;
  connectionUrl: string; // Original with placeholder
  dbPassword: string;
  // Derived properties
  projectId: string;
  projectUrl: string; // API URL: https://[PROJECT_ID].supabase.co
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
}

// Vercel Config Types
export interface VercelConfig {
  project_id: string;
  token: string;
}

// Setup Wizard Types
export type SetupStep = 'welcome' | 'supabase' | 'migrate' | 'admin' | 'complete';

export interface SetupState {
  currentStep: SetupStep;
  supabaseConfig?: SupabaseConfig;
  vercelConfig?: VercelConfig;
  adminEmail?: string;
  isComplete: boolean;
}

// Auth Types
export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

export interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

// Collection Types (EAV Architecture)
export type CollectionFieldType = 'text' | 'number' | 'boolean' | 'date' | 'reference' | 'multi_reference' | 'rich_text' | 'image';
export type CollectionSortDirection = 'asc' | 'desc' | 'manual';

export interface CollectionSorting {
  field: string; // field ID or 'manual_order'
  direction: CollectionSortDirection;
}

export interface Collection {
  id: string; // UUID
  name: string;
  uuid: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sorting: CollectionSorting | null;
  order: number;
  is_published: boolean;
  draft_items_count?: number;
}

export interface CreateCollectionData {
  name: string;
  sorting?: CollectionSorting | null;
  order?: number;
  is_published?: boolean;
}

export interface UpdateCollectionData {
  name?: string;
  sorting?: CollectionSorting | null;
  order?: number;
}

export interface CreateCollectionFieldData {
  name: string;
  key?: string | null;
  type: CollectionFieldType;
  default?: string | null;
  fillable?: boolean;
  order: number;
  collection_id: string; // UUID
  reference_collection_id?: string | null; // UUID
  hidden?: boolean;
  data?: Record<string, any>;
  is_published?: boolean;
}

export interface UpdateCollectionFieldData {
  name?: string;
  key?: string | null;
  type?: CollectionFieldType;
  default?: string | null;
  fillable?: boolean;
  order?: number;
  reference_collection_id?: string | null; // UUID
  hidden?: boolean;
  data?: Record<string, any>;
}

export interface CollectionField {
  id: string; // UUID
  name: string;
  key: string | null; // Built-in fields have a key to identify them
  type: CollectionFieldType;
  default: string | null;
  fillable: boolean;
  order: number;
  collection_id: string; // UUID
  reference_collection_id: string | null; // UUID
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  hidden: boolean;
  data: Record<string, any>;
  is_published: boolean;
}

export interface CollectionItem {
  id: string; // UUID
  collection_id: string; // UUID
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  manual_order: number;
  is_published: boolean;
}

export interface CollectionItemValue {
  id: string; // UUID
  value: string | null;
  item_id: string; // UUID
  field_id: string; // UUID
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_published: boolean;
}

// Helper type for working with items + values
export interface CollectionItemWithValues extends CollectionItem {
  values: Record<string, string>; // field_id (UUID) -> value
  publish_status?: 'new' | 'updated' | 'deleted'; // Status badge for publish modal
}

// Settings Types
export interface Setting {
  id: string;
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
}

// CMS Field Variables, used for inline variables (text contents) and layer dynamic variables (images, files, links)
export interface FieldVariable {
  type: 'field';
  data: {
    field_id: string;
    relationships: string[];
    format?: string;
  };
}

export type InlineVariable = FieldVariable;

// Pagination Layer Definition (partial Layer for styling pagination controls)
export interface PaginationLayerConfig {
  classes?: string;
  design?: DesignProperties;
}

// Layer Variable Types
export interface CollectionPaginationConfig {
  enabled: boolean;
  mode: 'pages' | 'load_more';
  items_per_page: number;
  // Stylable pagination layer configurations
  wrapperLayer?: PaginationLayerConfig;
  prevButtonLayer?: PaginationLayerConfig;
  nextButtonLayer?: PaginationLayerConfig;
  pageInfoLayer?: PaginationLayerConfig;
}

export interface CollectionVariable {
  id: string; // Collection ID
  sort_by?: 'none' | 'manual' | 'random' | string; // 'none', 'manual', 'random', or field ID
  sort_order?: 'asc' | 'desc'; // Only used when sort_by is a field ID
  limit?: number; // Maximum number of items to show (deprecated when pagination enabled)
  offset?: number; // Number of items to skip (deprecated when pagination enabled)
  source_field_id?: string; // Reference field ID from parent item (for filtered collection source)
  source_field_type?: 'reference' | 'multi_reference'; // Type of source field (single vs multi)
  filters?: ConditionalVisibility; // Filter conditions to apply to collection items
  pagination?: CollectionPaginationConfig; // Pagination settings for collection
}

// Runtime pagination metadata (attached to layer during SSR, not saved to database)
export interface CollectionPaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  layerId: string; // To identify which collection layer this belongs to
  collectionId: string; // Collection ID for fetching more pages
  mode?: 'pages' | 'load_more'; // Pagination mode
  itemIds?: string[]; // For multi-reference filtering in load_more mode
  layerTemplate?: Layer[]; // Layer template for rendering new items in load_more mode
}

export interface LayerVariables {
  collection?: CollectionVariable;
  text?: string; // Text with embedded JSON inline variables: "Hello <ycode-inline-variable>{JSON}</ycode-inline-variable>"
  conditionalVisibility?: ConditionalVisibility;
  // Future: image, link, etc.
}

// Conditional Visibility Types
// Operators are grouped by field type for type-aware condition building

export type TextOperator = 'is' | 'is_not' | 'contains' | 'does_not_contain' | 'is_present' | 'is_empty';
export type NumberOperator = 'is' | 'is_not' | 'lt' | 'lte' | 'gt' | 'gte';
export type DateOperator = 'is' | 'is_before' | 'is_after' | 'is_between' | 'is_empty' | 'is_not_empty';
export type BooleanOperator = 'is';
export type ReferenceOperator = 'is_one_of' | 'is_not_one_of' | 'exists' | 'does_not_exist';
export type MultiReferenceOperator = 'is_one_of' | 'is_not_one_of' | 'contains_all_of' | 'contains_exactly' | 'item_count' | 'has_items' | 'has_no_items';
export type PageCollectionOperator = 'item_count' | 'has_items' | 'has_no_items';

export type VisibilityOperator =
  | TextOperator
  | NumberOperator
  | DateOperator
  | BooleanOperator
  | ReferenceOperator
  | MultiReferenceOperator
  | PageCollectionOperator;

export interface VisibilityCondition {
  id: string;
  source: 'collection_field' | 'page_collection';
  // For collection_field source
  fieldId?: string;
  fieldType?: CollectionFieldType;
  referenceCollectionId?: string; // For reference fields - the collection to fetch items from
  operator: VisibilityOperator;
  value?: string; // For is_one_of/is_not_one_of: JSON array of item IDs
  value2?: string; // For 'is_between' date operator
  // For page_collection source
  collectionLayerId?: string;
  collectionLayerName?: string; // Display name for the layer
  compareOperator?: 'eq' | 'lt' | 'lte' | 'gt' | 'gte'; // For 'item_count' operator
  compareValue?: number; // For 'item_count' operator
}

export interface VisibilityConditionGroup {
  id: string;
  conditions: VisibilityCondition[];
}

export interface ConditionalVisibility {
  groups: VisibilityConditionGroup[];
}

// Localisation Types

/**
 * Locale option (predefined locale configuration)
 */
export interface LocaleOption {
  code: string; // Language code (ISO 639-1)
  label: string; // English label
  native_label: string; // Native language label
  rtl?: boolean; // Right-to-left language
}

/**
 * Locale (database entity)
 */
export interface Locale {
  id: string;
  code: string;
  label: string;
  is_default: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateLocaleData {
  code: string;
  label: string;
  is_default?: boolean;
}

export interface UpdateLocaleData {
  code?: string;
  label?: string;
  is_default?: boolean;
}

export type TranslationSourceType = 'page' | 'folder' | 'component' | 'cms'
export type TranslationContentType = 'text' | 'richtext' | 'asset_id'

export interface Translation {
  id: string;
  locale_id: string;
  source_type: TranslationSourceType;
  source_id: string;
  content_key: string;
  content_type: TranslationContentType;
  content_value: string;
  is_completed: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateTranslationData {
  locale_id: string;
  source_type: TranslationSourceType;
  source_id: string;
  content_key: string;
  content_type: TranslationContentType;
  content_value: string;
}

export interface UpdateTranslationData {
  content_value?: string;
  is_completed?: boolean;
}
