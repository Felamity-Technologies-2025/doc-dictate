export interface DocumentModel {
  id: string;
  title: string;
  content: string;
  text_content?: string;
  word_count: number;
  created_at: string;
  updated_at: string;
  content_json?: Record<string, unknown> | null;
  /** Set when the document was created from a reusable template */
  template_id?: string | null;
}

export type DictationEngine = 'browser' | 'flask';

export type DictationStatus =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'transcribing'
  | 'error';

export interface DictationSettings {
  engine: DictationEngine;
  language: string;
  autoPunctuation: boolean;
  continuous: boolean;
}

export interface LanguageOption {
  code: string;
  label: string;
  nativeName: string;
  flag: string;
}

export type RibbonTab = 'home' | 'insert' | 'layout' | 'review' | 'view';

export type PageSize = 'letter' | 'a4' | 'legal';
export type PageOrientation = 'portrait' | 'landscape';
export type PageMargins = 'normal' | 'narrow' | 'moderate' | 'wide';

export interface PageLayoutConfig {
  size: PageSize;
  orientation: PageOrientation;
  margins: PageMargins;
  zoom: number; // percentage, e.g. 100
}

export interface TranscriptionResponse {
  success: boolean;
  text: string;
  language: string;
  engine: string;
  duration_seconds?: number;
  error?: string;
}

export interface BackendHealth {
  status: string;
  service: string;
  version: string;
  default_engine: string;
  max_upload_size_mb: number;
  database: string;
  llm_gateway_configured?: boolean;
  template_max_upload_mb?: number;
}

// ---------------------------------------------------------------------------
// Reusable document templates (PDF upload + LLM heading extraction)
// ---------------------------------------------------------------------------

/** field: short label + value; section: heading introducing content; paragraph: unlabelled free-text region */
export type TemplateFieldType = 'field' | 'section' | 'paragraph';

export interface TemplateField {
  id: string;
  template_id: string;
  heading: string;
  field_type: TemplateFieldType;
  field_order: number;
  parent_field_id: string | null;
  level: number;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateSummary {
  id: string;
  template_name: string;
  original_filename: string | null;
  document_type: string | null;
  extraction_method: string | null;
  field_count: number;
  custom_field_count: number;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateModel extends TemplateSummary {
  fields: TemplateField[];
}

export interface TemplateUploadResult {
  template: TemplateModel;
  extraction: {
    method: 'text' | 'vision' | 'text+vision' | string;
    page_count: number;
    field_count: number;
  };
}

export interface NewTemplateField {
  heading: string;
  field_type?: TemplateFieldType;
  /** 1-based position in the template; takes precedence over after_field_id */
  position?: number;
  after_field_id?: string | null;
  parent_field_id?: string | null;
}

export interface TemplateFieldUpdate {
  heading?: string;
  field_type?: TemplateFieldType;
  position?: number;
  parent_field_id?: string | null;
}

export type ExportFormat = 'docx' | 'pdf';
