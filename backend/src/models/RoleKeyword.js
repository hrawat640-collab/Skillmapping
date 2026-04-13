import mongoose from "mongoose";

const RoleKeywordSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, unique: true },
    mustHave: [{ type: String }],
    niceToHave: [{ type: String }]
  },
  { timestamps: true }
);

export const RoleKeyword = mongoose.model("RoleKeyword", RoleKeywordSchema);
