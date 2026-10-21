import type {
  ExportFormat,
  ImportQuizRequest,
  ListQuizzesQuery,
  Paginated,
  QuizDetail,
  QuizInput,
  QuizSummary,
  UploadImageResponse,
} from '@quiz/shared';
import { apiUrl, request } from './client';

export const quizzesApi = {
  list(query: ListQuizzesQuery = {}): Promise<Paginated<QuizSummary>> {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    return request(`/quizzes${qs ? `?${qs}` : ''}`);
  },
  get(id: string): Promise<QuizDetail> {
    return request(`/quizzes/${encodeURIComponent(id)}`);
  },
  create(quiz: QuizInput): Promise<QuizDetail> {
    return request('/quizzes', { method: 'POST', body: JSON.stringify(quiz) });
  },
  update(id: string, quiz: QuizInput): Promise<QuizDetail> {
    return request(`/quizzes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(quiz) });
  },
  remove(id: string): Promise<void> {
    return request(`/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  duplicate(id: string): Promise<QuizDetail> {
    return request(`/quizzes/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });
  },
  import(body: ImportQuizRequest): Promise<QuizDetail> {
    return request('/quizzes/import', { method: 'POST', body: JSON.stringify(body) });
  },
  /** The server answers with `Content-Disposition: attachment`, so a plain link downloads it. */
  exportUrl(id: string, format: ExportFormat): string {
    return apiUrl(`/quizzes/${encodeURIComponent(id)}/export?format=${format}`);
  },
};

export const mediaApi = {
  uploadImage(file: File): Promise<UploadImageResponse> {
    const form = new FormData();
    form.append('file', file);
    return request('/media/images', { method: 'POST', body: form });
  },
};
