export interface CommitItem {
  hash: string
  shortHash: string
  subject: string
  typeLabel: string
  filesChanged: number
  insertions: number
  deletions: number
}

export interface InProgress {
  summary: string
  fileCount: number
  insertions: number
  deletions: number
}

export interface RepoDayData {
  repoPath: string
  repoName: string
  author: string
  commits: CommitItem[]
  inProgress: InProgress
  totalCommits: number
  totalFiles: number
  totalInsertions: number
  totalDeletions: number
}
