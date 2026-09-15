import { db } from '../data/db.js';
import { generateId } from '../utils/helpers.js';

export async function addIdol(stageName, realName, photoUrl, debutDate) {
  const newIdol = {
    id: generateId('idol'),
    stageName,
    realName: realName || null,
    photo: photoUrl || '/assets/placeholder-idol.jpg',
    debutDate: debutDate || null,
    status: 'active'
  };
  await db.idols.add(newIdol);
  return newIdol;
}

export async function addGroup(name, type, photoUrl, debutDate) {
  const newGroup = {
    id: generateId('group'),
    name,
    type, 
    photo: photoUrl || '/assets/placeholder-group.jpg',
    debutDate: debutDate || null,
    status: 'active'
  };
  await db.groups.add(newGroup);
  return newGroup;
}

// --- NUEVAS FUNCIONES ---

export async function getAllIdols() {
  return await db.idols.toArray();
}

export async function getAllGroups() {
  return await db.groups.toArray();
}

export async function addMembership(idolId, groupId, role) {
  const newMembership = {
    id: generateId('mem'),
    idolId,
    groupId,
    role: role || 'Member',
    status: 'currentMember', // Puede ser 'formerMember' en el futuro
    startDate: null,
    endDate: null
  };
  await db.memberships.add(newMembership);
  return newMembership;
}

// ... (código existente) ...

export async function getIdolById(id) {
  return await db.idols.get(id);
}

export async function getGroupById(id) {
  return await db.groups.get(id);
}

export async function getGroupMembers(groupId) {
  const memberships = await db.memberships.where({ groupId }).toArray();
  const idolIds = memberships.map(m => m.idolId);
  // Buscar a todos los idols que coincidan con esos IDs
  return await db.idols.where('id').anyOf(idolIds).toArray();
}