/**
 * YCode Type Definitions
 *
 * Core types for pages, layers, and editor functionality
 */

// Layer Types
export type LayerType = 'container' | 'text' | 'image' | 'heading';

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
  linkSettings?: {
    url: string;
    target?: string; // Link target ('_self', '_blank', etc.)
  };
  embedUrl?: string;     // Embed URL for iframes (YouTube, etc.)
  // Future settings can be added here
}

export interface Layer {
  id: string;
  name?: string; // Element type name: 'div', 'h1', 'button', 'section', etc.
  customName?: string; // User-defined name
  type?: LayerType; // For compatibility

  // Content
  text?: string; // Text content
  classes: string | string[]; // Tailwind CSS classes (support both formats)
  style?: string; // Style preset name

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

// Page Types
export interface Page {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageVersion {
  id: string;
  page_id: string;
  layers: Layer[];
  is_published: boolean;
  created_at: string;
}

// Asset Types
export interface Asset {
  id: string;
  filename: string;
  storage_path: string;
  public_url: string;
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
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
  url: string;
  publishable_key: string;
  secret_key: string;
  db_password: string;
  pooler_server: string;
  jwt_secret?: string;
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
