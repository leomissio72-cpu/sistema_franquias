import app from "../../src/serverBackend";

/** Delegate bulk reconciliation entries to the same backend used locally. */
export default function handler(req: any, res: any) {
  return app(req, res);
}
