import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@stackfox/prisma";
import { ZodError } from "zod";

/**
 * The single place an unhandled error becomes a response.
 *
 * There was no error handler at all, so Fastify's default one applied. That
 * default puts `err.message` in the response body for 500s — verified, not
 * assumed:
 *
 *   GET /boom -> 500
 *   {"statusCode":500,"error":"Internal Server Error",
 *    "message":"connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"}
 *
 * Anything a thrown error happens to carry — a database host and port, a
 * Prisma query with column names, a failed upstream URL with its token in the
 * query string — was handed to the caller. Below 500 the message is ours and
 * deliberate; at 500 it never is.
 *
 * Every response carries the request id so a user can quote it and it can be
 * found in the logs.
 */

/** Errors we deliberately throw with a status carry their own message. */
type HttpishError = Error & { statusCode?: number; status?: number; code?: string };

function statusOf(err: HttpishError): number {
  const raw = err.statusCode ?? err.status;
  return typeof raw === "number" && raw >= 400 && raw <= 599 ? raw : 500;
}

/**
 * Prisma errors are the common way an internal detail reaches the edge: the
 * message embeds the model, the constraint name and sometimes the value. Map
 * the handful that mean something to a caller, and let the rest be a 500.
 */
function fromPrisma(err: Prisma.PrismaClientKnownRequestError):
  | { status: number; body: Record<string, unknown> }
  | null {
  switch (err.code) {
    case "P2002": {
      // Unique constraint. The target names columns, which is safe to echo and
      // is the only way the caller can tell which field collided.
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target.join(", ") : undefined;
      return {
        status: 409,
        body: {
          error: fields ? `That ${fields} is already taken` : "That value is already taken",
        },
      };
    }
    case "P2025":
      // Record not found. 404 rather than 500 — and deliberately without the
      // model name, which would confirm the existence of internal tables.
      return { status: 404, body: { error: "Not found" } };
    case "P2003":
      return { status: 409, body: { error: "That record is still referenced by something else" } };
    default:
      return null;
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: HttpishError, req: FastifyRequest, reply: FastifyReply) => {
    const reqId = String(req.id);

    // Fastify raises this for a body that fails its own content-type parsing,
    // and validate.ts already answers schema failures directly. Either way a
    // 400 is the caller's problem, not an incident.
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "Invalid request",
        details: err.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message })),
        requestId: reqId,
      });
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = fromPrisma(err);
      if (mapped) {
        req.log.info({ err, prismaCode: err.code }, "request rejected");
        return reply.code(mapped.status).send({ ...mapped.body, requestId: reqId });
      }
    }

    const status = statusOf(err);

    if (status < 500) {
      // Deliberate: a 4xx message is one we wrote for the caller.
      req.log.info({ err, status }, "request rejected");
      return reply.code(status).send({ error: err.message, requestId: reqId });
    }

    // A 500 is an incident. Log everything, return nothing.
    req.log.error({ err }, "unhandled error");

    return reply.code(500).send({
      error: "Something went wrong on our side.",
      // The only actionable thing we can give the caller: an id that finds the
      // full error in the logs.
      requestId: reqId,
    });
  });

  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send({ error: "Not found", requestId: String(req.id) });
  });
}
