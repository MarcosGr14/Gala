import { db } from "../data/db.js";
import { DATA_TABLES } from "../data/catalog.js";
import { loadSnapshot } from "./entityService.js";
import { saveArtist } from "./artistManagementService.js";
import { saveRecord } from "./catalogService.js";

// Official profile facts and portrait URLs from TWICE / JYP Entertainment.
const members = [
  { stageName: "Nayeon", realName: "Im Na-yeon", nationality: "South Korean", birthDate: "1995-09-22", photo: "https://d1meds70430yck.cloudfront.net/artist/twice/814a7595f00a4c6895d0d671ca78c949-1%E1%84%82%E1%85%A1%E1%84%8B%E1%85%A7%E1%86%AB.png", roles: "Lead vocalist, lead dancer, center", description: "South Korean singer and member of TWICE." },
  { stageName: "Jeongyeon", realName: "Yoo Jeong-yeon", nationality: "South Korean", birthDate: "1996-11-01", photo: "https://d1meds70430yck.cloudfront.net/artist/twice/cec5840107e942b1beeda32b0c7064dc-2%E1%84%8C%E1%85%A5%E1%86%BC%E1%84%8B%E1%85%A7%E1%86%AB.png", roles: "Lead vocalist", description: "South Korean singer and member of TWICE." },
  { stageName: "Momo", realName: "Hirai Momo", nationality: "Japanese", birthDate: "1996-11-09", photo: "https://d1meds70430yck.cloudfront.net/artist/twice/1f63eab8fb434eb6a756c0be4eaf0d95-3%E1%84%86%E1%85%A9%E1%84%86%E1%85%A9.png", roles: "Main dancer, sub-vocalist, sub-rapper", description: "Japanese singer, dancer and member of TWICE." },
  { stageName: "Sana", realName: "Minatozaki Sana", nationality: "Japanese", birthDate: "1996-12-29", photo: "https://d1meds70430yck.cloudfront.net/artist/twice/abc9688970fd4b9793fc26b86e8f5dc4-4%E1%84%89%E1%85%A1%E1%84%82%E1%85%A1.png", roles: "Sub-vocalist", description: "Japanese singer and member of TWICE." },
  { stageName: "Jihyo", realName: "Park Ji-hyo", nationality: "South Korean", birthDate: "1997-02-01", photo: "https://d1meds70430yck.cloudfront.net/artist/twice/2bda6e2820454aa399d69be641da98ed-5%E1%84%8C%E1%85%B5%E1%84%92%E1%85%AD.png", roles: "Leader, main vocalist", description: "South Korean singer and leader of TWICE." },
  { stageName: "Mina", realName: "Myoui Mina", nationality: "Japanese-American", birthDate: "1997-03-24", photo: "https://d1meds70430yck.cloudfront.net/artist/twice/506c189bfa134a87a02ca6af4b07aa18-6%E1%84%86%E1%85%B5%E1%84%82%E1%85%A1.png", roles: "Main dancer, sub-vocalist", description: "Japanese-American singer, dancer and member of TWICE." },
  { stageName: "Dahyun", realName: "Kim Da-hyun", nationality: "South Korean", birthDate: "1998-05-28", photo: "https://d1meds70430yck.cloudfront.net/artist/twice/caacf4fa97054bf29465ce9eef579cba-7%E1%84%83%E1%85%A1%E1%84%92%E1%85%A7%E1%86%AB.png", roles: "Lead rapper, sub-vocalist", description: "South Korean singer, rapper and member of TWICE." },
  { stageName: "Chaeyoung", realName: "Son Chae-young", nationality: "South Korean", birthDate: "1999-04-23", photo: "https://d1meds70430yck.cloudfront.net/artist/twice/ea4e327ee4c8488287840951ba3e1dd7-8%E1%84%8E%E1%85%A2%E1%84%8B%E1%85%A7%E1%86%BC.png", roles: "Main rapper, sub-vocalist", description: "South Korean singer, rapper and member of TWICE." },
  { stageName: "Tzuyu", realName: "Chou Tzuyu", nationality: "Taiwanese", birthDate: "1999-06-14", photo: "https://d1meds70430yck.cloudfront.net/artist/twice/c8911050462d4dec80fb785843a378c9-9%E1%84%8D%E1%85%B3%E1%84%8B%E1%85%B1.png", roles: "Lead dancer, sub-vocalist, visual", description: "Taiwanese singer and member of TWICE." },
];
const key = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function importTwiceMembers(database = db) {
  return database.transaction("rw", DATA_TABLES.map((table) => database.table(table)), async () => {
    let data = await loadSnapshot(database);
    let group = data.groups.find((row) => key(row.name) === "twice");
    if (!group) {
      group = await saveRecord("group", { name: "TWICE", type: "gg", debutDate: "2015-10-20", status: "active", description: "South Korean girl group formed by JYP Entertainment." }, database);
    }
    let created = 0, updated = 0, linked = 0;
    for (const member of members) {
      data = await loadSnapshot(database);
      let idol = data.idols.find((row) => key(row.stageName) === key(member.stageName));
      const isNew = !idol;
      const refreshProfile = ["Sana", "Momo", "Jeongyeon", "Nayeon"].includes(member.stageName);
      const input = {
        ...(idol || {}),
        ...Object.fromEntries(Object.entries(member).map(([field, value]) => [
          field,
          refreshProfile || !idol?.[field] ? value : idol[field],
        ])),
        gender: "female",
        debutDate: refreshProfile || !idol?.debutDate ? "2015-10-20" : idol.debutDate,
        status: idol?.status || "active",
      };
      idol = await saveArtist("idol", input, [], database);
      if (isNew) created++; else updated++;
      const membership = data.memberships.find((row) => row.idolId === idol.id && row.groupId === group.id);
      if (!membership) {
        await saveArtist("idol", idol, [{ idolId: idol.id, groupId: group.id, role: member.roles, startDate: "2015-10-20", endDate: "", status: "current" }], database);
        linked++;
      } else if (!membership.role || !membership.startDate) {
        await saveArtist("idol", idol, [{ ...membership, role: membership.role || member.roles, startDate: membership.startDate || "2015-10-20" }], database);
      }
    }
    return { created, updated, linked };
  });
}
