const path = require("path");
const OfficialGraknClient = require("grakn-client");

const config = require("../../config/database.json");
const { ENVIRONMENT } = require("../globals");
const SchemaDefinition = require("./SchemaDefinition");
const SchemaDefinitionQuery = require("./SchemaDefinitionQuery");

async function withGraknClient(fn) {
  const officialClient = new OfficialGraknClient("localhost:48555");
  const client = new GraknClient(officialClient);
  const value = await fn(client);
  await client.close();
  return value;
}

class GraknClient {
  constructor(client) {
    this.client = client;
    this.keyspaceName = this._determineKeyspaceName();
  }

  close() {
    return this.client.close();
  }

  async withSession(fn) {
    const session = new GraknSession(
      await this.client.session(this.keyspaceName),
      this.keyspaceName
    );
    const value = await fn(session);
    await session.close();
    return value;
  }

  async clearKeyspace() {
    try {
      return await this.client.keyspaces().delete(this.keyspaceName);
    } catch (error) {
      if (
        /It is not possible to delete keyspace \[.+\] as it does not exist/.test(
          error.message
        )
      ) {
        // no worries, keep going
      } else {
        throw new Error(
          `Clearing keyspace ${this.keyspaceName} failed. Original error follows:\n\n` +
            "--- START OF ERROR ------------------------------------------------------------\n" +
            error.message +
            "\n" +
            "--- END OF ERROR --------------------------------------------------------------"
        );
      }
    }
  }

  _determineKeyspaceName() {
    if (ENVIRONMENT in config) {
      return config[ENVIRONMENT].keyspaceName;
    } else {
      throw new Error(`Couldn't find database config for ${ENVIRONMENT}`);
    }
  }
}

class GraknSession {
  constructor(session, keyspaceName) {
    this.session = session;
    this.keyspaceName = keyspaceName;
  }

  close() {
    return this.session.close();
  }

  async defineSchema(fn) {
    const schemaDefinition = new SchemaDefinition();
    fn(schemaDefinition);
    const query = new SchemaDefinitionQuery(schemaDefinition).toString();
    await this.performWriteQuery(query);
    await schemaDefinition.save();
    return schemaDefinition;
  }

  async performReadQuery(query, fn) {
    return this.reading(async (transaction) => {
      const iterator = await transaction.performQuery(query);
      return iterator.collectConcepts();
    });
  }

  async reading(fn) {
    const transaction = await new GraknTransaction(
      await this.session.transaction().read()
    );
    const value = await fn(transaction);
    await transaction.close();
    return value;
  }

  async performWriteQuery(query) {
    return this.writing((transaction) => {
      return transaction.performQuery(query);
    });
  }

  async writing(fn) {
    const transaction = await new GraknTransaction(
      await this.session.transaction().write()
    );
    const value = fn(transaction);
    await transaction.commit();
    return value;
  }
}

class GraknTransaction {
  constructor(transaction) {
    this.transaction = transaction;
  }

  commit() {
    return this.transaction.commit();
  }

  close() {
    return this.transaction.close();
  }

  async performQuery(query) {
    try {
      return await this.transaction.query(this._stripMultilineString(query));
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

  _stripMultilineString(str) {
    const lines = str.replace(/^\n+/, "").replace(/\n+$/, "").split(/\n/);

    if (lines.length > 0) {
      const indentation = lines[0].match(/^([ ]*)/)[1];
      const regexp = new RegExp(`^${indentation}`);
      return lines.map((line) => line.replace(regexp, "")).join("\n");
    } else {
      return str;
    }
  }
}

module.exports = withGraknClient;
