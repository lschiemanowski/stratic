export interface Passage { quote: string; prefix?: string; suffix?: string }
export interface DescriptionTarget { description: string; passage?: Passage }
export interface SourceTarget { path: string; passage: Passage }
export type Target = DescriptionTarget | SourceTarget;
export type Link =
  | { kind: 'implementation'; from: Passage | null; to: SourceTarget }
  | { kind: 'depends-on' | 'reference'; from: Passage | null; to: DescriptionTarget; reason?: string };
export interface Metadata {
  id: string;
  parent: (DescriptionTarget & { passage: Passage }) | null;
  realization: 'implemented' | 'partial' | 'unimplemented';
  remaining?: string;
  summary?: string[];
  links: Link[];
}
export interface Description { id: string; title: string; body: string; path: string; metadata?: Metadata }
export interface TestRecord { id: string; name: string; description: string; code: SourceTarget[]; verifies: DescriptionTarget[] }
export interface Issue { path: string; message: string; description?: string }
export interface Project {
  root: string; revision: string; descriptions: Description[]; tests: TestRecord[]; issues: Issue[];
  config?: { formatVersion: 1; scope: string[]; exclusions: { pattern: string; reason: string }[] };
}
export interface Range { start: number; end: number; startLine: number; endLine: number }
export interface Connection { label: string; kind: string; from: Passage | null; to: Target; reason?: string; range?: Range; problem?: string }
export interface CheckResult {
  id: string; tree: string; method: string; outcome: 'pass' | 'fail' | 'inconclusive';
  recordedAt: string; environment: string; evidence: string;
  tests: { id: string; outcome: 'pass' | 'fail' | 'inconclusive' }[];
}
export interface ReviewInput {
  reviewer: string; summary: string;
  examined: { id: string; outcome: 'revised' | 'unchanged'; reason: string }[];
  unresolved: string[]; resultIds: string[];
}
export interface Review extends Omit<ReviewInput, 'resultIds'> {
  id: string; base: string; contentTree: string; recordedAt: string; results: CheckResult[];
}
export interface Ready { id: string; base: string; contentTree: string; finalTree: string; paths: string[]; reviewPath: string; createdAt: string }
