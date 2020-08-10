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
}

class SchemaDefinitionString extends String {}

SchemaDefinition.String = SchemaDefinitionString;

module.exports = SchemaDefinition;
