const GraknClient = require("grakn-client");
const KEYSPACE_NAME = "influences_map_development";

function stripMultilineString(str) {
  const lines = str.replace(/^\n+/, "").replace(/\n+$/, "").split(/\n/);

  if (lines.length > 0) {
    const indentation = lines[0].match(/^([ ]*)/)[1];
    const regexp = new RegExp(`^${indentation}`);
    return lines.map((line) => line.replace(regexp, "")).join("\n");
  } else {
    return str;
  }
}

async function withClient(fn) {
  const client = new GraknClient("localhost:48555");
  const value = await fn(client);
  client.close();
  return value;
}

async function withSession(client, fn) {
  const session = await client.session(KEYSPACE_NAME);
  const value = await fn(session);
  await session.close();
  return value;
}

function clearKeyspace(client) {
  return client.keyspaces().delete(KEYSPACE_NAME);
}

async function withReadTransaction(session, fn) {
  const transaction = await session.transaction().read();
  const value = await fn(transaction);
  await transaction.close();
  return value;
}

async function withWriteTransaction(session, fn) {
  const transaction = await session.transaction().write();
  const value = fn(transaction);
  await transaction.commit();
  return value;
}

function performQueryWithin(transaction, query) {
  return transaction.query(stripMultilineString(query));
}

async function performReadQuery(session, query) {
  return withReadTransaction(session, async (transaction) => {
    const iterator = await performQueryWithin(transaction, query);
    return iterator.collectConcepts();
  });
}

async function performWriteQuery(session, query) {
  return withWriteTransaction(session, async (transaction) => {
    const iterator = await performQueryWithin(transaction, query);
    return iterator.collectConcepts();
  });
}

module.exports = {
  withClient,
  withSession,
  withReadTransaction,
  withWriteTransaction,
  clearKeyspace,
  performQueryWithin,
  performReadQuery,
  performWriteQuery,
};
