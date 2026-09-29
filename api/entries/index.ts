import app from "../../src/serverBackend";

/** Delegate manual entry operations to the same backend used locally. */
export default function handler(req: any, res: any) {
  return app(req, res);
}
