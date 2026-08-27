import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireRole } from "../plugins/auth";

function serializeJob(j: any) {
  return { ...j, _id: j.id, applicationCount: j._count?.applications ?? undefined };
}

function serializeApplication(a: any) {
  return { ...a, _id: a.id };
}

export async function jobRoutes(app: FastifyInstance) {
  // Public — list open roles
  app.get("/jobs", async () => {
    const jobs = await prisma.job.findMany({
      where: { status: "OPEN" },
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { data: { jobs: jobs.map(serializeJob) } };
  });

  // Public — apply to a role
  app.post(
    "/jobs/:id/apply",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      experience?: string;
      coverLetter?: string;
      portfolioUrl?: string;
      linkedinUrl?: string;
    };
    if (!body.name || !body.email) {
      return reply.code(400).send({ message: "name and email are required" });
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return reply.code(404).send({ message: "Job not found" });

    const application = await prisma.jobApplication.create({
      data: {
        jobId: id,
        name: body.name,
        email: body.email,
        phone: body.phone,
        experience: body.experience,
        coverLetter: body.coverLetter,
        portfolioUrl: body.portfolioUrl,
        linkedinUrl: body.linkedinUrl,
      },
    });

    return { data: serializeApplication(application) };
  });

  // Admin — applications for a job
  app.get("/jobs/:id/applications", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN"])) return;
    const { id } = req.params as { id: string };
    const applications = await prisma.jobApplication.findMany({
      where: { jobId: id },
      orderBy: { createdAt: "desc" },
    });
    return { data: applications.map(serializeApplication) };
  });

  // Admin — update application status
  app.put("/jobs/applications/:appId", async (req, reply) => {
    if (!requireRole(req, reply, ["ADMIN"])) return;
    const { appId } = req.params as { appId: string };
    const { status } = req.body as { status: string };
    const updated = await prisma.jobApplication.update({
      where: { id: appId },
      data: { status },
    });
    return { data: serializeApplication(updated) };
  });
}
