import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { formatIssuePath, type ApiErrorBody } from '@quiz/shared';
import type { ZodTypeAny, z } from 'zod';

export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const body: ApiErrorBody = {
        statusCode: 400,
        message: 'Validation failed',
        issues: result.error.issues.map((issue) => ({
          message: issue.message,
          path: formatIssuePath(issue.path),
        })),
      };
      throw new BadRequestException(body);
    }
    return result.data;
  }
}
