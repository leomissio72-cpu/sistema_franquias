import app from "../src/serverBackend";

/** Explicit Vercel serverless adapter for the Express application. */
export default function handler(req: any, res: any) {
  return app(req, res);
}
