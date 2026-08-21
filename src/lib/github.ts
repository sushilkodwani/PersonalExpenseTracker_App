// Minimal GitHub Contents API client used to treat a private repo as a JSON store.

export interface GitHubConfig {
  token: string
  owner: string
  repo: string
}

const API = 'https://api.github.com'

function headers(cfg: GitHubConfig): HeadersInit {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export class GitHubApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Verify the token can see the repo. Throws GitHubApiError on failure. */
export async function verifyRepoAccess(cfg: GitHubConfig): Promise<void> {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}`, { headers: headers(cfg) })
  if (!res.ok) {
    throw new GitHubApiError(
      res.status,
      res.status === 404
        ? 'Repo not found — check the owner/repo name and that the token has access to it.'
        : res.status === 401
          ? 'Token rejected — check that it is valid and not expired.'
          : `GitHub returned ${res.status}`,
    )
  }
}

export interface FileResult<T> {
  data: T
  sha: string
}

function decodeBase64Utf8(content: string): string {
  return decodeURIComponent(
    atob(content.replace(/\n/g, ''))
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  )
}

/** Read a JSON file. Returns null if the file doesn't exist. */
export async function getJsonFile<T>(cfg: GitHubConfig, path: string): Promise<FileResult<T> | null> {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, {
    headers: headers(cfg),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new GitHubApiError(res.status, `Failed to read ${path} (${res.status})`)
  const body = (await res.json()) as { content: string; sha: string }
  return { data: JSON.parse(decodeBase64Utf8(body.content)) as T, sha: body.sha }
}

function toBase64Utf8(text: string): string {
  return btoa(
    encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    ),
  )
}

/**
 * Write a JSON file. Pass the sha from the last read when updating an existing file.
 * On a stale-sha conflict (409/422) the caller should refetch and retry.
 * Returns the new sha.
 */
export async function putJsonFile(
  cfg: GitHubConfig,
  path: string,
  data: unknown,
  message: string,
  sha?: string,
): Promise<string> {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: toBase64Utf8(JSON.stringify(data, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  })
  if (!res.ok) throw new GitHubApiError(res.status, `Failed to write ${path} (${res.status})`)
  const body = (await res.json()) as { content: { sha: string } }
  return body.content.sha
}

/** Delete a file. The sha must be the one from the latest read of that path. */
export async function deleteFile(cfg: GitHubConfig, path: string, message: string, sha: string): Promise<void> {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, {
    method: 'DELETE',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha }),
  })
  if (!res.ok && res.status !== 404) {
    throw new GitHubApiError(res.status, `Failed to delete ${path} (${res.status})`)
  }
}

export interface CommitInfo {
  sha: string
  message: string
  date: string
  author: string
}

/** Commit history for one file — the app's free "version history" of a month. */
export async function listCommits(cfg: GitHubConfig, path: string, limit = 30): Promise<CommitInfo[]> {
  const res = await fetch(
    `${API}/repos/${cfg.owner}/${cfg.repo}/commits?path=${encodeURIComponent(path)}&per_page=${limit}`,
    { headers: headers(cfg), cache: 'no-store' },
  )
  if (res.status === 404 || res.status === 409) return []
  if (!res.ok) throw new GitHubApiError(res.status, `Failed to read history for ${path} (${res.status})`)
  const body = (await res.json()) as {
    sha: string
    commit: { message: string; author: { name: string; date: string } }
  }[]
  return body.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    date: c.commit.author.date,
    author: c.commit.author.name,
  }))
}

/** Read a file as it existed at a specific commit. */
export async function getJsonFileAtRef<T>(cfg: GitHubConfig, path: string, ref: string): Promise<T | null> {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${ref}`, {
    headers: headers(cfg),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new GitHubApiError(res.status, `Failed to read ${path}@${ref} (${res.status})`)
  const body = (await res.json()) as { content: string }
  return JSON.parse(decodeBase64Utf8(body.content)) as T
}

/** List file names (without extension) in a directory. Returns [] if the dir doesn't exist. */
export async function listDir(cfg: GitHubConfig, path: string): Promise<string[]> {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, {
    headers: headers(cfg),
    cache: 'no-store',
  })
  if (res.status === 404) return []
  if (!res.ok) throw new GitHubApiError(res.status, `Failed to list ${path} (${res.status})`)
  const body = (await res.json()) as { name: string; type: string }[]
  return body.filter((e) => e.type === 'file' && e.name.endsWith('.json')).map((e) => e.name.replace(/\.json$/, ''))
}
