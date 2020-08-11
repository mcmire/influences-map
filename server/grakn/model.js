const _ = require("lodash");

const { formatStatementClauses } = require("./util");

function assertValidKeys(attributes, names) {
  const missingNames = _.difference(names, Object.keys(attributes));

  if (missingNames.length > 0) {
    throw new Error(`Missing attributes: ${missingNames.join(", ")}`);
  }
}

function buildHas(attributes) {
  return Array.isArray(attributes)
    ? attributes.reduce((obj, [name, value]) => {
        if (name in obj) {
          return { ...obj, [name]: obj[name].concat([value]) };
        } else {
          return { ...obj, [name]: [value] };
        }
      }, {})
    : attributes;
}

function buildAttributes(attributes) {
  return _.reduce(
    attributes,
    (obj, values, name) => {
      if (values.length > 1) {
        return { ...obj, [name]: values };
      } else {
        return { ...obj, [name]: values[0] };
      }
    },
    {}
  );
}

class Model {
  constructor(session, schemaDefinition) {
    this.session = session;
    this.schemaDefinition = schemaDefinition;
  }

  async createEntity(type, attributes) {
    const has = buildHas(attributes);
    const entityDefinition = this.schemaDefinition.findEntity(type);
    assertValidKeys(has, entityDefinition.attributes);

    const query =
      "insert " + this._buildStatementLines({ type, has }).join("\n");
    const iterator = await this.session.performWriteQuery(query);
    const concepts = await iterator.collectConcepts();
    const entity = concepts[concepts.length - 1];
    return { ...entity, ...buildAttributes(attributes) };
  }

  async createRelation(type, relatedObjectsByRole, { has = {} } = {}) {
    const relationDefinition = this.schemaDefinition.findRelation(type);
    assertValidKeys(relatedObjectsByRole, relationDefinition.relates);

    // XXX: relatedObjectsByRole? relationship?
    // should variable names include the $?
    const variablesByRole = _.reduce(
      Object.keys(relatedObjectsByRole),
      (obj, role, index) => {
        return { ...obj, [role]: `a${index}` };
      },
      {}
    );
    const matchStatementLines = _.flatMap(
      relatedObjectsByRole,
      (relationObject, role) =>
        this._buildStatementLines({
          variableName: variablesByRole[role],
          id: relationObject.id,
        })
    );

    const insertStatementLines = this._buildStatementLines({
      variableName: `a${Object.values(relatedObjectsByRole).length}`,
      type: type,
      // XXX: This doesn't feel right
      relationship: variablesByRole,
      has: has,
    });

    const sections = [
      "match",
      matchStatementLines.map((line) => `  ${line}`).join("\n"),
      "insert",
      insertStatementLines.map((line) => `  ${line}`).join("\n"),
    ];
    const query = sections.join("\n\n");

    const iterator = await this.session.performWriteQuery(query);
    const concepts = await iterator.collectConcepts();
    return concepts[concepts.length - 1];
  }

  _buildStatementLines({
    variableName = "x",
    type = null,
    id = null,
    relationship = null,
    has = {},
  }) {
    if (id == null && type == null) {
      throw new Error("Either id or type must be given");
    }

    let initialClause = `$${variableName}`;
    if (relationship != null) {
      initialClause +=
        " (" +
        _.map(
          relationship,
          (playerVariableName, role) => `${role}: $${playerVariableName}`
        ).join(", ") +
        ")";
    }
    if (id != null) {
      initialClause += ` id ${id}`;
    } else {
      initialClause += ` isa ${type}`;
    }

    const clauses = [initialClause].concat(
      _.map(has, (value, name) => {
        if (/-date$/.test(name) || /-time$/.test(name)) {
          return `has ${name} ${value}`;
        } else {
          return `has ${name} "${value}"`;
        }
      })
    );

    return formatStatementClauses(clauses);
  }
}

module.exports = Model;
