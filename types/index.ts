/**
 * YCode Type Definitions
 *
 * Core types for pages, layers, and editor functionality
 */

// Layer Types
export type LayerType = 'container' | 'text' | 'image' | 'heading';

// UI State Types (for state-specific styling: hover, focus, etc.)
export type UIState = 'neutral' | 'hover' | 'focus' | 'active' | 'disabled' | 'current';

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

export interface LayerSettings {
  id?: string;           // Custom HTML ID attribute
  hidden?: boolean;      // Element visibility in canvas
  tag?: string;          // HTML tag override (e.g., 'h1', 'h2', etc.)
  customAttributes?: Record<string, string>; // Custom HTML attributes { attributeName: attributeValue }
  linkSettings?: {       // For link/button elements
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
  design?: {
    layout?: LayoutDesign;
    typography?: TypographyDesign;
    spacing?: SpacingDesign;
    sizing?: SizingDesign;
    borders?: BordersDesign;
    backgrounds?: BackgroundsDesign;
    effects?: EffectsDesign;
    positioning?: PositioningDesign;
  };

  // Versioning fields
  content_hash?: string; // SHA-256 hash for change detection
  is_published: boolean;

  created_at: string;
  updated_at: string;
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

export interface Layer {
  id: string;
  name?: string; // Element type name: 'div', 'h1', 'button', 'section', etc.
  customName?: string; // User-defined name
  type?: LayerType; // For compatibility

  // Content
  text?: string; // Text content
  classes: string | string[]; // Tailwind CSS classes (support both formats)
  style?: string; // Style preset name (legacy)

  // Children
  children?: Layer[];
  open?: boolean; // Collapsed/expanded state in tree

  // Attributes (for HTML elements)
  attributes?: Record<string, any>;

  // Design system (structured properties)
  design?: {
    layout?: LayoutDesign;
    typography?: TypographyDesign;
    spacing?: SpacingDesign;
    sizing?: SizingDesign;
    borders?: BordersDesign;
    backgrounds?: BackgroundsDesign;
    effects?: EffectsDesign;
    positioning?: PositioningDesign;
  };

  // Settings (element-specific configuration)
  settings?: LayerSettings;

  // Layer Styles (reusable design system)
  styleId?: string; // Reference to applied LayerStyle
  styleOverrides?: {
    classes?: string;
    design?: {
      layout?: LayoutDesign;
      typography?: TypographyDesign;
      spacing?: SpacingDesign;
      sizing?: SizingDesign;
      borders?: BordersDesign;
      backgrounds?: BackgroundsDesign;
      effects?: EffectsDesign;
      positioning?: PositioningDesign;
    };
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
  url?: string; // Image URL
  alt?: string;

  // Legacy properties
  content?: string; // For text/heading layers (use text instead)
  src?: string;     // For image layers (use url instead)
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

/**
 * File object for storing file metadata
 */
export interface FileObject {
  name: string; // Custom name or file basename
  mime_type: string; // MIME type (e.g., 'image/png')
  path: string; // Storage path
  url: string; // Public URL
}

export interface PageSettings {
  cms?: {
    key: string;
    source: string;
  };
  auth?: {
    enabled: boolean;
    password: string;
  };
  seo?: {
    image: string | null; // Asset ID
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
  activeBreakpoint: 'mobile' | 'tablet' | 'desktop';
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
export type CollectionFieldType = 'text' | 'number' | 'boolean' | 'date' | 'reference' | 'rich_text';
export type CollectionSortDirection = 'asc' | 'desc' | 'manual';

export interface CollectionSorting {
  field: string; // field ID or 'manual_order'
  direction: CollectionSortDirection;
}

export interface Collection {
  id: string; // UUID
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sorting: CollectionSorting | null;
  order: number | null;
  is_published: boolean;
  draft_items_count?: number;
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
