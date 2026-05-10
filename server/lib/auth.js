import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "./config.js";

export const hashPassword = (password) => bcrypt.hash(password, 10);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);

export const signUserToken = ({ userId, phone, deviceKey }) =>
  jwt.sign({ role: "user", userId, phone, deviceKey }, config.jwtSecret, { expiresIn: "30d" });

export const signAdminToken = ({ adminId, account, name, adminRole }) =>
  jwt.sign({ role: "admin", adminId, account, name, adminRole }, config.jwtSecret, { expiresIn: "30d" });

export const verifyToken = (token) => jwt.verify(token, config.jwtSecret);
