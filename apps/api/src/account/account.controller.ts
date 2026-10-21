import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import {
  updateProfileSchema,
  type GameHistoryEntry,
  type Paginated,
  type UpdateProfileRequest,
  type UserProfile,
  type UserPublic,
} from '@quiz/shared';
import { z } from 'zod';
import { CurrentUserId, RequireAuthGuard } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountService } from './account.service';

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/** The signed-in user's own account. */
@UseGuards(RequireAuthGuard)
@Controller('me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  profile(@CurrentUserId() userId: string): Promise<UserProfile> {
    return this.account.profile(userId);
  }

  @Patch()
  update(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileRequest,
  ): Promise<UserPublic> {
    return this.account.update(userId, body);
  }

  @Get('games')
  history(
    @CurrentUserId() userId: string,
    @Query(new ZodValidationPipe(historyQuerySchema)) query: z.output<typeof historyQuerySchema>,
  ): Promise<Paginated<GameHistoryEntry>> {
    return this.account.history(userId, query.page, query.pageSize);
  }
}
