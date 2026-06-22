/**
 * Maidan Play — User list
 * Passwords are bcrypt hashes stored in env vars, never in code.
 */
const users = [
  { username: 'coach.a', displayName: 'Coach A', role: 'coach', hashEnv: 'PW_COACH_A' },
  { username: 'coach.b', displayName: 'Coach B', role: 'coach', hashEnv: 'PW_COACH_B' },
  { username: 'coach.c', displayName: 'Coach C', role: 'coach', hashEnv: 'PW_COACH_C' },
  { username: 'coach.d', displayName: 'Coach D', role: 'coach', hashEnv: 'PW_COACH_D' },
  { username: 'admin',   displayName: 'HQ Admin', role: 'admin', hashEnv: 'PW_ADMIN' },
];

function getUser(username) {
  const u = users.find(u => u.username === username);
  if (!u) return null;
  return { ...u, hash: (process.env[u.hashEnv] || '').trim() };
}

function allUsers() {
  return users.map(u => ({ username: u.username, displayName: u.displayName, role: u.role }));
}

module.exports = { getUser, allUsers };
