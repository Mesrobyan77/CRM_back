require("dotenv").config();
const PORT = process.env.SERVER_PORT || 3000;
const swaggerAutogen = require("swagger-autogen")();

const doc = {
  info: {
    title: "CRM API",
    description: "API documentation for CRM",
  },
  host: `localhost:${PORT}`,
  schemes: ["http"],
  securityDefinitions: {
    Bearer: {
      type: "apiKey",
      name: "Authorization",
      in: "header",
      bearerFormat: "JWT",
      description: "Enter your token like: **Bearer <token>**",
    },
  },
  // Apply token to all endpoints by default
  security: [{ Bearer: [] }],
};

// List your main route files
const routes = [
  "./routers/loginRouther.js", // public routes
  "./routers/boardRouter.js",
  "./routers/columnRouter.js",
  "./routers/subtaskRouter.js",
  "./routers/tasksRouter.js",
  "./routers/workspaceRouter.js",
];

const outputFile = "./swagger-output.json";

// Generate swagger doc
swaggerAutogen(outputFile, routes, doc).then(() => {
  console.log("Swagger file generated:", outputFile);
});
