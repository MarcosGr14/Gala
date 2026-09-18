import { db } from "../data/db.js";
import { saveRecord } from "./catalogService.js";
export const addIdol = (stageName, realName, photo, debutDate) =>
  saveRecord("idol", {
    stageName,
    realName,
    photo,
    debutDate,
    status: "active",
  });
export const addGroup = (name, type, photo, debutDate) =>
  saveRecord("group", { name, type, photo, debutDate, status: "active" });
export const addMembership = (idolId, groupId, role = "Member") =>
  saveRecord("membership", {
    idolId,
    groupId,
    role,
    status: "current",
    startDate: null,
    endDate: null,
  });
export const getAllIdols = () => db.idols.toArray();
export const getAllGroups = () => db.groups.toArray();
export const getIdolById = (id) => db.idols.get(id);
export const getGroupById = (id) => db.groups.get(id);
export async function getGroupMembers(groupId) {
  const memberships = await db.memberships
    .where("groupId")
    .equals(groupId)
    .toArray();
  return (
    await db.idols.bulkGet([...new Set(memberships.map((m) => m.idolId))])
  ).filter(Boolean);
}
