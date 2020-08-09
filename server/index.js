const _ = require("lodash");
const fastify = require("fastify")({ logger: true });
const {
  withClient,
  withSession,
  withReadTransaction,
  performQueryWithin,
} = require("./grakn");

function serializeConcept(concept) {
  const obj = { id: concept.id };

  if (typeof concept.type === "function") {
    obj.type = concept.type().baseType.toLowerCase().replace(/_type/, "");
  }

  if (typeof concept.value === "function") {
    obj.value = concept.value();
  }

  return obj;
}

function serializeElement(element, variableNames) {
  return variableNames.reduce((obj, variableName) => {
    return {
      ...obj,
      [variableName]: serializeConcept(element.get(variableName)),
    };
  }, {});
}

fastify.get("/", (request, reply) =>
  withClient((client) =>
    withSession(client, async (session) => {
      return withReadTransaction(session, async (transaction) => {
        const iterator = await performQueryWithin(
          transaction,
          `
            match
              $conan isa person,
                has first-name "Conan",
                has last-name "O'Brien";
              $employer isa show,
                has name $employer-name;
              (employer: $employer, employee: $conan) isa employment,
                has start-date $start-date,
                has end-date $end-date;
            get $employer, $employer-name, $start-date, $end-date;
          `
        );
        const elements = await iterator.collect();
        return elements.map((element) =>
          serializeElement(element, [
            "employer",
            "employer-name",
            "start-date",
            "end-date",
          ])
        );
      });
    })
  )
);

async function start() {
  try {
    await fastify.listen(3000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
