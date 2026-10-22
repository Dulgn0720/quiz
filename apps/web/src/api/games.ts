import type { CreateGameRequest, CreateGameResponse, PublicRoomSummary, RoomInfo } from '@quiz/shared';
import { request } from './client';

export const gamesApi = {
  create(body: CreateGameRequest): Promise<CreateGameResponse> {
    return request('/games', { method: 'POST', body: JSON.stringify(body) });
  },
  info(pin: string): Promise<RoomInfo> {
    return request(`/games/${encodeURIComponent(pin)}`);
  },
  listPublic(): Promise<PublicRoomSummary[]> {
    return request('/games/public');
  },
};
