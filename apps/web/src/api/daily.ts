import type { DailyAnswerResponse, DailyQuestion } from '@quiz/shared';
import { request } from './client';

export const dailyApi = {
  today(): Promise<DailyQuestion> {
    return request('/daily');
  },
  answer(answer: string): Promise<DailyAnswerResponse> {
    return request('/daily/answer', { method: 'POST', body: JSON.stringify({ answer }) });
  },
};
