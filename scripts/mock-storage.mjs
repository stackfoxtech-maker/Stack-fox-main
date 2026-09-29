#!/usr/bin/env node
/**
 * A minimal stand-in for Supabase Storage, for exercising the upload,
 * signed-URL and download paths locally without touching the real project.
 *
 * Implements only what apps/api/src/lib/storage.ts calls:
 *   POST /storage/v1/object/:bucket/*        upload (upsert honoured)
 *   POST /storage/v1/object/sign/:bucket/*   signed download URL
 *   GET  /storage/v1/object/sign/:bucket/*   the signed download
 *   DELETE /storage/v1/object/:bucket        remove
 *
 *   node scripts/mock-storage.mjs            listens on :54321
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=local-mock ...
 */
import { createServer } from "node:http";

const objects = new Map();
const PORT = Number(process.env.MOCK_STORAGE_PORT ?? 54321);

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.replace(/^\/storage\/v1\/object\//, "").split("/");
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const json = (code, obj) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    };

    if (req.method === "POST" && parts[0] === "sign") {
      const [, bucket, ...rest] = parts;
      const key = `${bucket}/${rest.join("/")}`;
      if (!objects.has(key)) return json(404, { error: "Object not found", statusCode: "404" });
      return json(200, {
        signedURL: `/object/sign/${key}?token=mock&download=`,
      });
    }
    if (req.method === "GET" && parts[0] === "sign") {
      const [, bucket, ...rest] = parts;
      const o = objects.get(`${bucket}/${rest.join("/")}`);
      if (!o) return json(404, { error: "Object not found" });
      res.writeHead(200, {
        "Content-Type": o.type,
        "Content-Disposition": `attachment; filename="${rest.at(-1)}"`,
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(o.body);
    }
    if (req.method === "POST") {
      const [bucket, ...rest] = parts;
      const key = `${bucket}/${rest.join("/")}`;
      if (objects.has(key) && req.headers["x-upsert"] !== "true") {
        return json(409, { error: "The resource already exists", statusCode: "409" });
      }
      objects.set(key, { body, type: req.headers["content-type"] ?? "application/octet-stream" });
      console.log(`stored ${key} (${body.length} bytes)`);
      return json(200, { Key: key });
    }
    if (req.method === "DELETE") return json(200, []);
    json(404, { error: "not implemented in the mock" });
  });
}).listen(PORT, "127.0.0.1", () => console.log(`mock storage on :${PORT}`));
