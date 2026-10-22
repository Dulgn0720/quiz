import type {
  CreateTrainingRequest,
  SubmitTrainingRequest,
  TrainingAttemptResult,
  TrainingCertificate,
  TrainingDetail,
  TrainingReport,
  TrainingSummary,
} from '@quiz/shared';
import { request } from './client';

const id = (value: string) => encodeURIComponent(value);

export const trainingsApi = {
  list(): Promise<TrainingSummary[]> {
    return request('/trainings');
  },
  get(trainingId: string): Promise<TrainingDetail> {
    return request(`/trainings/${id(trainingId)}`);
  },
  create(body: CreateTrainingRequest): Promise<TrainingSummary> {
    return request('/trainings', { method: 'POST', body: JSON.stringify(body) });
  },
  setActive(trainingId: string, active: boolean): Promise<void> {
    return request(`/trainings/${id(trainingId)}`, { method: 'PATCH', body: JSON.stringify({ active }) });
  },
  submit(trainingId: string, body: SubmitTrainingRequest): Promise<TrainingAttemptResult> {
    return request(`/trainings/${id(trainingId)}/attempts`, { method: 'POST', body: JSON.stringify(body) });
  },
  report(trainingId: string): Promise<TrainingReport> {
    return request(`/trainings/${id(trainingId)}/report`);
  },
  certificate(attemptId: string): Promise<TrainingCertificate> {
    return request(`/trainings/certificates/${id(attemptId)}`);
  },
};
