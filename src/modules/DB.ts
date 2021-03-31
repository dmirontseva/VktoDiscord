import lowdb from "lowdb";
import FileAsync from "lowdb/adapters/FileAsync.js";

import { IDBSchema } from "../interfaces";

const adapter = new FileAsync<IDBSchema>("./news.json");

export const db = await lowdb(adapter);
