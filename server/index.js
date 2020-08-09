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
    const concept = element.get(variableName);
    if (concept == null) {
      return obj;
    } else {
      return { ...obj, [variableName]: serializeConcept(concept) };
    }
  }, {});
}

fastify.get("/", (request, reply) =>
  withClient((client) =>
    withSession(client, async (session) => {
      return withReadTransaction(session, async (transaction) => {
        // Who did Conan befriend at the places he worked?
        const iterator = await performQueryWithin(
          transaction,
          `
            match
              $employer isa show,
                has name $employer-name;
              $conan isa person,
                has first-name "Conan",
                has last-name "O'Brien";
              $conan-employment (employer: $employer, employee: $conan) isa employment,
                has start-date $conan-start-date,
                has end-date $conan-end-date;
              $colleague isa person,
                has first-name $colleague-first-name,
                has last-name $colleague-last-name;
              not {
                $colleague-first-name == "Conan";
                $colleague-last-name == "O'Brien";
              };
              $colleague-employment (employer: $employer, employee: $colleague) isa employment,
                has start-date $colleague-start-date,
                has end-date $colleague-end-date;
              {
                $colleague-start-date >= $conan-start-date;
                $colleague-start-date <= $conan-end-date;
              } or {
                $colleague-end-date >= $conan-start-date;
                $colleague-end-date <= $conan-end-date;
              } or {
                $colleague-start-date >= $conan-start-date;
                $colleague-end-date <= $conan-end-date;
              } or {
                $conan-start-date >= $colleague-start-date;
                $conan-end-date <= $colleague-end-date;
              };

            get
              $conan,
              $employer-name,
              $conan-start-date,
              $conan-end-date,
              $colleague-first-name,
              $colleague-last-name,
              $colleague-start-date,
              $colleague-end-date;
          `
        );
        const elements = await iterator.collect();
        const results = elements.map((element) =>
          serializeElement(element, [
            "conan",
            "employer-name",
            "conan-start-date",
            "conan-end-date",
            "colleague-first-name",
            "colleague-last-name",
            "colleague-start-date",
            "colleague-end-date",
          ])
        );
        return { results };
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
