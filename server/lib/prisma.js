import prismaClientPkg from "../../generated/prisma/index.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { config } from "./config.js";

const { PrismaClient } = prismaClientPkg;

const adapter = new PrismaMariaDb(config.databaseUrl);

export const prisma = new PrismaClient({
  adapter,
});
