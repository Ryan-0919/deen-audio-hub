import prismaClientPkg from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { config } from "./config.js";

const { PrismaClient } = prismaClientPkg;

const adapter = new PrismaMariaDb(config.databaseUrl);

export const prisma = new PrismaClient({
  adapter,
});
