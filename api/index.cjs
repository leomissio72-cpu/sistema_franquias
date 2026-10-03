const backend = require("./_server.cjs");
const app = backend.default || backend.app || backend;

module.exports = app;
