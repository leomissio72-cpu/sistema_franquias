import app from "../../src/serverBackend";

/** Delegate entry deletion to the same backend used locally. */
export default function handler(req: any, res: any) {
  return app(req, res);
}
