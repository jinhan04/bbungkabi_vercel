// server/src/index.ts
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRouter);

app.listen(3000, () => console.log("listening on 3000"));
