import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  createTrainingSchema,
  submitTrainingSchema,
  type CreateTrainingInput,
  type SubmitTrainingRequest,
  type TrainingAttemptResult,
  type TrainingCertificate,
  type TrainingDetail,
  type TrainingReport,
  type TrainingSummary,
} from '@quiz/shared';
import { z } from 'zod';
import { CurrentUserId, RequireAuthGuard } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TrainingsService } from './trainings.service';

const activeSchema = z.object({ active: z.boolean() });

/** Required trainings and certificates; every route needs a signed-in employee. */
@Controller('trainings')
@UseGuards(RequireAuthGuard)
export class TrainingsController {
  constructor(private readonly trainings: TrainingsService) {}

  @Get()
  list(@CurrentUserId() userId: string): Promise<TrainingSummary[]> {
    return this.trainings.list(userId);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createTrainingSchema)) body: CreateTrainingInput,
    @CurrentUserId() userId: string,
  ): Promise<TrainingSummary> {
    return this.trainings.create(body, userId);
  }

  @Get('certificates/:attemptId')
  certificate(@Param('attemptId') attemptId: string, @CurrentUserId() userId: string): Promise<TrainingCertificate> {
    return this.trainings.certificate(attemptId, userId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUserId() userId: string): Promise<TrainingDetail> {
    return this.trainings.get(id, userId);
  }

  @Patch(':id')
  @HttpCode(204)
  setActive(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(activeSchema)) { active }: z.output<typeof activeSchema>,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    return this.trainings.setActive(id, active, userId);
  }

  @Post(':id/attempts')
  @HttpCode(200)
  submit(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(submitTrainingSchema)) body: SubmitTrainingRequest,
    @CurrentUserId() userId: string,
  ): Promise<TrainingAttemptResult> {
    return this.trainings.submit(id, body, userId);
  }

  @Get(':id/report')
  report(@Param('id') id: string, @CurrentUserId() userId: string): Promise<TrainingReport> {
    return this.trainings.report(id, userId);
  }
}
