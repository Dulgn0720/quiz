import type { TopPlayerPeriod, TopPlayersResponse } from '@quiz/shared';
import { request } from './client';

export const leaderboardApi = {
  top(period: TopPlayerPeriod): Promise<TopPlayersResponse> {
    return request(`/leaderboard?period=${period}`);
  },
};
