const cassandra = require('cassandra-driver');
const config = require('./config');
const client = new cassandra.Client({
  contactPoints: config.cassandraContactPoints,
  localDataCenter: config.cassandraLocalDatacenter,
  keyspace: config.cassandraKeyspace,
  pooling: { heartBeatInterval: 5000 }
});
let connected = false;
async function connect() {
  await client.connect();
  connected = true;
  console.log('[cassandra] connected');
}
async function query(cql, params = [], options = {}) {
  if (!connected) throw new Error('Cassandra is not connected');
  return client.execute(cql, params, { prepare: true, ...options });
}
async function disconnect() {
  if (connected) await client.shutdown();
  connected = false;
}
module.exports = { client, connect, query, disconnect };
