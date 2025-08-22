const express = require("express");
const authMiddleware = require("../middleware/authMiddleware/authMiddleware");
const ColumnController = require("../Controllers/ColumnController/ColumnController");
const columnRouter = express.Router();

columnRouter.post(
  "/api/home/column",
  authMiddleware,
  ColumnController.addColumn,
);

module.exports = columnRouter;
