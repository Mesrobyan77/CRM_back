require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sequelize = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger-output.json");
const {
  boardRouter,
  columnRouter,
  subtaskRouter,
  taskRouter,
  workspaceRouter,
} = require("./routers/indexRouter");
const loginRouter = require("./routers/loginRouther");

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(cors({ origin: "*", credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/", boardRouter);
app.use("/", columnRouter);
app.use("/", subtaskRouter);
app.use("/", taskRouter);
app.use("/", workspaceRouter);
app.use("/", loginRouter);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");
    await sequelize.sync();
    console.log("✅ Models synced");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`Swagger running at http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error("❌ Database error:", err);
  }
})();
