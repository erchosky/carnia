import type {
  SoloAnswerInput,
  SoloAnswerResponse,
  SoloRound,
  SoloStartInput,
  SoloStartResponse,
} from '@carnia/contracts';
import { apiSend } from './api';

export const soloApi = {
  start: (data: SoloStartInput) => apiSend<SoloStartResponse>('/api/solo/start', 'POST', data),
  next: (sessionId: string) => apiSend<SoloRound>('/api/solo/next', 'POST', { sessionId }),
  answer: (data: SoloAnswerInput) => apiSend<SoloAnswerResponse>('/api/solo/answer', 'POST', data),
};
