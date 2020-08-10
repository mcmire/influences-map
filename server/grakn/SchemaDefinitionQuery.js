const _ = require("lodash");

const grakn = require("./client");
const graknUtil = require("./util");
const SchemaDefinition = require("./SchemaDefinition");

class SchemaDefinitionQuery {
  constructor(schemaDefinition) {
    this.schemaDefinition = schemaDefinition;
  }

  toString() {
    const sections = [
      "define",
      this._formatStatementClauses("Attribute", "attributes")
        .map((line) => `  ${line}`)
        .join("\n"),
      this._formatStatementClauses("Entity", "entities")
        .map((line) => `  ${line}`)
        .join("\n"),
      this._formatStatementClauses("Relation", "relations")
        .map((line) => `  ${line}`)
        .join("\n"),
    ];

    return sections.join("\n\n");
  }

  _formatStatementClauses(kind, collectionName) {
    return _.flatMap(this.schemaDefinition[collectionName], (attribute) => {
      return this[`_build${kind}StatementLines`](attribute);
    });
  }

  _buildAttributeStatementLines(attribute) {
    const qualifiers = { value: attribute.type };

    if (attribute.type === "string" && attribute.opts.regex) {
      qualifiers.regex =
        attribute.opts.regex instanceof SchemaDefinition.String
          ? attribute.opts.regex
          : new SchemaDefinition.String(attribute.opts.regex);
    }

    return this._buildSubtypeStatementLines(
      attribute.name,
      "attribute",
      qualifiers
    );
  }

  _buildEntityStatementLines(entity) {
    const qualifiers = ["has", "plays"].reduce((obj, property) => {
      return { ...obj, [property]: entity[property] };
    }, {});

    return this._buildSubtypeStatementLines(entity.name, "entity", qualifiers);
  }

  _buildRelationStatementLines(relation) {
    const qualifiers = ["relates", "has", "plays"].reduce((obj, property) => {
      return { ...obj, [property]: relation[property] };
    }, {});

    return this._buildSubtypeStatementLines(
      relation.name,
      "relation",
      qualifiers
    );
  }

  _buildSubtypeStatementLines(name, supertype, qualifiers) {
    const clauses = [`${name} sub ${supertype}`];

    _.each(qualifiers, (valueOrValues, name) => {
      const values = Array.isArray(valueOrValues)
        ? valueOrValues
        : [valueOrValues];

      values.forEach((value) => {
        if (value instanceof SchemaDefinition.String) {
          clauses.push(`${name} "${value}"`);
        } else {
          clauses.push(`${name} ${value}`);
        }
      });
    });

    return graknUtil.formatStatementClauses(clauses);
  }
}

module.exports = SchemaDefinitionQuery;
