import { createApp } from "./app";

const app = createApp();

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
