const path = require("path");
const fs = require("fs");

const SCHEMA_FILE = path.resolve(__dirname, `../../db/schema.json`);

class SchemaDefinition {
  constructor() {
    this.attributes = [];
    this.entities = [];
    this.relations = [];
  }

  attribute(name, type, opts = {}) {
    this.attributes.push({ name, type, opts });
  }

  entity(name, { has = [], plays = [] } = {}) {
    this.entities.push({ name, has, plays });
  }

  relation(name, { relates, has = [], plays = [] }) {
    this.relations.push({ name, relates, has, plays });
  }

  findEntity(name) {
    const entity = this.entities.find((entity) => entity.name === name);

    if (entity == null) {
      throw new Error(`Could not find entity: ${name}`);
    } else {
      return entity;
    }
  }

  findRelation(name) {
    const relation = this.relations.find((relation) => relation.name === name);

    if (relation == null) {
      throw new Error(`Could not find relation: ${name}`);
    } else {
      return relation;
    }
  }

  async save() {
    await fs.promises.mkdir(path.dirname(SCHEMA_FILE), { recursive: true });
    return fs.promises.writeFile(
      SCHEMA_FILE,
      JSON.stringify(this.toJSON(), null, 2)
    );
  }

  toJSON() {
    return {
      attributes: this.attributes,
      entities: this.entities,
      relations: this.relations,
    };
  }
}

class SchemaDefinitionString extends String {}

SchemaDefinition.String = SchemaDefinitionString;

module.exports = SchemaDefinition;
