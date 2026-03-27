// Set required env vars before config module loads
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "sk-ant-test-key-for-testing";
process.env.NODE_ENV = "test";
