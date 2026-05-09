export interface FileChange {
  path: string;
  oldPath?: string;
  status: string;
  staged: boolean;
}

export interface RepoStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  changes: FileChange[];
  staged: FileChange[];
  stashCount: number;
  hasConflicts: boolean;
}

export interface Repository {
  id: string;
  name: string;
  path: string;
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  changes: FileChange[];
  staged: FileChange[];
  hasConflicts: boolean;
}

export interface WorkspaceState {
  mode: "single" | "multi" | "workspace-file";
  workspaceFilePath?: string;
  repositories: Repository[];
  activeRepoId: string | null;
}

export interface DiffLine {
  lineType: "context" | "add" | "remove";
  content: string;
  oldLineno?: number;
  newLineno?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  file: string;
  oldFile?: string;
  hunks: DiffHunk[];
  isBinary: boolean;
}

export interface DiffStatEntry {
  file: string;
  additions: number;
  deletions: number;
}

export interface DiffStat {
  files: DiffStatEntry[];
  totalAdditions: number;
  totalDeletions: number;
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  parents: string[];
  refs: string[];
}

export interface CommitFileStat {
  file: string;
  additions: number;
  deletions: number;
  status: string;
}

export interface CommitDetail extends CommitInfo {
  body: string;
  files: CommitFileStat[];
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  upstream?: string;
  lastCommitSha: string;
  lastCommitDate: string;
}

export interface RemoteInfo {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface OperationResult {
  summary: string;
}

export interface ProgressPayload {
  repoPath: string;
  operation: string;
  message: string;
  percent?: number;
  status: "started" | "running" | "completed" | "failed";
}

export interface GraphEdge {
  fromLane: number;
  toLane: number;
  type: "straight" | "merge" | "fork";
}

export interface GraphNode {
  sha: string;
  shortSha: string;
  parents: string[];
  refs: string[];
  message: string;
  author: string;
  date: string;
  lane: number;
  connections: GraphEdge[];
}

export interface BlameLine {
  sha: string;
  author: string;
  authorEmail: string;
  date: string;
  lineNumber: number;
  content: string;
  originalLine: number;
  summary: string;
}

export interface ReflogEntry {
  selector: string;
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
}

export interface CommitResult {
  sha: string;
  shortSha: string;
  summary: string;
}

export interface UserInfo {
  name?: string;
  email?: string;
}

export interface GitError {
  kind: string;
  message?: string;
  stderr?: string;
  path?: string;
}

export type ActivityView = "source-control" | "branches" | "graph" | "blame" | "settings";
