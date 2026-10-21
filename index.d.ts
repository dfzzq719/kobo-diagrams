import type {MermaidConfig, RenderResult} from 'mermaid';

export const CORE_VERSION: '0.1.3';
export const MERMAID_VERSION: '12.2.0';
export const PROFILE_SCHEMA: 'kobo.diagram-profile/v1';
export type RoleName = 'paper' | 'surface' | 'ink' | 'muted' | 'primary' | 'anchor' | 'line' | 'border' | 'success' | 'warning' | 'danger';
export type RoleColors = Record<RoleName, string>;
export interface DiagramSettings {
  radius: number;
  lineWidth: number;
  fontSize: number;
  curve: 'basis' | 'linear' | 'stepAfter';
  density: 'compact' | 'comfortable' | 'spacious';
  direction: 'auto' | 'TB' | 'TD' | 'BT' | 'LR' | 'RL';
  transparent: boolean;
}
export interface DiagramStandard { name: string; version: string }
export interface DiagramProfile {
  schema: typeof PROFILE_SCHEMA;
  engineVersion: typeof MERMAID_VERSION;
  coreVersion: '0.1.0' | '0.1.1' | '0.1.2' | '0.1.3';
  roles: RoleColors;
  settings: DiagramSettings;
  standard?: DiagramStandard;
}
export function createDiagramProfile(input?: {roles?: Partial<RoleColors>; settings?: Partial<DiagramSettings>; standard?: DiagramStandard}): DiagramProfile & {coreVersion: typeof CORE_VERSION};
export function validateDiagramProfile(input: unknown): DiagramProfile;

export interface MermaidLike {
  initialize(config: MermaidConfig): void | Promise<void>;
  parse(source: string): Promise<unknown>;
  render(id: string, source: string, container?: Element): Promise<RenderResult>;
}
export interface MermaidRenderOptions { config?: MermaidConfig; id?: string; container?: Element }
export function createMermaidRenderer(mermaid: MermaidLike): {
  render(source: string, options?: MermaidRenderOptions): Promise<RenderResult>;
};
export interface EnterpriseRenderOptions { mermaid?: MermaidLike }
export type CapabilityStatus = 'full' | 'partial' | 'none';
export interface DiagramCapabilities {
  type: string;
  label: string;
  status: string;
  controls: Record<string, CapabilityStatus>;
  notes: string[];
}
export type Palette = RoleColors & {
  primarySoft: string; successSoft: string; warningSoft: string; dangerSoft: string;
  neutral: string; grid: string; onPrimary: string; onAnchor: string;
  series: string[]; seriesSoft: string[];
};
export interface CompiledDiagram {
  source: string;
  theme: MermaidConfig;
  type: string;
  palette: Palette;
  settings: DiagramSettings;
  capabilities: DiagramCapabilities;
}
export interface DiagramPacket extends Omit<CompiledDiagram, 'theme'> {
  theme?: MermaidConfig;
  svg: string;
  width: number;
  height: number;
  notes?: string[];
}
export const DEFAULT_SETTINGS: Readonly<DiagramSettings>;
export function cleanSource(source: string): string;
export function diagramKind(source: string): string;
export function getDiagramCapabilities(source: string): DiagramCapabilities;
export function diagramCapabilitiesFor(type: string): DiagramCapabilities;
export function getDocumentCapabilities(source: string): DiagramCapabilities;
export function compileDiagram(source: string, roles?: Partial<RoleColors>, settings?: Partial<DiagramSettings>): CompiledDiagram;
export function renderDiagram(source: string, roles?: Partial<RoleColors>, settings?: Partial<DiagramSettings>, options?: EnterpriseRenderOptions): Promise<DiagramPacket>;
export function renderDocument(source: string, roles?: Partial<RoleColors>, settings?: Partial<DiagramSettings>, options?: EnterpriseRenderOptions): Promise<DiagramPacket>;
export function svgToPng(packet: DiagramPacket, scale?: number): Promise<Blob>;
export function pngDimensions(packet: Pick<DiagramPacket, 'width' | 'height'>, scale?: number): {width: number; height: number; scale: number};
export function validateFrozenSource(source: string): string;
export function isTableSource(source: string): boolean;
export interface TableDocument {
  schema: 'taskobo.table/v1';
  kind?: string;
  title?: string;
  columns: Array<{key: string; label?: string; width?: number}>;
  rows: Array<Record<string, string | number | boolean | null>>;
}
export function parseTable(source: string): TableDocument;
export const ROLE_DEFS: ReadonlyArray<Readonly<{key: RoleName; label: string}>>;
export const PRESETS: ReadonlyArray<Readonly<{id: string; label: string; description: string; roles: Readonly<RoleColors>; tones: Readonly<Record<string, string>>}>>;
export const DIAGRAM_CATALOG: ReadonlyArray<Readonly<{id: string; label: string; source: string; status: string; capabilities: Readonly<Record<string, CapabilityStatus>>; notes: readonly string[]}>>;
export function normalizeHex(value: unknown): string | null;
export function contrastRatio(foreground: string, background: string): number;
export function mixHex(a: string, b: string, weight: number): string;
export function onColor(background: string, foreground?: string): string;
export function derivePalette(roles?: Partial<RoleColors>): Palette;
export function deriveRaciPalette(roles?: Partial<RoleColors>): Record<string, {fill: string; ink: string}>;
export function assessPalette(roles?: Partial<RoleColors>): {allPass: boolean; checks: Array<{name: string; foreground: string; background: string; ratio: number; minimum: number; passes: boolean}>};
export function repairPalette(roles?: Partial<RoleColors>): RoleColors;
export function extractTextPalette(text: string, filename?: string): {colors: Array<{hex: string; role?: RoleName; label?: string}>; suggestedRoles: Partial<RoleColors>; evidence: string[]; confidence: number};
