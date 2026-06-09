// Schema-driven validation. Replaces the parsed payload on req so handlers see strongly-typed data.
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, source: RequestPart = 'body'): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    // Replace with parsed (and possibly coerced) data.
    // We use `as never` because Express types req.query/params as ParsedQs/ParamsDictionary.
    (req as unknown as Record<RequestPart, unknown>)[source] = result.data;
    next();
  };
