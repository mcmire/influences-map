const fastify = require("fastify")({ logger: true });
const GraknClient = require("grakn-client");

async function openSession(keyspace) {
  const client = new GraknClient("localhost:48555");
  const session = await client.session(keyspace);
  await session.close();
  client.close();
}

openSession("social_network");

fastify.get("/", async (request, reply) => {
  openSession("social_network");
  return { hello: "world" };
});

async function start() {
  try {
    await fastify.listen(3000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
