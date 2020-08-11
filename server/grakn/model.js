const _ = require("lodash");
const dateFns = require("date-fns");

const { formatStatementClauses } = require("./util");

function assertValidKeys(attributes, names) {
  const missingNames = _.difference(names, Object.keys(attributes));

  if (missingNames.length > 0) {
    throw new Error(`Missing attributes: ${missingNames.join(", ")}`);
  }
}

function buildHas(attributes) {
  if (Array.isArray(attributes)) {
    return attributes.reduce((obj, [name, value]) => {
      if (name in obj) {
        return { ...obj, [name]: obj[name].concat([value]) };
      } else {
        return { ...obj, [name]: [value] };
      }
    }, {});
  } else {
    return _.reduce(
      attributes,
      (obj, valueOrValues, name) => {
        const value = Array.isArray(valueOrValues)
          ? valueOrValues
          : [valueOrValues];
        return { ...obj, [name]: value };
      },
      {}
    );
  }
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

  async createEntity(type, attributes = {}) {
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

  async createRelation(type, relationWithObjects, { has = {} } = {}) {
    has = buildHas(has);
    const relationDefinition = this.schemaDefinition.findRelation(type);
    assertValidKeys(relationWithObjects, relationDefinition.relates);

    const relationWithVariables = _.reduce(
      Object.keys(relationWithObjects),
      (obj, role, index) => {
        return { ...obj, [role]: `$a${index}` };
      },
      {}
    );
    const matchStatementLines = _.flatMap(
      relationWithObjects,
      (relationObject, role) =>
        this._buildStatementLines({
          subjectVariable: relationWithVariables[role],
          id: relationObject.id,
        })
    );

    const insertStatementLines = this._buildStatementLines({
      subjectVariable: `$a${Object.values(relationWithObjects).length}`,
      type: type,
      relationWithVariables: relationWithVariables,
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
    subjectVariable = "$x",
    type = null,
    id = null,
    relationWithVariables = null,
    has = {},
  }) {
    if (id == null && type == null) {
      throw new Error("Either id or type must be given");
    }

    let initialClause = `${subjectVariable}`;
    if (relationWithVariables != null) {
      initialClause +=
        " (" +
        _.map(
          relationWithVariables,
          (playerVariable, role) => `${role}: ${playerVariable}`
        ).join(", ") +
        ")";
    }
    if (id != null) {
      initialClause += ` id ${id}`;
    } else {
      initialClause += ` isa ${type}`;
    }

    const clauses = [initialClause].concat(
      _.flatMap(has, (values, name) => {
        return _.map(values, (value) => {
          const attributeDefinition = this.schemaDefinition.findAttribute(name);

          if (attributeDefinition.type === "datetime") {
            const normalizedValue =
              value instanceof Date
                ? dateFns.format(value, "yyyy-MM-dd")
                : value;
            return `has ${name} ${normalizedValue}`;
          } else {
            return `has ${name} "${value}"`;
          }
        });
      })
    );

    return formatStatementClauses(clauses);
  }
}

module.exports = Model;
