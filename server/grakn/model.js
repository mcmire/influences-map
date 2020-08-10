const _ = require("lodash");

const grakn = require("./client");
const graknUtil = require("./util");

async function createShow(session, attributes) {
  const has = buildHas(attributes);
  checkAttributes(has, ["name", "alias"]);
  const show = await insertEntity(session, "show", { has });
  return { ...show, ...buildAttributes(attributes) };
}

async function createPerson(session, attributes) {
  const has = buildHas(attributes);
  checkAttributes(has, ["first-name", "last-name"]);
  const person = await insertEntity(session, "person", { has });
  return { ...person, ...buildAttributes(attributes) };
}

function createEmployment(session, relatedObjectsByRole, { has = {} } = {}) {
  checkAttributes(relatedObjectsByRole, ["employer", "employee"]);
  return insertRelation(session, "employment", relatedObjectsByRole, { has });
}

function createIntroduction(session, relatedObjectsByRole, { has = {} } = {}) {
  checkAttributes(relatedObjectsByRole, [
    "employment-source",
    "employment-target",
  ]);
  return insertRelation(session, "introduction", relatedObjectsByRole, { has });
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

function checkAttributes(attributes, names) {
  const missingNames = _.difference(names, Object.keys(attributes));

  if (missingNames.length > 0) {
    throw new Error(`Missing attributes: ${missingNames.join(", ")}`);
  }
}

async function insertEntity(session, type, { has = {} } = {}) {
  const query = "insert " + buildStatementLines({ type, has }).join("\n");
  const iterator = await grakn.performWriteQuery(session, query);
  const concepts = await iterator.collectConcepts();
  return concepts[concepts.length - 1];
}

async function insertRelation(
  session,
  type,
  relatedObjectsByRole,
  { has = {} } = {}
) {
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
      buildStatementLines({
        variableName: variablesByRole[role],
        id: relationObject.id,
      })
  );

  const insertStatementLines = buildStatementLines({
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

  const iterator = await grakn.performWriteQuery(session, query);
  const concepts = await iterator.collectConcepts();
  return concepts[concepts.length - 1];
}

function buildStatementLines({
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

  return graknUtil.formatStatementClauses(clauses);
}

module.exports = {
  createShow,
  createPerson,
  createEmployment,
  createIntroduction,
};
