import type {
  Article,
  DashboardStats,
  Resource,
  SearchRecord,
  TopicCategory,
  User
} from "@startup-navigator/shared";

export const apiUrl = (((import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "") as string).replace(/\/$/, "");

export const hasBackend = apiUrl.length > 0;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;

export const setToken = (token: string | null) => {
  authToken = token;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined)
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${apiUrl}${path}`, { ...options, headers });

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError((data as { message?: string }).message ?? "Request failed.", response.status);
  }
  return data as T;
}

export type ArticleInput = {
  title: string;
  category: TopicCategory;
  summary: string;
  content: string;
  tags: string[];
  published: boolean;
};

export type ResourceInput = {
  title: string;
  category: TopicCategory;
  url: string;
  description: string;
};

export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ user: User; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    }),

  login: (email: string, password: string) =>
    request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),

  getArticles: (category = "all") =>
    request<{ articles: Article[] }>(`/api/articles?category=${encodeURIComponent(category)}`).then((r) => r.articles),

  createArticle: (input: ArticleInput) =>
    request<{ article: Article }>("/api/articles", { method: "POST", body: JSON.stringify(input) }).then((r) => r.article),

  updateArticle: (id: string, input: ArticleInput) =>
    request<{ article: Article }>(`/api/articles/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.article),

  deleteArticle: (id: string) => request<void>(`/api/articles/${id}`, { method: "DELETE" }),

  getResources: (category = "all") =>
    request<{ resources: Resource[] }>(`/api/resources?category=${encodeURIComponent(category)}`).then((r) => r.resources),

  createResource: (input: ResourceInput) =>
    request<{ resource: Resource }>("/api/resources", { method: "POST", body: JSON.stringify(input) }).then((r) => r.resource),

  updateResource: (id: string, input: ResourceInput) =>
    request<{ resource: Resource }>(`/api/resources/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.resource),

  deleteResource: (id: string) => request<void>(`/api/resources/${id}`, { method: "DELETE" }),

  search: (query: string) =>
    request<{ search: SearchRecord }>("/api/search", { method: "POST", body: JSON.stringify({ query }) }).then((r) => r.search),

  getHistory: () => request<{ searches: SearchRecord[] }>("/api/search/history").then((r) => r.searches),

  getStats: () => request<{ stats: DashboardStats }>("/api/dashboard/stats").then((r) => r.stats)
};
