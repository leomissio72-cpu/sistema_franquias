import app from "../src/serverBackend.ts";

export default function handler(req: any, res: any) {
  return app(req, res);
}

