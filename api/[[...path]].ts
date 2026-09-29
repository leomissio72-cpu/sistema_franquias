import app from "../src/serverBackend";

/** Catch-all serverless adapter for the Express API routes not backed by a dedicated function. */
export default function handler(req: any, res: any) {
  return app(req, res);
}
