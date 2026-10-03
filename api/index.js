import backend from "./_server.cjs";

const app = backend.default || backend.app || backend;
export default app;
