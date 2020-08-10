const GraknClient = require("grakn-client");

const SchemaDefinition = require("./SchemaDefinition");
const SchemaDefinitionQuery = require("./SchemaDefinitionQuery");

const KEYSPACE_NAME = "influences_map_development";

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

async function defineSchema(session, fn) {
  const schemaDefinition = new SchemaDefinition();
  fn(schemaDefinition);
  const query = new SchemaDefinitionQuery(schemaDefinition).toString();
  return performWriteQuery(session, query);
}

async function performReadQuery(session, query) {
  return withReadTransaction(session, async (transaction) => {
    const iterator = await performQueryWithin(transaction, query);
    return iterator.collectConcepts();
  });
}

async function withReadTransaction(session, fn) {
  const transaction = await session.transaction().read();
  const value = await fn(transaction);
  await transaction.close();
  return value;
}

async function performWriteQuery(session, query) {
  return withWriteTransaction(session, (transaction) => {
    return performQueryWithin(transaction, query);
  });
}

async function withWriteTransaction(session, fn) {
  const transaction = await session.transaction().write();
  const value = fn(transaction);
  await transaction.commit();
  return value;
}

async function performQueryWithin(transaction, query) {
  try {
    return await transaction.query(stripMultilineString(query));
  } catch (error) {
    throw new Error(
      "Query to define schema failed. Original error follows:\n\n" +
        "--- START OF ERROR ------------------------------------------------------------\n" +
        error.message +
        "\n" +
        "--- END OF ERROR --------------------------------------------------------------\n\n" +
        "Full query:\n\n" +
        "--- START OF QUERY ------------------------------------------------------------\n" +
        query +
        "\n" +
        "--- END OF QUERY --------------------------------------------------------------\n"
    );
  }
}

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

module.exports = {
  withClient,
  withSession,
  clearKeyspace,
  defineSchema,
  performReadQuery,
  withReadTransaction,
  performWriteQuery,
  withWriteTransaction,
  performQueryWithin,
};
