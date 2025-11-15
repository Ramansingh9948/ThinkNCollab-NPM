#!/usr/bin/env node
import { program } from "commander";
import { pushToRoom } from "../lib/api.js";

program
  .name("tnc")
  .description("ThinkNCollab CLI tool")
  .version("0.1.0");

program
  .command("push")
  .option("--room <roomId>", "Room ID to push files")
  .action(async (opts) => {
    if (!opts.room) {
      console.error("❌ Please provide a room id using --room <id>");
      process.exit(1);
    }
    await pushToRoom(opts.room);
  });

program.parse();
