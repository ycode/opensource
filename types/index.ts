/**
 * YCode Type Definitions
 * 
 * Core types for pages, layers, and editor functionality
 */

// Layer Types
export type LayerType = 'container' | 'text' | 'image' | 'heading';

export interface Layer {
  id: string;
  type: LayerType;
  classes: string;  // Tailwind CSS classes
  content?: string; // For text/heading layers
  src?: string;     // For image layers
  children?: Layer[];
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
  selectedLayerId: string | null;
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

// Collaboration Types
export interface CollaborationUser {
  user_id: string;
  email: string;
  display_name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selected_layer_id: string | null;
  locked_layer_id: string | null;
  is_editing: boolean; // Typing/editing indicator
  last_active: number;
  page_id: string;
}

export interface LayerLock {
  layer_id: string;
  user_id: string;
  acquired_at: number;
  expires_at: number;
}

export interface LayerUpdate {
  layer_id: string;
  user_id: string;
  changes: Partial<Layer>;
  timestamp: number;
}

export interface CollaborationState {
  users: Record<string, CollaborationUser>;
  locks: Record<string, LayerLock>;
  isConnected: boolean;
  currentUserId: string | null;
  currentUserColor: string;
}

export interface ActivityNotification {
  id: string;
  type: 'user_joined' | 'user_left' | 'layer_edit_started' | 'layer_edit_ended' | 'page_published' | 'user_idle' | 'page_created' | 'page_deleted';
  user_id: string;
  user_name: string;
  layer_id?: string;
  layer_name?: string;
  page_id?: string;
  timestamp: number;
  message: string;
}

